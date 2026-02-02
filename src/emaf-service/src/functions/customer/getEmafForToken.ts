/**
 * Get EMAF for Token (Customer)
 * GET /api/customer/emaf/{token}
 * Returns EMAF template and submission for customer to fill
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { getLead } from '../../services/leadServiceClient';
import { getCustomer } from '../../services/customerServiceClient';
import { dataPrefillService } from '../../services/dataPrefillService';

/**
 * Check if vendor is Al Sagr (handles various formats: alsagr, al-sagr, vendor-alsagr)
 */
function isAlSagrVendor(vendorId?: string): boolean {
  if (!vendorId) return false;
  const normalized = vendorId.toLowerCase().trim();
  return normalized.includes('alsagr') || normalized.includes('al-sagr');
}

/**
 * Check if a value is invalid (should be replaced)
 */
function isInvalidValue(value: any, key: string): boolean {
  if (value === undefined || value === null || value === '') {
    return true;
  }
  
  // Check for invalid Emirates ID (emirate names instead of IDs)
  if ((key === 'emiratesId' || key.includes('emiratesId')) && typeof value === 'string') {
    // If it's just text without numbers/dashes, it's likely an emirate name
    if (/^[A-Za-z\s]+$/.test(value.trim()) && !/[\d-]/.test(value)) {
      return true;
    }
  }
  
  // Check for invalid phone numbers (double country codes)
  if ((key === 'contactNumber' || key === 'mobile' || key.includes('phone')) && typeof value === 'string') {
    // Check for double country codes like "+971+971" or "+971971"
    if (/\+971\+971|\+971971/.test(value)) {
      return true;
    }
  }
  
  return false;
}

/**
 * Smart merge function: Only fills empty/undefined/null fields from prefilled data
 * Also replaces invalid values (like emirate names in emiratesId field, double country codes)
 * Preserves all existing valid non-empty fields
 * Handles both Sukoon (nested) and Al Sagr (flat) structures
 */
