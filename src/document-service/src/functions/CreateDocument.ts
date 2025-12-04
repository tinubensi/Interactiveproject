import { app, HttpRequest, HttpResponseInit, InvocationContext } from '@azure/functions';
import { v4 as uuidv4 } from 'uuid';
import { CosmosService } from '../services/CosmosService';
import { BlobStorageService } from '../services/BlobStorageService';
import {
  CreateDocumentRequest,
  CreateDocumentResponse,
  Document,
} from '../models/Document';
import {
  parseJsonBody,
  validateRequiredFields,
  badRequest,
  created,
  internalServerError,
} from '../utils/httpHelpers';
import { calculateTTL, isValidExpiryDate } from '../utils/ttlHelpers';
import { ensureAuthorized, requirePermission, DOCUMENT_PERMISSIONS } from '../lib/auth';

/**
 * POST /api/customers/{customerId}/documents
 * Create a new document metadata item and return a short-lived SAS upload URL
 */
export async function createDocument(
  request: HttpRequest,
  context: InvocationContext
): Promise<HttpResponseInit> {
  context.log('Processing CreateDocument request');

  try {
    const userContext = await ensureAuthorized(request);
    await requirePermission(userContext.userId, DOCUMENT_PERMISSIONS.DOCUMENTS_CREATE);
    // Extract customerId from route parameters
    const customerId = request.params.customerId;
    if (!customerId) {
      return badRequest('customerId is required');
    }

    // Parse request body
    const body = await parseJsonBody<CreateDocumentRequest>(request);
    const validationError = validateRequiredFields(body, [
      'userId',
      'documentType',
      'fileName',
      'expiryDate',
    ]);

    if (validationError) {
      return badRequest(validationError);
    }

    // Validate expiry date
    if (!isValidExpiryDate(body!.expiryDate)) {
      return badRequest('expiryDate must be a valid ISO-8601 date in the future');
    }

    // Generate unique document ID
    const documentId = uuidv4();

    // Calculate TTL
    const ttl = calculateTTL(body!.expiryDate);

    // Create blob path: customerDocuments/{customerId}/{documentId}/{fileName}
    const blobPath = `${customerId}/${documentId}/${body!.fileName}`;

    // Create document metadata
    const document: Document = {
      id: documentId,
      customerId: customerId,
      userId: body!.userId,
      documentType: body!.documentType,
      fileName: body!.fileName,
      blobPath: blobPath,
      expiryDate: body!.expiryDate,
      ttl: ttl,
      uploaded: false,
      createdAt: new Date().toISOString(),
    };

    // Initialize services
    const cosmosService = new CosmosService();
    const blobService = new BlobStorageService();

    // Save document to Cosmos DB
    await cosmosService.createDocument(document);
    context.log(`Document created in Cosmos DB: ${documentId}`);

    // Generate SAS upload URI (15 minutes)
    const uploadSasUri = await blobService.generateUploadSasUri(blobPath, 15);

    // Prepare response
    const response: CreateDocumentResponse = {
      documentId: documentId,
      uploadSasUri: uploadSasUri,
      blobPath: blobPath,
    };

    context.log(`CreateDocument completed successfully for ${documentId}`);
    return created(response);
  } catch (error: any) {
    context.error('Error in CreateDocument:', error);
    return internalServerError(error.message, context);
  }
}

app.http('CreateDocument', {
  methods: ['POST'],
  authLevel: 'anonymous',
  route: 'customers/{customerId}/documents',
  handler: createDocument,
});

