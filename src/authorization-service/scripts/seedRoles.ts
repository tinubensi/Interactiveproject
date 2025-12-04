/**
 * Seed Default Roles Script
 * 
 * This script seeds the default system roles into Cosmos DB.
 * Run with: npm run seed
 */

import { CosmosClient } from '@azure/cosmos';
import { v4 as uuidv4 } from 'uuid';
import { DEFAULT_ROLES } from '@nectaria/shared-types';

interface RoleDefinitionDocument {
  id: string;
  roleId: string;
  displayName: string;
  description: string;
  permissions: string[];
  azureAdGroup?: string;
  inheritsFrom?: string[];
  isSystem: boolean;
  isHighPrivilege: boolean;
  isActive: boolean;
  createdAt: string;
  createdBy: string;
}

async function seedRoles() {
  console.log('🌱 Starting role seeding...\n');

  // Get config from environment
  const endpoint = process.env.COSMOS_ENDPOINT;
  const key = process.env.COSMOS_KEY;
  const databaseId = process.env.COSMOS_DATABASE_ID || 'authz-db';
  const containerId = 'role-definitions';

  if (!endpoint || !key) {
    console.error('❌ COSMOS_ENDPOINT and COSMOS_KEY environment variables are required');
    process.exit(1);
  }

  // Initialize Cosmos client
  const client = new CosmosClient({ endpoint, key });
  const database = client.database(databaseId);
  const container = database.container(containerId);

  console.log(`📦 Database: ${databaseId}`);
  console.log(`📁 Container: ${containerId}\n`);

  const now = new Date().toISOString();
  let created = 0;
  let skipped = 0;
  let errors = 0;

  for (const role of DEFAULT_ROLES) {
    try {
      // Check if role already exists
      const { resources } = await container.items
        .query({
          query: 'SELECT * FROM c WHERE c.roleId = @roleId',
          parameters: [{ name: '@roleId', value: role.roleId }],
        })
        .fetchAll();

      if (resources.length > 0) {
        console.log(`⏭️  Skipping ${role.roleId} - already exists`);
        skipped++;
        continue;
      }

      // Create the role document
      const document: RoleDefinitionDocument = {
        id: uuidv4(),
        roleId: role.roleId,
        displayName: role.displayName,
        description: role.description,
        permissions: role.permissions,
        azureAdGroup: role.azureAdGroup,
        inheritsFrom: role.inheritsFrom,
        isSystem: role.isSystem,
        isHighPrivilege: role.isHighPrivilege,
        isActive: role.isActive,
        createdAt: now,
        createdBy: 'system-seed',
      };

      await container.items.create(document);
      console.log(`✅ Created ${role.roleId} (${role.displayName})`);
      created++;
    } catch (error) {
      console.error(`❌ Error creating ${role.roleId}:`, error);
      errors++;
    }
  }

  console.log('\n📊 Summary:');
  console.log(`   Created: ${created}`);
  console.log(`   Skipped: ${skipped}`);
  console.log(`   Errors:  ${errors}`);
  console.log('\n✨ Seeding complete!');
}

// Run the script
seedRoles().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

