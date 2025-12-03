import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { CosmosService } from '../services/CosmosService';
import { BlobStorageService } from '../services/BlobStorageService';
import { DownloadDocumentResponse } from '../models/Document';
import {
  badRequest,
  notFound,
  success,
  internalServerError,
} from '../utils/httpHelpers';

/**
 * GET /api/documents/{docId}/download
 * Generate a short-lived SAS token for downloading a document
 */
export async function getDownloadUrl(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing GetDownloadUrl request');

  try {
    // Extract docId from route parameters
    const docId = request.params.docId;
    if (!docId) {
      return badRequest('docId is required');
    }

    // Initialize services
    const cosmosService = new CosmosService();

    // Since we don't have customerId in the route, we need to query without partition key
    // This is less efficient but necessary for this endpoint design
    // Alternative: Include customerId in the route or query string
    
    // For now, we'll get customerId from query parameter
    const customerId = request.query.get('customerId');
    if (!customerId) {
      return badRequest('customerId query parameter is required');
    }

    // Fetch document metadata
    const document = await cosmosService.getDocument(docId, customerId);

    if (!document) {
      return notFound(`Document ${docId} not found`);
    }

    // Check if document has been uploaded
    if (!document.uploaded) {
      return badRequest('Document has not been uploaded yet');
    }

    // Initialize blob service
    const blobService = new BlobStorageService();

    // Check if this is for download or preview
    const isDownload = request.query.get('download') === 'true';

    // Generate appropriate SAS URI (15 minutes)
    const sasUri = isDownload
      ? await blobService.generateDownloadSasUri(document.blobPath, 15)
      : await blobService.generatePreviewSasUri(document.blobPath, 15);

    const response: DownloadDocumentResponse = {
      downloadSasUri: sasUri,
    };

    context.log(`${isDownload ? 'Download' : 'Preview'} URL generated for document ${docId}`);
    return success(response);
  } catch (error: any) {
    context.error('Error in GetDownloadUrl:', error);
    return internalServerError(error.message, context);
  }
}

app.http('GetDownloadUrl', {
  methods: ['GET'],
  authLevel: 'anonymous',
  route: 'documents/{docId}/download',
  handler: getDownloadUrl,
});

