import {
  BlobServiceClient,
  ContainerClient,
  BlobSASPermissions,
  generateBlobSASQueryParameters,
  StorageSharedKeyCredential,
} from '@azure/storage-blob';
import { config } from '../config';

/**
 * Service for interacting with Azure Blob Storage
 */
export class BlobStorageService {
  private blobServiceClient: BlobServiceClient | null = null;
  private containerClient: ContainerClient | null = null;
  private accountName: string = '';
  private accountKey: string = '';
  private initialized = false;

  private initialize() {
    if (!this.initialized) {
      this.blobServiceClient = BlobServiceClient.fromConnectionString(
        config.blobStorage.connectionString
      );
      this.containerClient = this.blobServiceClient.getContainerClient(
        config.blobStorage.containerName
      );

      // Extract account name and key from connection string for SAS generation
      const connStringParts = config.blobStorage.connectionString.split(';');
      this.accountName = connStringParts
        .find((p) => p.startsWith('AccountName='))
        ?.split('=')[1] || '';
      this.accountKey = connStringParts
        .find((p) => p.startsWith('AccountKey='))
        ?.split('=')[1] || '';
      
      this.initialized = true;
    }
  }

  constructor() {
    // Lazy initialization - don't connect until first use
  }

  /**
   * Generate SAS URI for uploading a blob
   * @param blobPath - Path to the blob in the container
   * @param expiryMinutes - Number of minutes until SAS expires (default 15)
   */
  async generateUploadSasUri(
    blobPath: string,
    expiryMinutes: number = 15
  ): Promise<string> {
    this.initialize();
    const blobClient = this.containerClient!.getBlobClient(blobPath);
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiryMinutes * 60 * 1000);

    const permissions = new BlobSASPermissions();
    permissions.write = true;
    permissions.create = true;

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: config.blobStorage.containerName,
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
   * Generate SAS URI for previewing a blob (inline display)
   * @param blobPath - Path to the blob in the container
   * @param expiryMinutes - Number of minutes until SAS expires (default 15)
   */
  async generatePreviewSasUri(
    blobPath: string,
    expiryMinutes: number = 15
  ): Promise<string> {
    this.initialize();
    const blobClient = this.containerClient!.getBlobClient(blobPath);
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiryMinutes * 60 * 1000);

    const permissions = new BlobSASPermissions();
    permissions.read = true;

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: config.blobStorage.containerName,
        blobName: blobPath,
        permissions: permissions,
        startsOn: startsOn,
        expiresOn: expiresOn,
        contentDisposition: 'inline',
      },
      new StorageSharedKeyCredential(this.accountName, this.accountKey)
    ).toString();

    return `${blobClient.url}?${sasToken}`;
  }

  /**
   * Generate SAS URI for downloading a blob
   * @param blobPath - Path to the blob in the container
   * @param expiryMinutes - Number of minutes until SAS expires (default 15)
   */
  async generateDownloadSasUri(
    blobPath: string,
    expiryMinutes: number = 15
  ): Promise<string> {
    this.initialize();
    const blobClient = this.containerClient!.getBlobClient(blobPath);
    const startsOn = new Date();
    const expiresOn = new Date(startsOn.getTime() + expiryMinutes * 60 * 1000);

    const permissions = new BlobSASPermissions();
    permissions.read = true;

    const sasToken = generateBlobSASQueryParameters(
      {
        containerName: config.blobStorage.containerName,
        blobName: blobPath,
        permissions: permissions,
        startsOn: startsOn,
        expiresOn: expiresOn,
        contentDisposition: 'attachment',
      },
      new StorageSharedKeyCredential(this.accountName, this.accountKey)
    ).toString();

    return `${blobClient.url}?${sasToken}`;
  }

  /**
   * Delete a blob from storage
   * @param blobPath - Path to the blob in the container
   */
  async deleteBlob(blobPath: string): Promise<void> {
    this.initialize();
    const blobClient = this.containerClient!.getBlobClient(blobPath);
    await blobClient.deleteIfExists();
  }

  /**
   * Check if a blob exists
   * @param blobPath - Path to the blob in the container
   */
  async blobExists(blobPath: string): Promise<boolean> {
    this.initialize();
    const blobClient = this.containerClient!.getBlobClient(blobPath);
    return await blobClient.exists();
  }
}

