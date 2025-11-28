import { ConnectorConfig, FormIntake, FormTemplate } from '../models/formTypes';
import { PortalDefinition, FieldMapping } from '../models/portalTypes';
import { getPortal } from './portalRepository';
import { evaluateTransformation } from './transformationEngine';

/**
 * Apply legacy transformations (backward compatibility)
 */
const applyLegacyTransformations = (
  data: Record<string, unknown>,
  transformations?: ConnectorConfig['transformations']
): Record<string, unknown> => {
  if (!transformations) {
    return {};
  }

  const result: Record<string, unknown> = {};
  Object.entries(transformations).forEach(([targetField, config]) => {
    if (config.type === 'concat') {
      const values = config.fields
        .map((key) => data[key])
        .filter((value): value is string => typeof value === 'string');
      if (values.length === config.fields.length) {
        result[targetField] = values.join(config.separator ?? ' ');
      }
    }
  });
  return result;
};

/**
 * Merge portal default mappings with template-specific overrides
 * Template overrides take precedence
 */
export const mergePortalAndTemplateMappings = (
  portalDefaults: PortalDefinition['defaultMappings'],
  templateOverrides: ConnectorConfig['fieldMap']
): Record<string, FieldMapping> => {
  const merged: Record<string, FieldMapping> = { ...portalDefaults };

  // Apply template overrides (template wins)
  Object.entries(templateOverrides).forEach(([sourceField, targetField]) => {
    merged[sourceField] = {
      targetField,
      transformation: portalDefaults[sourceField]?.transformation // Keep transformation if exists
    };
  });

  return merged;
};

/**
 * Get effective mappings (portal defaults merged with template overrides)
 */
export const getEffectiveMappings = (
  portalDefaults: PortalDefinition['defaultMappings'],
  templateOverrides: ConnectorConfig['fieldMap']
): Record<string, FieldMapping> => {
  return mergePortalAndTemplateMappings(portalDefaults, templateOverrides);
};

/**
 * Apply field mappings and transformations
 */
const applyMappings = async (
  data: Record<string, unknown>,
  mappings: Record<string, FieldMapping>
): Promise<Record<string, unknown>> => {
  const result: Record<string, unknown> = {};

  for (const [sourceField, mapping] of Object.entries(mappings)) {
    // If there's a transformation, apply it (transformations can reference multiple fields)
    if (mapping.transformation) {
      const transformed = await evaluateTransformation(mapping.transformation, data);
      if (transformed !== undefined) {
        result[mapping.targetField] = transformed;
      }
    } else if (data[sourceField] !== undefined) {
      // Simple field mapping - only if source field exists
      result[mapping.targetField] = data[sourceField];
    }
  }

  return result;
};

/**
 * Normalize form data for connectors with portal registry support
 * @param template - Form template with connector configs
 * @param intake - Form intake with raw data
 * @param portals - Optional array of portal definitions. If not provided, uses legacy mode (no registry lookup)
 */
export const normalizeFormDataForConnectors = async (
  template: FormTemplate,
  intake: FormIntake,
  portals?: PortalDefinition[]
): Promise<Record<string, Record<string, unknown>>> => {
  const normalized: Record<string, Record<string, unknown>> = {};

  if (!template.connectors || template.connectors.length === 0) {
    return normalized;
  }

  for (const connector of template.connectors) {
    let portal: PortalDefinition | null = null;

    // Try to find portal in provided array
    // If portals is not provided (undefined), skip registry and use legacy behavior
    if (portals) {
      portal = portals.find(p => p.portalId === connector.portal) || null;
    }

    let mapped: Record<string, unknown> = {};

    if (portal && !portal.isDeleted) {
      // Use portal registry with template overrides
      const effectiveMappings = getEffectiveMappings(
        portal.defaultMappings,
        connector.fieldMap || {}
      );
      mapped = await applyMappings(intake.formDataRaw, effectiveMappings);
    } else {
      // Fallback to legacy behavior (backward compatibility)
      Object.entries(connector.fieldMap || {}).forEach(([sourceKey, destinationKey]) => {
      if (intake.formDataRaw[sourceKey] !== undefined) {
        mapped[destinationKey] = intake.formDataRaw[sourceKey];
      }
    });

      // Apply legacy transformations
      const transformed = applyLegacyTransformations(
      intake.formDataRaw,
      connector.transformations
    );
      mapped = { ...mapped, ...transformed };
    }

    normalized[connector.portal] = mapped;
  }

  return normalized;
};

