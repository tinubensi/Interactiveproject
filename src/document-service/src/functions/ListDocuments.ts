import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CosmosService } from '../services/CosmosService';
import { ListDocumentResponse } from '../models/Document';
import { badRequest, success, internalServerError } from '../utils/httpHelpers';
import { ensureAuthorized, requirePermission, DOCUMENT_PERMISSIONS } from '../lib/auth';

/**
 * GET /api/customers/{customerId}/documents?userId={userId}
 * List all documents for a customer, optionally filtered by userId
 */
export async function listDocuments(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing ListDocuments request');

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, DOCUMENT_PERMISSIONS.DOCUMENTS_READ);
    // Extract customerId from route parameters
    const customerId = request.params.customerId;
    if (!customerId) {
      return badRequest('customerId is required');
    }

    // Get optional userId from query parameters
    const userId = request.query.get('userId');

    // Initialize Cosmos service
    const cosmosService = new CosmosService();

    // Fetch documents - filter by userId if provided
    const documents = userId
      ? await cosmosService.listDocumentsByUser(customerId, userId)
      : await cosmosService.listDocumentsByCustomer(customerId);
    
    context.log(`Found ${documents.length} documents for customer ${customerId}${userId ? ` and user ${userId}` : ''}`);

    // Map to response format
    const response: ListDocumentResponse[] = documents.map((doc) => ({
      id: doc.id,
      userId: doc.userId,
      documentType: doc.documentType,
      fileName: doc.fileName,
      expiryDate: doc.expiryDate,
      uploaded: doc.uploaded,
    }));

    return success(response);
  } catch (error: any) {
    context.error('Error in ListDocuments:', error);
    return internalServerError(error.message, context);
  }
}

app.http('ListDocuments', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'customers/{customerId}/documents',
  handler: listDocuments,
});

