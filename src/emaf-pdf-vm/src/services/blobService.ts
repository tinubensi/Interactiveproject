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
}

export const blobService = new BlobService();
