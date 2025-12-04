/**
 * Team Repository - CRUD operations for teams
 */

import { v4 as uuidv4 } from 'uuid';
import { getTeamsContainer } from './cosmosClient';
import { findStaffById, updateStaffTeams } from './staffRepository';
import {
  TeamDocument,
  CreateTeamRequest,
  UpdateTeamRequest,
  TeamListQuery,
  TeamListResponse,
  TeamSummary,
} from '../models/Team';

/**
 * Create a new team
 */
export async function createTeam(
  request: CreateTeamRequest,
  createdBy: string
): Promise<TeamDocument> {
  const container = getTeamsContainer();
  const now = new Date().toISOString();
  const teamId = uuidv4();

  // Get leader info
  const leader = await findStaffById(request.leaderId);
  if (!leader) {
    throw new Error(`Leader "${request.leaderId}" not found`);
  }

  const document: TeamDocument = {
    id: teamId,
    teamId,
    name: request.name,
    description: request.description,
    type: request.type,
    leaderId: request.leaderId,
    leaderEmail: leader.email,
    memberIds: [request.leaderId], // Leader is automatically a member
    memberCount: 1,
    territories: request.territories || [],
    specializations: request.specializations,
    organizationId: request.organizationId || 'default',
    parentTeamId: request.parentTeamId,
    isActive: true,
    createdAt: now,
    createdBy,
    updatedAt: now,
    updatedBy: createdBy,
  };

  const { resource } = await container.items.create(document);

  if (!resource) {
    throw new Error('Failed to create team');
  }

  // Add team to leader's teamIds
  await updateStaffTeams(
    request.leaderId,
    [...leader.teamIds, teamId],
    createdBy
  );

  return resource;
}

/**
 * Find team by ID
 */
