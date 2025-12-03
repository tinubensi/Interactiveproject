/**
 * Migration script to convert existing connector configs to portal registry
 * 
 * This script:
 * 1. Reads all form templates
 * 2. Extracts unique connector configurations
 * 3. Creates portal definitions in the portal registry
 * 4. Optionally updates templates to reference portal IDs
 * 
 * Usage:
 *   npm run migrate:connectors
 */

import { listFormTemplates } from '../src/lib/formDefinitionRepository';
import { createPortal, getPortal } from '../src/lib/portalRepository';
import { updateFormTemplate } from '../src/lib/formDefinitionRepository';
import { FormTemplate, ConnectorConfig } from '../src/models/formTypes';
import { PortalDefinition, FieldDefinition } from '../src/models/portalTypes';

interface ConnectorSummary {
  portal: string;
  description?: string;
  fieldMap: Record<string, string>;
  transformations?: ConnectorConfig['transformations'];
  templateIds: string[];
}

/**
 * Extract unique connector configurations from templates
 */
async function extractConnectorConfigs(): Promise<Map<string, ConnectorSummary>> {
  const connectors = new Map<string, ConnectorSummary>();
  let continuationToken: string | undefined;

  do {
    const result = await listFormTemplates({
      continuationToken,
      pageSize: 100
    });

    for (const template of result.items) {
      if (template.connectors) {
        for (const connector of template.connectors) {
          const key = connector.portal.toLowerCase();
          
          if (!connectors.has(key)) {
            connectors.set(key, {
              portal: connector.portal,
              description: connector.description,
              fieldMap: connector.fieldMap || {},
              transformations: connector.transformations,
              templateIds: []
            });
          }

          const summary = connectors.get(key)!;
          if (!summary.templateIds.includes(template.templateId)) {
            summary.templateIds.push(template.templateId);
          }
        }
      }
    }

    continuationToken = result.continuationToken;
  } while (continuationToken);

  return connectors;
}

/**
 * Convert legacy transformations to JSONata expressions
 */
function convertTransformations(
  transformations?: ConnectorConfig['transformations']
): Record<string, string> {
  const jsonataExpressions: Record<string, string> = {};

  if (!transformations) {
    return jsonataExpressions;
  }

  for (const [targetField, config] of Object.entries(transformations)) {
    if (config.type === 'concat') {
      const fields = config.fields.map(f => f).join(' & " " & ');
      jsonataExpressions[targetField] = fields;
    }
  }

  return jsonataExpressions;
}

/**
 * Create portal definition from connector summary
 */
function createPortalDefinition(
  summary: ConnectorSummary
): Omit<PortalDefinition, 'createdAt' | 'updatedAt'> {
  const portalId = summary.portal.toLowerCase().replace(/\s+/g, '-');
  
  // Build field definitions from field map
  const fieldDefinitions: Record<string, FieldDefinition> = {};
  for (const targetField of Object.values(summary.fieldMap)) {
    if (!fieldDefinitions[targetField]) {
      fieldDefinitions[targetField] = {
        type: 'string', // Default type
        required: false
      };
    }
  }

  // Build default mappings
  const defaultMappings: PortalDefinition['defaultMappings'] = {};
  for (const [sourceField, targetField] of Object.entries(summary.fieldMap)) {
    defaultMappings[sourceField] = {
      targetField
    };
  }

  // Add transformations
  const transformationExpressions = convertTransformations(summary.transformations);
  for (const [targetField, expression] of Object.entries(transformationExpressions)) {
    // Find source field that maps to this target
    const sourceField = Object.entries(summary.fieldMap).find(
      ([_, tf]) => tf === targetField
    )?.[0];

    if (sourceField) {
      defaultMappings[sourceField] = {
        targetField,
        transformation: expression
      };
    }
  }

  return {
    portalId,
    name: summary.portal,
    description: summary.description,
    fieldDefinitions,
    defaultMappings
  };
}

/**
 * Main migration function
 */
async function migrateConnectorConfigs(dryRun: boolean = true): Promise<void> {
  console.log('Starting connector config migration...');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'LIVE'}`);

  // Extract all connector configs
  console.log('Extracting connector configurations from templates...');
  const connectors = await extractConnectorConfigs();
  console.log(`Found ${connectors.size} unique connector configurations`);

  const results = {
    created: 0,
    skipped: 0,
    errors: 0
  };

  // Create portal definitions
  for (const [key, summary] of connectors.entries()) {
    try {
      const portalDef = createPortalDefinition(summary);
      
      // Check if portal already exists
      const existing = await getPortal(portalDef.portalId);
      if (existing) {
        console.log(`Portal ${portalDef.portalId} already exists, skipping...`);
        results.skipped++;
        continue;
      }

      if (dryRun) {
        console.log(`[DRY RUN] Would create portal: ${portalDef.portalId}`);
        console.log(`  Name: ${portalDef.name}`);
        console.log(`  Mappings: ${Object.keys(portalDef.defaultMappings).length}`);
        console.log(`  Used in ${summary.templateIds.length} templates`);
        results.created++;
      } else {
        await createPortal(portalDef);
        console.log(`Created portal: ${portalDef.portalId}`);
        results.created++;
      }
    } catch (error) {
      console.error(`Error processing connector ${key}:`, error);
      results.errors++;
    }
  }

  console.log('\nMigration Summary:');
  console.log(`  Created: ${results.created}`);
  console.log(`  Skipped: ${results.skipped}`);
  console.log(`  Errors: ${results.errors}`);

  if (dryRun) {
    console.log('\nThis was a dry run. Run with dryRun=false to actually create portals.');
  }
}

// Run migration if executed directly
if (require.main === module) {
  const dryRun = process.argv.includes('--live') ? false : true;
  migrateConnectorConfigs(dryRun)
    .then(() => {
      console.log('Migration completed');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Migration failed:', error);
      process.exit(1);
    });
}

export { migrateConnectorConfigs };

