/**
 * Territory Model - stored in Cosmos DB territories container
 * Partition Key: /id
 */

/**
 * Territory metadata
 */
export interface TerritoryMetadata {
  population?: number;
  insuranceMarketSize?: number;
  primaryLanguages?: string[];
}

/**
 * Territory Document
 */
export interface TerritoryDocument {
  /** Territory ID (e.g., 'dubai', 'abu-dhabi') */
  id: string;

  /** Display name (e.g., 'Dubai') */
  name: string;

  /** Region (e.g., 'UAE') */
  region: string;

  /** Parent territory ID (for sub-regions) */
  parentTerritory?: string;

  /** Child territory IDs */
  childTerritories?: string[];

  /** Assigned team IDs */
  assignedTeamIds: string[];

  /** Assigned staff IDs */
  assignedStaffIds: string[];

  /** Whether territory is active */
  isActive: boolean;

  /** Additional metadata */
  metadata?: TerritoryMetadata;

  /** Created timestamp */
  createdAt: string;

  /** Updated timestamp */
  updatedAt: string;
}

/**
 * Territory list response
 */
export interface TerritoryListResponse {
  territories: TerritoryWithCounts[];
}

/**
 * Territory with assignment counts
 */
export interface TerritoryWithCounts {
  id: string;
  name: string;
  region: string;
  parentTerritory?: string;
  isActive: boolean;
  assignedTeamCount: number;
  assignedStaffCount: number;
}

/**
 * Assign territory request
 */
export interface AssignTerritoryRequest {
  territories: string[];
  operation: 'add' | 'remove' | 'replace';
}

/**
 * Assign territory response
 */
export interface AssignTerritoryResponse {
  staffId: string;
  previousTerritories: string[];
  currentTerritories: string[];
  updatedAt: string;
}

/**
 * Default UAE territories
 */
export const UAE_TERRITORIES: Omit<TerritoryDocument, 'createdAt' | 'updatedAt'>[] = [
  {
    id: 'dubai',
    name: 'Dubai',
    region: 'UAE',
    assignedTeamIds: [],
    assignedStaffIds: [],
    isActive: true,
  },
  {
    id: 'abu-dhabi',
    name: 'Abu Dhabi',
    region: 'UAE',
    assignedTeamIds: [],
    assignedStaffIds: [],
    isActive: true,
  },
  {
    id: 'sharjah',
    name: 'Sharjah',
    region: 'UAE',
    assignedTeamIds: [],
    assignedStaffIds: [],
    isActive: true,
  },
  {
    id: 'ajman',
    name: 'Ajman',
    region: 'UAE',
    assignedTeamIds: [],
    assignedStaffIds: [],
    isActive: true,
  },
  {
    id: 'ras-al-khaimah',
    name: 'Ras Al Khaimah',
    region: 'UAE',
    assignedTeamIds: [],
    assignedStaffIds: [],
    isActive: true,
  },
  {
    id: 'fujairah',
    name: 'Fujairah',
    region: 'UAE',
    assignedTeamIds: [],
    assignedStaffIds: [],
    isActive: true,
  },
  {
    id: 'umm-al-quwain',
    name: 'Umm Al Quwain',
    region: 'UAE',
    assignedTeamIds: [],
    assignedStaffIds: [],
    isActive: true,
  },
];