export async function findTeamById(teamId: string): Promise<TeamDocument | null> {
  const container = getTeamsContainer();

  try {
    const { resource } = await container.item(teamId, teamId).read<TeamDocument>();
    return resource || null;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * List teams with filters
 */
export async function listTeams(query: TeamListQuery): Promise<TeamListResponse> {
  const container = getTeamsContainer();
  const limit = query.limit || 50;
  const offset = query.offset || 0;

  let queryText = 'SELECT * FROM c WHERE 1=1';
  const parameters: { name: string; value: string | boolean }[] = [];

  // Filter by active status
  if (query.isActive !== undefined) {
    queryText += ' AND c.isActive = @isActive';
    parameters.push({ name: '@isActive', value: query.isActive });
  }

  // Filter by type
  if (query.type) {
    queryText += ' AND c.type = @type';
    parameters.push({ name: '@type', value: query.type });
  }

  // Filter by territory
  if (query.territory) {
    queryText += ' AND ARRAY_CONTAINS(c.territories, @territory)';
    parameters.push({ name: '@territory', value: query.territory });
  }

  // Count total
  const countQuery = queryText.replace('SELECT *', 'SELECT VALUE COUNT(1)');
  const { resources: countResult } = await container.items
    .query({ query: countQuery, parameters })
    .fetchAll();
  const total = countResult[0] || 0;

  // Add pagination
  queryText += ' ORDER BY c.name OFFSET @offset LIMIT @limit';
  parameters.push({ name: '@offset', value: offset.toString() });
  parameters.push({ name: '@limit', value: limit.toString() });

  const { resources } = await container.items
    .query<TeamDocument>({ query: queryText, parameters })
    .fetchAll();

  // Map to summary
  const teams: TeamSummary[] = resources.map((t) => ({
    teamId: t.teamId,
    name: t.name,
    type: t.type,
    leaderId: t.leaderId,
    leaderEmail: t.leaderEmail,
    memberCount: t.memberCount,
    territories: t.territories,
    isActive: t.isActive,
  }));

  return {
    total,
    limit,
    offset,
    teams,
  };
}

/**
 * Update team
 */
export async function updateTeam(
  teamId: string,
  updates: UpdateTeamRequest,
  updatedBy: string
): Promise<TeamDocument> {
  const container = getTeamsContainer();
  const existing = await findTeamById(teamId);

  if (!existing) {
    throw new Error(`Team "${teamId}" not found`);
  }

  // If changing leader, get new leader info
  let leaderEmail = existing.leaderEmail;
  if (updates.leaderId && updates.leaderId !== existing.leaderId) {
    const newLeader = await findStaffById(updates.leaderId);
    if (!newLeader) {
      throw new Error(`New leader "${updates.leaderId}" not found`);
    }
    leaderEmail = newLeader.email;
  }

  const now = new Date().toISOString();
  const updated: TeamDocument = {
    ...existing,
    name: updates.name ?? existing.name,
    description: updates.description ?? existing.description,
    type: updates.type ?? existing.type,
    leaderId: updates.leaderId ?? existing.leaderId,
    leaderEmail,
    territories: updates.territories ?? existing.territories,
    specializations: updates.specializations ?? existing.specializations,
    parentTeamId: updates.parentTeamId ?? existing.parentTeamId,
    isActive: updates.isActive ?? existing.isActive,
    updatedAt: now,
    updatedBy,
  };

  const { resource } = await container.item(teamId, teamId).replace(updated);

  if (!resource) {
    throw new Error('Failed to update team');
  }

  return resource;
}

/**
 * Delete team
 */
export async function deleteTeam(teamId: string): Promise<void> {
  const container = getTeamsContainer();
  const existing = await findTeamById(teamId);

  if (!existing) {
    throw new Error(`Team "${teamId}" not found`);
  }

  if (existing.memberCount > 0) {
    throw new Error('Cannot delete team with active members');
  }

  await container.item(teamId, teamId).delete();
}

/**
 * Add member to team
 */
export async function addTeamMember(
  teamId: string,
  staffId: string,
  updatedBy: string
): Promise<TeamDocument> {
  const container = getTeamsContainer();
  const team = await findTeamById(teamId);

  if (!team) {
    throw new Error(`Team "${teamId}" not found`);
  }

  const staff = await findStaffById(staffId);
  if (!staff) {
    throw new Error(`Staff member "${staffId}" not found`);
  }

  // Check if already a member
  if (team.memberIds.includes(staffId)) {
    throw new Error(`Staff member "${staffId}" is already a member of this team`);
  }

  const now = new Date().toISOString();
  const updated: TeamDocument = {
    ...team,
    memberIds: [...team.memberIds, staffId],
    memberCount: team.memberCount + 1,
    updatedAt: now,
    updatedBy,
  };

  const { resource } = await container.item(teamId, teamId).replace(updated);

  if (!resource) {
    throw new Error('Failed to add team member');
  }

  // Update staff's teamIds
  await updateStaffTeams(staffId, [...staff.teamIds, teamId], updatedBy);

  return resource;
}

/**
 * Remove member from team
 */
export async function removeTeamMember(
  teamId: string,
  staffId: string,
  updatedBy: string
): Promise<TeamDocument> {
  const container = getTeamsContainer();
  const team = await findTeamById(teamId);

  if (!team) {
    throw new Error(`Team "${teamId}" not found`);
  }

  const staff = await findStaffById(staffId);
  if (!staff) {
    throw new Error(`Staff member "${staffId}" not found`);
  }

  // Check if member
  if (!team.memberIds.includes(staffId)) {
    throw new Error(`Staff member "${staffId}" is not a member of this team`);
  }

  // Cannot remove leader
  if (team.leaderId === staffId) {
    throw new Error('Cannot remove team leader from team');
  }

  // Check if staff would have no teams left
  if (staff.teamIds.length <= 1) {
    throw new Error('Staff member must belong to at least one team');
  }

  const now = new Date().toISOString();
  const updated: TeamDocument = {
    ...team,
    memberIds: team.memberIds.filter((id) => id !== staffId),
    memberCount: team.memberCount - 1,
    updatedAt: now,
    updatedBy,
  };

  const { resource } = await container.item(teamId, teamId).replace(updated);

  if (!resource) {
    throw new Error('Failed to remove team member');
  }

  // Update staff's teamIds
  await updateStaffTeams(
    staffId,
    staff.teamIds.filter((id) => id !== teamId),
    updatedBy
  );

  return resource;
}

