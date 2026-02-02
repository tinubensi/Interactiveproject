/**
 * Blob Storage Service for EMAF
 * Handles PDF and document storage
 */

import {
  BlobServiceClient,
  ContainerClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { getConfig } from '../config';

class BlobService {
  private blobServiceClient: BlobServiceClient | null = null;
  private containerClient: ContainerClient | null = null;
  private accountName: string = '';
  private accountKey: string = '';
  private initialized = false;

  /**
   * Initialize blob storage connection
   */
  private initialize(): void {
    if (this.initialized) return;

    const config = getConfig();
    const connectionString = config.blobStorage.connectionString;

    if (!connectionString) {
      throw new Error('BLOB_STORAGE_CONNECTION_STRING is not configured');
    }

    this.blobServiceClient = BlobServiceClient.fromConnectionString(connectionString);
    this.containerClient = this.blobServiceClient.getContainerClient(config.blobStorage.containerName);

    // Extract account name and key for SAS generation
    const connStringParts = connectionString.split(';');
    this.accountName = connStringParts
      .find((p) => p.startsWith('AccountName='))
      ?.split('=')[1] || '';
    this.accountKey = connStringParts
      .find((p) => p.startsWith('AccountKey='))
      ?.split('=')[1] || '';

    this.initialized = true;
  }

  /**
   * Upload PDF to blob storage with security headers
   */
  async uploadPdf(blobPath: string, pdfBuffer: Buffer): Promise<string> {
    this.initialize();

    const blockBlobClient = this.containerClient!.getBlockBlobClient(blobPath);
    
    // Extract filename from blobPath for Content-Disposition
    const filename = blobPath.split('/').pop() || 'document.pdf';
    
    await blockBlobClient.upload(pdfBuffer, pdfBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: 'application/pdf',
        // Set Content-Disposition to inline so browser displays it, not downloads
        blobContentDisposition: `inline; filename="${filename}"`,
        // Add cache control for better performance
        blobCacheControl: 'max-age=3600',
        // Prevent MIME type sniffing
        blobContentEncoding: undefined,
      },
      metadata: {
        // Add metadata to indicate this is a generated PDF
        generatedBy: 'emaf-pdf-service',
        generatedAt: new Date().toISOString(),
        contentType: 'application/pdf',
      },
    });

    return blockBlobClient.url;
  }

  /**
   * Download PDF from blob storage
   */
  async downloadPdf(blobPath: string): Promise<Buffer> {
    this.initialize();

    const blockBlobClient = this.containerClient!.getBlockBlobClient(blobPath);
    
    // Download blob to buffer
    const downloadResponse = await blockBlobClient.download();
    
    if (!downloadResponse.readableStreamBody) {
      throw new Error('Failed to download PDF: No stream body');
    }
    
    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }
    
    return Buffer.concat(chunks);
  }

  /**
   * Generate SAS URL for downloading with security headers
   */
  async generateDownloadSasUri(blobPath: string, expiryMinutes: number = 60): Promise<string> {
    this.initialize();

    const blobClient = this.containerClient!.getBlobClient(blobPath);
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiryMinutes * 60 * 1000);

    const permissions = new BlobSASPermissions();
    permissions.read = true;

    // Extract filename for Content-Disposition header
    const filename = blobPath.split('/').pop() || 'document.pdf';

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerClient!.containerName,
        blobName: blobPath,
        permissions: permissions,
        startsOn: startsOn,
        expiresOn: expiresOn,
        // Add response headers to SAS URL for security
        contentType: 'application/pdf',
        contentDisposition: `inline; filename="${filename}"`,
        cacheControl: 'max-age=3600, must-revalidate',
      },
      new StorageSharedKeyCredential(this.accountName, this.accountKey)
    ).toString();

    return `${blobClient.url}?${sasToken}`;
  }
}

export const blobService = new BlobService();