function smartMergeFormData(existing: Record<string, any>, prefilled: Record<string, any>, vendorId?: string): Record<string, any> {
  if (!prefilled || typeof prefilled !== 'object') {
    return existing || {};
  }

  const merged = { ...(existing || {}) };

  // Check if this is Al Sagr (flat structure) or Sukoon (nested structure)
  const isAlSagr = isAlSagrVendor(vendorId) || 'policyHolder_fullName' in prefilled;

  if (isAlSagr) {
    // Al Sagr: Flat structure - merge at top level
    for (const key in prefilled) {
      if (prefilled.hasOwnProperty(key)) {
        const existingValue = merged[key];
        const prefilledValue = prefilled[key];

        // Special handling for critical fields: nationality and emiratesId
        // Always set these if prefilled value exists and is valid
        const isCriticalField = key === 'policyHolder_nationality' || key === 'policyHolder_emiratesId';
        
        if (prefilledValue !== undefined && prefilledValue !== null && prefilledValue !== '') {
          // For critical fields, always set if prefilled value exists
          // For other fields, only set if existing value is empty/invalid
          const shouldFill = isCriticalField || 
                            isInvalidValue(existingValue, key) || 
                            existingValue === undefined || 
                            existingValue === null || 
                            existingValue === '' ||
                            (typeof existingValue === 'string' && existingValue.trim() === '');
          if (shouldFill) {
            merged[key] = prefilledValue;
          }
        }
      }
    }
    // Also clear invalid values even if no prefilled value exists
    for (const key in merged) {
      if (merged.hasOwnProperty(key) && isInvalidValue(merged[key], key)) {
        // Only clear if we don't have a prefilled value for this key
        if (!prefilled.hasOwnProperty(key) || prefilled[key] === undefined || prefilled[key] === null) {
          delete merged[key];
        }
      }
    }
  } else {
    // Sukoon: Nested structure - merge nested objects
    // Merge memberDetails
    if (prefilled.memberDetails) {
      merged.memberDetails = { ...(merged.memberDetails || {}) };
        for (const key in prefilled.memberDetails) {
          if (prefilled.memberDetails.hasOwnProperty(key)) {
            const existingValue = merged.memberDetails[key];
            const prefilledValue = prefilled.memberDetails[key];
            // Fill if existing value is empty OR invalid
            if (isInvalidValue(existingValue, key) && prefilledValue !== undefined && prefilledValue !== null) {
              merged.memberDetails[key] = prefilledValue;
            }
          }
        }
        // Also clear invalid values in memberDetails even if no prefilled value exists
        for (const key in merged.memberDetails) {
          if (merged.memberDetails.hasOwnProperty(key) && isInvalidValue(merged.memberDetails[key], key)) {
            // Only clear if we don't have a prefilled value for this key
            if (!prefilled.memberDetails || !prefilled.memberDetails.hasOwnProperty(key) || prefilled.memberDetails[key] === undefined || prefilled.memberDetails[key] === null) {
              delete merged.memberDetails[key];
            }
          }
        }
      // Always set relationship to 'Self' when prefilling from lead
      merged.memberDetails.relationship = 'Self';
    }

    // Merge previousInsurance
    if (prefilled.previousInsurance) {
      merged.previousInsurance = { ...(merged.previousInsurance || {}) };
      for (const key in prefilled.previousInsurance) {
        if (prefilled.previousInsurance.hasOwnProperty(key)) {
          const existingValue = merged.previousInsurance[key];
          const prefilledValue = prefilled.previousInsurance[key];
          if (
            existingValue === undefined ||
            existingValue === null ||
            existingValue === '' ||
            (typeof existingValue === 'string' && existingValue.trim() === '')
          ) {
            merged.previousInsurance[key] = prefilledValue;
          }
        }
      }
    }

    // Merge members array (only if existing is empty)
    if (prefilled.members && prefilled.members.length > 0) {
      if (!merged.members || merged.members.length === 0) {
        merged.members = [...prefilled.members];
      }
    }

    // Merge signature
    if (prefilled.signature) {
      merged.signature = { ...(merged.signature || {}) };
      for (const key in prefilled.signature) {
        if (prefilled.signature.hasOwnProperty(key)) {
          const existingValue = merged.signature[key];
          const prefilledValue = prefilled.signature[key];
          if (
            existingValue === undefined ||
            existingValue === null ||
            existingValue === '' ||
            (typeof existingValue === 'string' && existingValue.trim() === '')
          ) {
            merged.signature[key] = prefilledValue;
          }
        }
      }
    }
  }

  return merged;
}

