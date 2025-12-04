/**
 * Territory Repository - CRUD operations for territories
 */

import { getTerritoriesContainer } from './cosmosClient';
import {
  TerritoryDocument,
  TerritoryWithCounts,
  UAE_TERRITORIES,
} from '../models/Territory';

/**
 * Find territory by ID
 */
export async function findTerritoryById(territoryId: string): Promise<TerritoryDocument | null> {
  const container = getTerritoriesContainer();

  try {
    const { resource } = await container.item(territoryId, territoryId).read<TerritoryDocument>();
    return resource || null;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * List all territories with counts
 */
export async function listTerritories(): Promise<TerritoryWithCounts[]> {
  const container = getTerritoriesContainer();

  const { resources } = await container.items
    .query<TerritoryDocument>('SELECT * FROM c WHERE c.isActive = true ORDER BY c.name')
    .fetchAll();

  return resources.map((t) => ({
    id: t.id,
    name: t.name,
    region: t.region,
    parentTerritory: t.parentTerritory,
    isActive: t.isActive,
    assignedTeamCount: t.assignedTeamIds.length,
    assignedStaffCount: t.assignedStaffIds.length,
  }));
}

/**
 * Update territory staff assignments
 */
export async function updateTerritoryStaffAssignment(
  territoryId: string,
  staffId: string,
  operation: 'add' | 'remove'
): Promise<TerritoryDocument> {
  const container = getTerritoriesContainer();
  const territory = await findTerritoryById(territoryId);

  if (!territory) {
    throw new Error(`Territory "${territoryId}" not found`);
  }

  const now = new Date().toISOString();
  let assignedStaffIds = territory.assignedStaffIds;

  if (operation === 'add') {
    if (!assignedStaffIds.includes(staffId)) {
      assignedStaffIds = [...assignedStaffIds, staffId];
    }
  } else {
    assignedStaffIds = assignedStaffIds.filter((id) => id !== staffId);
  }

  const updated: TerritoryDocument = {
    ...territory,
    assignedStaffIds,
    updatedAt: now,
  };

  const { resource } = await container.item(territoryId, territoryId).replace(updated);

  if (!resource) {
    throw new Error('Failed to update territory');
  }

  return resource;
}

/**
 * Seed default territories
 */
export async function seedTerritories(): Promise<void> {
  const container = getTerritoriesContainer();
  const now = new Date().toISOString();

  for (const territory of UAE_TERRITORIES) {
    const existing = await findTerritoryById(territory.id);
    if (!existing) {
      const doc: TerritoryDocument = {
        ...territory,
        createdAt: now,
        updatedAt: now,
      };
      await container.items.create(doc);
      console.log(`Created territory: ${territory.name}`);
    } else {
      console.log(`Territory already exists: ${territory.name}`);
    }
  }
}

