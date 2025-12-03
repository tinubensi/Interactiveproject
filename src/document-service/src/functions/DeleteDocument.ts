import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CosmosService } from '../services/CosmosService';
import { BlobStorageService } from '../services/BlobStorageService';
import {
  badRequest,
  notFound,
  success,
  internalServerError,
} from '../utils/httpHelpers';

/**
 * DELETE /api/documents/{docId}
 * Remove metadata and delete blob file
 */
export async function deleteDocument(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing DeleteDocument request');

  try {
    // Extract docId from route parameters
    const docId = request.params.docId;
    if (!docId) {
      return badRequest('docId is required');
    }

    // Get customerId from query parameter (needed for partition key)
    const customerId = request.query.get('customerId');
    if (!customerId) {
      return badRequest('customerId query parameter is required');
    }

    // Initialize services
    const cosmosService = new CosmosService();

    // Fetch document to get blob path
    const document = await cosmosService.getDocument(docId, customerId);

    if (!document) {
      return notFound(`Document ${docId} not found`);
    }

    // Delete blob if it was uploaded
    if (document.uploaded) {
      const blobService = new BlobStorageService();
      await blobService.deleteBlob(document.blobPath);
      context.log(`Blob deleted: ${document.blobPath}`);
    }

    // Delete document from Cosmos DB
    await cosmosService.deleteDocument(docId, customerId);
    context.log(`Document ${docId} deleted from Cosmos DB`);

    return success({
      message: 'Document deleted successfully',
      documentId: docId,
    });
  } catch (error: any) {
    context.error('Error in DeleteDocument:', error);
    return internalServerError(error.message, context);
  }
}

app.http('DeleteDocument', {
  methods: ['DELETE'],
  authLevel: 'anonymous',
  route: 'documents/{docId}',
  handler: deleteDocument,
});