export async function getEmafForToken(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  const preflightResponse = handlePreflight(request);
  if (preflightResponse) return preflightResponse;

  try {
    const token = request.params.token;
    
    if (!token) {
      return withCors(request, {
        status: 400,
        jsonBody: { 
          success: false,
          error: 'Token is required'
        }
      });
    }
    
    // Token is the submission ID - get submission directly
    const submission = await cosmosService.getSubmissionById(token);
    
    if (!submission) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'EMAF submission not found'
        }
      });
    }
    
    // Get template
    const template = await cosmosService.getEmafTemplateById(
      submission.emafTemplateId,
      submission.vendorId
    );
    
    if (!template) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'EMAF template not found'
        }
      });
    }
    
    // Always prefill memberDetails from lead data if leadId exists
    context.log(`🔍 Checking prefill - submission.leadId: ${submission.leadId}, formData exists: ${!!submission.formData}`);
    
    if (submission.leadId) {
      try {
        context.log(`🔄 Attempting to prefill from leadId: ${submission.leadId}`);
        
        // Ensure formData exists
        if (!submission.formData) {
          submission.formData = {};
          context.log(`📝 Initialized empty formData`);
        }
        
        // Determine lineOfBusiness from template
        const lineOfBusiness = template.lineOfBusiness || 'medical';
        context.log(`📋 Line of Business: ${lineOfBusiness}`);
        
        // Fetch lead data with enhanced error handling
        let leadData;
        try {
          leadData = await getLead(submission.leadId, lineOfBusiness);
        } catch (leadFetchError: any) {
          context.error(`❌ Failed to fetch lead data: ${leadFetchError.message}`, leadFetchError);
          // Continue without prefill - form should still be usable
          leadData = null;
        }
        
        if (leadData) {
          context.log(`✅ Lead data fetched: ${leadData.firstName} ${leadData.lastName}`, {
            email: leadData.email,
            phone: leadData.phone?.number,
            emirate: leadData.emirate,
            hasLobData: !!leadData.lobData,
            customerId: leadData.customerId,
            lobDataNationality: leadData.lobData?.nationality,
            lobDataEmiratesId: leadData.lobData?.emiratesId
          });
          
          // Fetch customer data if customerId exists
          let customerData = null;
          if (leadData.customerId) {
            try {
              customerData = await getCustomer(leadData.customerId);
              if (customerData) {
                context.log(`✅ Customer data fetched for customerId: ${leadData.customerId}`, {
                  customerNationality: customerData.nationality,
                  customerEmiratesId: customerData.emiratesId
                });
              }
            } catch (customerError: any) {
              context.log(`⚠ Failed to fetch customer data: ${customerError.message}`);
              // Continue without customer data - lead data is sufficient
            }
          }
          
          // Map LeadData from service to format expected by dataPrefillService
          const mappedLeadData = {
            firstName: leadData.firstName,
            lastName: leadData.lastName,
            email: leadData.email,
            phone: leadData.phone,
            emirate: leadData.emirate,
            customerId: leadData.customerId,
            lobData: leadData.lobData as any
          };
          
          // Get vendor ID from template
          const vendorId = template.vendorId || submission.vendorId;
          context.log(`📋 Vendor ID: ${vendorId}`);
          
          // Use dataPrefillService to map lead data to form structure
          // Pass vendorId and customerData for enhanced prefill
          // NEW: Returns both canonical and vendor-specific formats
          const { canonical, vendorFormat } = dataPrefillService.prefillFromLeadAndEmaf(
            mappedLeadData,
            undefined,
            vendorId,
            customerData || undefined
          );
          
          context.log(`📦 Generated canonical and vendor-specific data`, {
            vendorId,
            isAlSagr: isAlSagrVendor(vendorId),
            vendorFormatKeys: Object.keys(vendorFormat).length,
            canonicalPolicyHolder: canonical.policyHolder.fullName,
            canonicalMembers: canonical.insuredMembers.length,
            hasMemberDetails: 'memberDetails' in vendorFormat,
            hasPolicyHolder: 'policyHolder_fullName' in vendorFormat,
            policyHolderNationality: (vendorFormat as any).policyHolder_nationality || (vendorFormat as any).memberDetails?.nationality,
            policyHolderEmiratesId: (vendorFormat as any).policyHolder_emiratesId || (vendorFormat as any).memberDetails?.emiratesId,
            leadLobDataNationality: leadData.lobData?.nationality,
            leadLobDataEmiratesId: leadData.lobData?.emiratesId,
            customerNationality: customerData?.nationality,
            customerEmiratesId: customerData?.emiratesId
          });
          
          // Smart merge: Only fill empty fields
          let existingFormData = submission.formData || {};
          
          // If vendor is Al Sagr but form data has Sukoon structure (memberDetails), clear it
          // This handles cases where wrong structure was saved previously
          const hasWrongStructure = isAlSagrVendor(vendorId) && existingFormData.memberDetails && !existingFormData.policyHolder_fullName;
          if (hasWrongStructure) {
            context.log(`⚠ Detected wrong structure: Al Sagr vendor but Sukoon form data. Clearing old structure.`);
            existingFormData = {}; // Clear wrong structure to allow fresh prefill
          }
          
          const mergedFormData = smartMergeFormData(existingFormData, vendorFormat, vendorId);
          
          // Clean up: Remove old Sukoon structure if we have Al Sagr structure
          let cleanedFormData = { ...mergedFormData };
          if (isAlSagrVendor(vendorId) && cleanedFormData.policyHolder_fullName) {
            delete cleanedFormData.memberDetails;
            delete cleanedFormData.members;
            context.log(`🧹 Cleaned up old Sukoon structure from Al Sagr form`);
          }
          
          // Check if merged data is different from existing (i.e., we actually prefilled something)
          const existingKeys = Object.keys(existingFormData);
          const mergedKeys = Object.keys(cleanedFormData);
          const hasNewKeys = mergedKeys.some(key => !existingKeys.includes(key));
          const hasRemovedKeys = existingKeys.some(key => !mergedKeys.includes(key));
          const hasNewValues = mergedKeys.some(key => {
            const existingValue = existingFormData[key];
            const mergedValue = cleanedFormData[key];
            // Deep comparison for nested objects
            if (typeof existingValue === 'object' && typeof mergedValue === 'object' && 
                existingValue !== null && mergedValue !== null) {
              return JSON.stringify(existingValue) !== JSON.stringify(mergedValue);
            }
            // Check if value changed from empty to non-empty
            return (!existingValue || existingValue === '' || existingValue === null || existingValue === undefined) &&
                   mergedValue && mergedValue !== '' && mergedValue !== null && mergedValue !== undefined;
          });
          // Always save if we cleared wrong structure, removed keys, or if there are new keys/values
          const shouldSave = hasWrongStructure || hasRemovedKeys || hasNewKeys || hasNewValues;
          
          // Update submission with BOTH formats
          submission.formData = cleanedFormData;  // Legacy format (for backward compatibility)
          submission.canonicalData = canonical;   // New canonical format (single source of truth)
          submission.dataFormat = 'dual';         // Track that we're storing both formats
          
          if (shouldSave) {
            // Save prefilled data to database (both formats)
            try {
              await cosmosService.updateSubmission(submission.submissionId, submission.leadId, {
                formData: submission.formData,
                canonicalData: submission.canonicalData,
                dataFormat: 'dual',
                updatedAt: new Date()
              });
              context.log(`💾 Saved both canonical and vendor-specific formats to database`);
            } catch (saveError: any) {
              context.error(`⚠ Failed to save prefilled data: ${saveError.message}`, saveError);
              // Continue - data is still in memory and will be returned
            }
          } else {
            context.log(`ℹ No new data to save - form data already populated`);
          }
          
          context.log(`✓ Prefilled form data from lead ${submission.leadId}`, {
            vendorId,
            prefilledFields: Object.keys(vendorFormat).length,
            canonicalMembers: canonical.insuredMembers.length,
            savedToDatabase: shouldSave
          });
        } else {
          context.log(`⚠ Lead ${submission.leadId} not found, skipping prefill`);
        }
      } catch (error: any) {
        // Log error but don't break the flow - form should still be usable
        context.error(`⚠ Error prefilling from lead: ${error.message}`, error);
        if (error.stack) {
          context.error(`Error stack:`, error.stack);
        }
        // Continue with existing submission data - prefill failure should not break form load
        context.log(`ℹ Continuing with existing form data despite prefill error`);
      }
    } else {
      context.log(`ℹ No leadId in submission, skipping prefill`);
    }
    
    return withCors(request, {
      status: 200,
      jsonBody: { 
        success: true,
        data: {
          submission,
          template
        }
      }
    });
  } catch (error: any) {
    context.error('Get EMAF for token error:', error);
    
    if (error.response?.status === 404) {
      return withCors(request, {
        status: 404,
        jsonBody: { 
          success: false,
          error: 'Quotation not found or link expired'
        }
      });
    }
    
    return withCors(request, {
      status: 500,
      jsonBody: { 
        success: false,
        error: 'Failed to get EMAF',
        details: error.message
      }
    });
  }
}

app.http('getEmafForToken', {
  methods: ['GET', 'OPTIONS'],
  authLevel: 'anonymous',
  route: 'customer/emaf/{token}',
  handler: getEmafForToken
});
