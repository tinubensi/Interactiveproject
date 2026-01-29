/**
 * Get EMAF for Token (Customer)
 * GET /api/customer/emaf/{token}
 * Returns EMAF template and submission for customer to fill
 */

import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { cosmosService } from '../../services/cosmosService';
import { handlePreflight, withCors } from '../../lib/corsHelper';
import { getLead } from '../../services/leadServiceClient';
import { dataPrefillService } from '../../services/dataPrefillService';

/**
 * Smart merge function: Only fills empty/undefined/null fields from prefilled data
 * Preserves all existing non-empty fields
 * Always sets relationship to 'Self' when prefilling from lead
 */
function mergeMemberDetails(existing: any, prefilled: any): any {
  if (!prefilled || typeof prefilled !== 'object') {
    return existing || {};
  }

  const merged = { ...(existing || {}) };

  // For each field in prefilled, only set if existing field is empty/undefined/null
  for (const key in prefilled) {
    if (prefilled.hasOwnProperty(key)) {
      const existingValue = merged[key];
      const prefilledValue = prefilled[key];

      // Only fill if existing value is empty, undefined, null, or empty string
      if (
        existingValue === undefined ||
        existingValue === null ||
        existingValue === '' ||
        (typeof existingValue === 'string' && existingValue.trim() === '')
      ) {
        merged[key] = prefilledValue;
      }
    }
  }

  // Always set relationship to 'Self' when prefilling from lead data
  if (prefilled.relationship) {
    merged.relationship = 'Self';
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
            hasLobData: !!leadData.lobData
          });
          
          // Map LeadData from service to format expected by dataPrefillService
          const mappedLeadData = {
            firstName: leadData.firstName,
            lastName: leadData.lastName,
            email: leadData.email,
            phone: leadData.phone,
            emirate: leadData.emirate,
            lobData: leadData.lobData as any
          };
          
          // Use dataPrefillService to map lead data to form structure
          // Pass undefined for existingEmafData so it only uses lead data
          const prefilledData = dataPrefillService.prefillFromLeadAndEmaf(mappedLeadData, undefined);
          
          context.log(`📦 Prefilled data structure:`, {
            hasMemberDetails: !!prefilledData.memberDetails,
            memberDetailsKeys: prefilledData.memberDetails ? Object.keys(prefilledData.memberDetails) : []
          });
          
          // Always set relationship to 'Self' when prefilling from lead
          if (prefilledData.memberDetails) {
            // Always set relationship to 'Self' when prefilling from lead
            prefilledData.memberDetails.relationship = 'Self';
            
            // Smart merge: Only fill empty fields in memberDetails
            const existingMemberDetails = submission.formData.memberDetails || {};
            context.log(`📋 Existing memberDetails:`, Object.keys(existingMemberDetails));
            
            const mergedMemberDetails = mergeMemberDetails(
              existingMemberDetails,
              prefilledData.memberDetails
            );
            
            // Always ensure relationship is 'Self' after merge (override any existing)
            mergedMemberDetails.relationship = 'Self';
            
            // Check if merged data is different from existing (i.e., we actually prefilled something)
            const existingKeys = Object.keys(existingMemberDetails);
            const mergedKeys = Object.keys(mergedMemberDetails);
            const hasNewKeys = mergedKeys.some(key => !existingKeys.includes(key));
            const hasNewValues = mergedKeys.some(key => {
              const existingValue = existingMemberDetails[key];
              const mergedValue = mergedMemberDetails[key];
              // Check if value changed from empty to non-empty
              return (!existingValue || existingValue === '' || existingValue === null || existingValue === undefined) &&
                     mergedValue && mergedValue !== '' && mergedValue !== null && mergedValue !== undefined;
            });
            const shouldSave = hasNewKeys || hasNewValues;
            
            // Update submission.formData with merged memberDetails
            submission.formData.memberDetails = mergedMemberDetails;
            
            if (shouldSave) {
              // Save prefilled data to database
              try {
                await cosmosService.updateSubmission(submission.submissionId, submission.leadId, {
                  formData: submission.formData,
                  updatedAt: new Date()
                });
                context.log(`💾 Saved prefilled memberDetails to database`);
              } catch (saveError: any) {
                context.error(`⚠ Failed to save prefilled data: ${saveError.message}`, saveError);
                // Continue - data is still in memory and will be returned
              }
            } else {
              context.log(`ℹ No new data to save - memberDetails already populated`);
            }
            
            context.log(`✓ Prefilled memberDetails from lead ${submission.leadId}`, {
              applicantName: mergedMemberDetails.applicantName,
              email: mergedMemberDetails.email,
              contactNumber: mergedMemberDetails.contactNumber,
              relationship: mergedMemberDetails.relationship,
              emiratesId: mergedMemberDetails.emiratesId,
              savedToDatabase: shouldSave
            });
          } else {
            context.log(`⚠ No memberDetails in prefilled data`);
          }
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
