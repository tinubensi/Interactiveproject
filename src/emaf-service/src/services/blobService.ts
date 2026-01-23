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
   * Upload PDF to blob storage
   */
  async uploadPdf(blobPath: string, pdfBuffer: Buffer): Promise<string> {
    this.initialize();

    const blockBlobClient = this.containerClient!.getBlockBlobClient(blobPath);
    
    await blockBlobClient.upload(pdfBuffer, pdfBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: 'application/pdf',
      },
    });

    return blockBlobClient.url;
  }

  /**
   * Upload document to blob storage
   */
  async uploadDocument(blobPath: string, fileBuffer: Buffer, mimeType: string): Promise<string> {
    this.initialize();

    const blockBlobClient = this.containerClient!.getBlockBlobClient(blobPath);
    
    await blockBlobClient.upload(fileBuffer, fileBuffer.length, {
      blobHTTPHeaders: {
        blobContentType: mimeType,
      },
    });

    return blockBlobClient.url;
  }

  /**
   * Generate SAS URL for downloading
   */
  async generateDownloadSasUri(blobPath: string, expiryMinutes: number = 60): Promise<string> {
    this.initialize();

    const blobClient = this.containerClient!.getBlobClient(blobPath);
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiryMinutes * 60 * 1000);

    const permissions = new BlobSASPermissions();
    permissions.read = true;

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerClient!.containerName,
        blobName: blobPath,
        permissions: permissions,
        startsOn: startsOn,
        expiresOn: expiresOn,
      },
      new StorageSharedKeyCredential(this.accountName, this.accountKey)
    ).toString();

    return `${blobClient.url}?${sasToken}`;
  }

  /**
   * Generate SAS URL for uploading
   */
  async generateUploadSasUri(blobPath: string, expiryMinutes: number = 15): Promise<string> {
    this.initialize();

    const blobClient = this.containerClient!.getBlobClient(blobPath);
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiryMinutes * 60 * 1000);

    const permissions = new BlobSASPermissions();
    permissions.write = true;
    permissions.create = true;

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: this.containerClient!.containerName,
        blobName: blobPath,
        permissions: permissions,
        startsOn: startsOn,
        expiresOn: expiresOn,
      },
      new StorageSharedKeyCredential(this.accountName, this.accountKey)
    ).toString();

    return `${blobClient.url}?${sasToken}`;
  }

  /**
   * Delete blob
   */
  async deleteBlob(blobPath: string): Promise<void> {
    this.initialize();

    const blobClient = this.containerClient!.getBlobClient(blobPath);
    await blobClient.deleteIfExists();
  }

  /**
   * Check if blob exists
   */
  async blobExists(blobPath: string): Promise<boolean> {
    this.initialize();

    const blobClient = this.containerClient!.getBlobClient(blobPath);
    return await blobClient.exists();
  }

  /**
   * Get blob size
   */
  async getBlobSize(blobPath: string): Promise<number> {
    this.initialize();

    const blobClient = this.containerClient!.getBlobClient(blobPath);
    const properties = await blobClient.getProperties();
    return properties.contentLength || 0;
  }

  /**
   * Download blob as buffer
   */
  async downloadBlob(blobPath: string): Promise<Buffer> {
    this.initialize();

    const blobClient = this.containerClient!.getBlobClient(blobPath);
    
    // Check if blob exists
    const exists = await blobClient.exists();
    if (!exists) {
      throw new Error(`Blob not found: ${blobPath}`);
    }

    // Download blob
    const downloadResponse = await blobClient.download();
    
    if (!downloadResponse.readableStreamBody) {
      throw new Error(`Failed to download blob: ${blobPath}`);
    }

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of downloadResponse.readableStreamBody) {
      chunks.push(Buffer.from(chunk));
    }

    return Buffer.concat(chunks);
  }
}

export const blobService = new BlobService();
