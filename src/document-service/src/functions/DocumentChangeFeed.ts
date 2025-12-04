import { app, InvocationContext } from '@azure/functions';
import { EventGridService } from '../services/EventGridService';
import { CustomerDocumentExpiredEvent } from '../models/Events';

/**
 * Change Feed Trigger for Cosmos DB documents container
 * Detects TTL-based deletions and publishes expiry events
 * 
 * Note: Azure Cosmos DB Change Feed does NOT capture deletions directly.
 * However, when TTL expires, the document is deleted. To track this, you need to:
 * 1. Enable Change Feed on the container
 * 2. Use a separate "deleted" flag approach, OR
 * 3. Use a materialized view pattern
 * 
 * For this implementation, we'll handle document changes and check for metadata
 * that indicates pending deletion (e.g., documents with low TTL).
 * 
 * In production, consider using:
 * - A separate "deletions" container with change feed
 * - Azure Functions Timer Trigger to scan for near-expiry documents
 * - Custom metadata flag before TTL deletion
 */
export async function documentChangeFeed(
  documents: any[],
  context: InvocationContext
): Promise<void> {
  context.log(`Change feed triggered with ${documents.length} document(s)`);

  try {
    const eventGridService = new EventGridService();

    for (const doc of documents) {
      context.log(`Processing change for document: ${doc.id}`);

      // Check if document has a metadata flag indicating it's being deleted
      // (This requires adding a "deleted" or "isExpiring" flag before actual deletion)
      if (doc._deleted === true || doc.isDeleted === true) {
        // This document is marked for deletion due to TTL expiry
        const expiryEvent: CustomerDocumentExpiredEvent = {
          documentId: doc.id,
          customerId: doc.customerId,
          documentType: doc.documentType,
        };

        await eventGridService.publishDocumentExpiredEvent(expiryEvent);
        context.log(`Published CustomerDocumentExpiredEvent for ${doc.id}`);
      }
      
      // Alternative: Check for documents with very low TTL (about to expire)
      // and publish event proactively
      if (doc.ttl && doc.ttl > 0 && doc.ttl < 60 && !doc._expiryEventPublished) {
        // Document will expire in less than 60 seconds
        const expiryEvent: CustomerDocumentExpiredEvent = {
          documentId: doc.id,
          customerId: doc.customerId,
          documentType: doc.documentType,
        };

        await eventGridService.publishDocumentExpiredEvent(expiryEvent);
        context.log(`Published pre-expiry event for ${doc.id} (TTL: ${doc.ttl}s)`);
        
        // Note: In a real implementation, you'd want to update the document
        // to mark that the expiry event has been published to avoid duplicates
      }
    }

    context.log('Change feed processing completed');
  } catch (error: any) {
    context.error('Error in documentChangeFeed:', error);
    throw error;
  }
}

// Change Feed Trigger - enabled for production
// Note: If running locally with Cosmos Emulator, this may cause SSL issues
// Set NODE_TLS_REJECT_UNAUTHORIZED=0 in local.settings.json if needed
app.cosmosDB('DocumentChangeFeed', {
  connection: 'COSMOS_DB_CONNECTION_STRING',
  databaseName: 'DocumentDB',
  containerName: 'documents',
  createLeaseContainerIfNotExists: true,
  leaseContainerName: 'leases',
  feedPollDelay: 5000, // Poll every 5 seconds
  handler: documentChangeFeed,
});

