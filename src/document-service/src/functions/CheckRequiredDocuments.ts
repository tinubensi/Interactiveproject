import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CosmosService } from '../services/CosmosService';
import { DocumentType } from '../models/Document';
import {
  badRequest,
  success,
  internalServerError,
} from '../utils/httpHelpers';

/**
 * Required documents configuration by line of business
 */
const REQUIRED_DOCUMENTS_BY_LOB: Record<string, DocumentType[]> = {
  medical: [DocumentType.EmiratesID, DocumentType.Passport],
  motor: [DocumentType.EmiratesID, DocumentType.TradeLicense],
  general: [DocumentType.EmiratesID, DocumentType.TradeLicense],
  marine: [DocumentType.EmiratesID, DocumentType.TradeLicense],
};

/**
 * Response structure for required documents check
 */
interface CheckRequiredDocumentsResponse {
  leadId?: string;
  customerId: string;
  lineOfBusiness: string;
  requiredDocuments: string[];
  uploadedDocuments: string[];
  missingDocuments: string[];
  allRequiredUploaded: boolean;
}

/**
 * GET /api/documents/lead/{leadId}/check-required
 * or
 * GET /api/documents/customer/{customerId}/check-required
 * 
 * Query params:
 * - lineOfBusiness: 'medical' | 'motor' | 'general' | 'marine' (required)
 * 
 * Check if all required documents have been uploaded for a lead/customer
 * Used by Pipeline Service for condition evaluation
 */
export async function checkRequiredDocuments(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing CheckRequiredDocuments request');

  try {
    // Extract parameters from route
    const leadId = request.params.leadId;
    const customerId = request.params.customerId || request.query.get('customerId');
    const lineOfBusiness = request.query.get('lineOfBusiness');

    // Validate parameters
    if (!customerId && !leadId) {
      return badRequest('Either leadId or customerId is required');
    }

    if (!lineOfBusiness) {
      return badRequest('lineOfBusiness query parameter is required');
    }

    // Get required documents for this LOB
    const requiredDocuments = REQUIRED_DOCUMENTS_BY_LOB[lineOfBusiness.toLowerCase()];
    if (!requiredDocuments) {
      return badRequest(`Invalid lineOfBusiness: ${lineOfBusiness}`);
    }

    // For leadId, we need to resolve to customerId
    // In a full implementation, this would call the Lead Service
    // For now, we'll accept customerId directly or use leadId as customerId placeholder
    const effectiveCustomerId = customerId || `lead-${leadId}`;

    // Initialize services
    const cosmosService = new CosmosService();

    // Get all uploaded documents for this customer
    const documents = await cosmosService.listDocumentsByCustomer(effectiveCustomerId);
    
    // Filter to only uploaded documents
    const uploadedDocs = documents.filter(doc => doc.uploaded === true);
    
    // Get the document types that have been uploaded
    const uploadedDocumentTypes = uploadedDocs.map(doc => doc.documentType);

    // Find missing documents
    const missingDocuments = requiredDocuments.filter(
      reqDoc => !uploadedDocumentTypes.includes(reqDoc)
    );

    // Build response
    const response: CheckRequiredDocumentsResponse = {
      leadId: leadId || undefined,
      customerId: effectiveCustomerId,
      lineOfBusiness,
      requiredDocuments: requiredDocuments.map(d => d.toString()),
      uploadedDocuments: uploadedDocumentTypes.map(d => d.toString()),
      missingDocuments: missingDocuments.map(d => d.toString()),
      allRequiredUploaded: missingDocuments.length === 0,
    };

    context.log(
      `Document check for ${effectiveCustomerId}: ` +
      `${response.uploadedDocuments.length}/${response.requiredDocuments.length} uploaded, ` +
      `allRequired=${response.allRequiredUploaded}`
    );

    return success(response);
  } catch (error: any) {
    context.error('Error in CheckRequiredDocuments:', error);
    return internalServerError(error.message, context);
  }
}

// Register endpoint for lead-based lookup
app.http('CheckRequiredDocumentsLead', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'documents/lead/{leadId}/check-required',
  handler: checkRequiredDocuments,
});

// Register endpoint for customer-based lookup
app.http('CheckRequiredDocumentsCustomer', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'documents/customer/{customerId}/check-required',
  handler: checkRequiredDocuments,
});

