/**
 * Team Model - stored in Cosmos DB teams container
 * Partition Key: /teamId
 */

/**
 * Team types
 */
export type TeamType =
  | 'sales'
  | 'underwriting'
  | 'support'
  | 'compliance'
  | 'mixed';

/**
 * Team Document
 */
export interface TeamDocument {
  /** Document ID (UUID) */
  id: string;

  /** Team ID - Partition key */
  teamId: string;

  /** Team name */
  name: string;

  /** Team description */
  description?: string;

  /** Team type */
  type: TeamType;

  /** Staff ID of team leader */
  leaderId: string;

  /** Leader email */
  leaderEmail: string;

  /** Member staff IDs */
  memberIds: string[];

  /** Member count */
  memberCount: number;

  /** Territories this team handles */
  territories: string[];

  /** Specializations (e.g., 'life_insurance', 'motor', 'health') */
  specializations?: string[];

  /** Organization ID */
  organizationId: string;

  /** Parent team ID (for hierarchical teams) */
  parentTeamId?: string;

  /** Whether team is active */
  isActive: boolean;

  /** Created timestamp */
  createdAt: string;

  /** Created by user ID */
  createdBy: string;

  /** Updated timestamp */
  updatedAt: string;

  /** Updated by user ID */
  updatedBy: string;
}

/**
 * Create team request
 */
export interface CreateTeamRequest {
  name: string;
  description?: string;
  type: TeamType;
  leaderId: string;
  territories?: string[];
  specializations?: string[];
  organizationId?: string;
  parentTeamId?: string;
}

/**
 * Update team request
 */
export interface UpdateTeamRequest {
  name?: string;
  description?: string;
  type?: TeamType;
  leaderId?: string;
  territories?: string[];
  specializations?: string[];
  parentTeamId?: string;
  isActive?: boolean;
}

/**
 * Team list query parameters
 */
export interface TeamListQuery {
  type?: TeamType;
  territory?: string;
  isActive?: boolean;
  limit?: number;
  offset?: number;
}

/**
 * Team list response
 */
export interface TeamListResponse {
  total: number;
  limit: number;
  offset: number;
  teams: TeamSummary[];
}

/**
 * Team summary (for list responses)
 */
export interface TeamSummary {
  teamId: string;
  name: string;
  type: TeamType;
  leaderId: string;
  leaderEmail: string;
  memberCount: number;
  territories: string[];
  isActive: boolean;
}

/**
 * Add team member response
 */
export interface AddTeamMemberResponse {
  teamId: string;
  staffId: string;
  memberCount: number;
  addedAt: string;
}

/**
 * Remove team member response
 */
export interface RemoveTeamMemberResponse {
  teamId: string;
  staffId: string;
  memberCount: number;
  removedAt: string;
}

