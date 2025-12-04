import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CosmosService } from '../services/CosmosService';
import { EventGridService } from '../services/EventGridService';
import { ConfirmUploadRequest } from '../models/Document';
import { CustomerDocumentUploadedEvent } from '../models/Events';
import {
  parseJsonBody,
  badRequest,
  notFound,
  success,
  internalServerError,
} from '../utils/httpHelpers';
import { ensureAuthorized, requirePermission, DOCUMENT_PERMISSIONS } from '../lib/auth';

/**
 * POST /api/documents/{docId}/confirm-upload
 * Client calls this after uploading the file to Blob Storage
 * Mark document as uploaded and publish event
 */
export async function confirmUpload(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing ConfirmUpload request');

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, DOCUMENT_PERMISSIONS.DOCUMENTS_UPLOAD);
    // Extract docId from route parameters
    const docId = request.params.docId;
    if (!docId) {
      return badRequest('docId is required');
    }

    // Parse request body
    const body = await parseJsonBody<ConfirmUploadRequest>(request);
    if (!body || body.uploaded !== true) {
      return badRequest('Body must contain { "uploaded": true }');
    }

    // Get customerId from query parameter (needed for partition key)
    const customerId = request.query.get('customerId');
    if (!customerId) {
      return badRequest('customerId query parameter is required');
    }

    // Initialize services
    const cosmosService = new CosmosService();

    // Fetch document
    const document = await cosmosService.getDocument(docId, customerId);

    if (!document) {
      return notFound(`Document ${docId} not found`);
    }

    // Update document status
    document.uploaded = true;
    await cosmosService.updateDocument(document);
    context.log(`Document ${docId} marked as uploaded`);

    // Publish event
    const eventGridService = new EventGridService();
    const uploadEvent: CustomerDocumentUploadedEvent = {
      documentId: document.id,
      customerId: document.customerId,
      documentType: document.documentType,
      blobPath: document.blobPath,
    };

    await eventGridService.publishDocumentUploadedEvent(uploadEvent);
    context.log(`Published CustomerDocumentUploadedEvent for ${docId}`);

    return success({
      message: 'Document upload confirmed',
      documentId: docId,
    });
  } catch (error: any) {
    context.error('Error in ConfirmUpload:', error);
    return internalServerError(error.message, context);
  }
}

app.http('ConfirmUpload', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'documents/{docId}/confirm-upload',
  handler: confirmUpload,
});

