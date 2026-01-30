/**
 * Staff Repository - CRUD operations for staff members
 */

import { v4 as uuidv4 } from 'uuid';
import { getStaffContainer } from './cosmosClient';
import {
  StaffMemberDocument,
  CreateStaffRequest,
  UpdateStaffRequest,
  StaffListQuery,
  StaffListResponse,
  StaffSummary,
  Workload,
  Availability,
} from '../models/StaffMember';

/**
 * Create a new staff member
 */
export async function createStaff(
  request: CreateStaffRequest,
  createdBy: string
): Promise<StaffMemberDocument> {
  const container = getStaffContainer();
  const now = new Date().toISOString();
  const staffId = uuidv4();

  // Handle displayName: use firstName only if lastName is empty
  const displayName = request.lastName 
    ? `${request.firstName} ${request.lastName}`.trim()
    : request.firstName;

  const document: StaffMemberDocument = {
    id: staffId,
    staffId,
    email: request.email.toLowerCase(),
    firstName: request.firstName,
    lastName: request.lastName || '', // Default to empty string if not provided
    displayName,
    phone: request.phone,
    staffType: request.staffType,
    status: 'active',
    createdAt: now,
    createdBy,
    updatedAt: now,
    updatedBy: createdBy,
  };

  const { resource } = await container.items.create(document);

  if (!resource) {
    throw new Error('Failed to create staff member');
  }

  return resource;
}

/**
 * Find staff member by ID
 */
export async function findStaffById(staffId: string): Promise<StaffMemberDocument | null> {
  const container = getStaffContainer();

  try {
    const { resource } = await container.item(staffId, staffId).read<StaffMemberDocument>();
    return resource || null;
  } catch (error: unknown) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 404) {
      return null;
    }
    throw error;
  }
}

/**
 * Find staff member by email
 */
export async function findStaffByEmail(email: string): Promise<StaffMemberDocument | null> {
  const container = getStaffContainer();

  const { resources } = await container.items
    .query<StaffMemberDocument>({
      query: 'SELECT * FROM c WHERE c.email = @email',
      parameters: [{ name: '@email', value: email.toLowerCase() }],
    })
    .fetchAll();

  return resources[0] || null;
}

/**
 * Find staff member by Azure AD ID
 */
export async function findStaffByAzureAdId(azureAdId: string): Promise<StaffMemberDocument | null> {
  const container = getStaffContainer();

  const { resources } = await container.items
    .query<StaffMemberDocument>({
      query: 'SELECT * FROM c WHERE c.azureAdId = @azureAdId',
      parameters: [{ name: '@azureAdId', value: azureAdId }],
    })
    .fetchAll();

  return resources[0] || null;
}

/**
 * Find staff member by employee ID
 */
export async function findStaffByEmployeeId(employeeId: string): Promise<StaffMemberDocument | null> {
  const container = getStaffContainer();

  const { resources } = await container.items
    .query<StaffMemberDocument>({
      query: 'SELECT * FROM c WHERE c.employeeId = @employeeId',
      parameters: [{ name: '@employeeId', value: employeeId }],
    })
    .fetchAll();

  return resources[0] || null;
}

/**
 * List staff members with filters
 */
export async function listStaff(query: StaffListQuery): Promise<StaffListResponse> {
  const container = getStaffContainer();
  const limit = query.limit || 50;
  const offset = query.offset || 0;

  let queryText = 'SELECT * FROM c WHERE 1=1';
  const parameters: { name: string; value: string | number }[] = [];

  // Filter out soft-deleted staff by default
  queryText += ' AND (NOT IS_DEFINED(c.deletedAt) OR c.deletedAt = null)';

  // Filter by status (default: active)
  const status = query.status || 'active';
  queryText += ' AND c.status = @status';
  parameters.push({ name: '@status', value: status });

  // Filter by staff type
  if (query.staffType) {
    queryText += ' AND c.staffType = @staffType';
    parameters.push({ name: '@staffType', value: query.staffType });
  }

  // Search by name or email
  if (query.search) {
    queryText += ' AND (CONTAINS(LOWER(c.displayName), @search) OR CONTAINS(LOWER(c.email), @search))';
    parameters.push({ name: '@search', value: query.search.toLowerCase() });
  }

  // Count total
  const countQuery = queryText.replace('SELECT *', 'SELECT VALUE COUNT(1)');
  const { resources: countResult } = await container.items
    .query({ query: countQuery, parameters })
    .fetchAll();
  const total = countResult[0] || 0;

  // Add pagination
  queryText += ' ORDER BY c.displayName OFFSET @offset LIMIT @limit';
  parameters.push({ name: '@offset', value: offset });
  parameters.push({ name: '@limit', value: limit });

  const { resources } = await container.items
    .query<StaffMemberDocument>({ query: queryText, parameters })
    .fetchAll();

  // Map to summary
  const staff: StaffSummary[] = resources.map((s) => ({
    staffId: s.staffId,
    displayName: s.displayName,
    email: s.email,
    phone: s.phone,
    staffType: s.staffType,
  }));

  return {
    total,
    limit,
    offset,
    staff,
  };
}

/**
 * Update staff member
 */
export async function updateStaff(
  staffId: string,
  updates: UpdateStaffRequest,
  updatedBy: string
): Promise<StaffMemberDocument> {
  const container = getStaffContainer();
  const existing = await findStaffById(staffId);

  if (!existing) {
    throw new Error(`Staff member "${staffId}" not found`);
  }

  const now = new Date().toISOString();
  const updated: StaffMemberDocument = {
    ...existing,
    email: updates.email ?? existing.email,
    firstName: updates.firstName ?? existing.firstName,
    lastName: updates.lastName ?? existing.lastName,
    displayName: updates.firstName || updates.lastName
      ? `${updates.firstName ?? existing.firstName} ${updates.lastName ?? existing.lastName}`
      : existing.displayName,
    phone: updates.phone ?? existing.phone,
    staffType: updates.staffType ?? existing.staffType,
    updatedAt: now,
    updatedBy,
  };

  const { resource } = await container.item(staffId, staffId).replace(updated);

  if (!resource) {
    throw new Error('Failed to update staff member');
  }

  return resource;
}

/**
 * Update staff status
 */
export async function updateStaffStatus(
  staffId: string,
  status: StaffMemberDocument['status'],
  availability: Availability,
  reason: string | undefined,
  updatedBy: string
): Promise<StaffMemberDocument> {
  const container = getStaffContainer();
  const existing = await findStaffById(staffId);

  if (!existing) {
    throw new Error(`Staff member "${staffId}" not found`);
  }

  const now = new Date().toISOString();
  const updated: StaffMemberDocument = {
    ...existing,
    status,
    statusChangedAt: now,
    statusReason: reason,
    availability: availability,
    updatedAt: now,
    updatedBy,
  };

  const { resource } = await container.item(staffId, staffId).replace(updated);

  if (!resource) {
    throw new Error('Failed to update staff status');
  }

  return resource;
}

/**
 * Update staff workload
 */
export async function updateStaffWorkload(
  staffId: string,
  workload: Partial<Workload>
): Promise<StaffMemberDocument> {
  const container = getStaffContainer();
  const existing = await findStaffById(staffId);

  if (!existing) {
    throw new Error(`Staff member "${staffId}" not found`);
  }

  const updated: StaffMemberDocument = {
    ...existing,
    workload: {
      ...(existing.workload || { activeLeads: 0, activeCustomers: 0, activePolicies: 0, pendingApprovals: 0 }),
      ...workload,
    },
    updatedAt: new Date().toISOString(),
  };

  const { resource } = await container.item(staffId, staffId).replace(updated);

  if (!resource) {
    throw new Error('Failed to update staff workload');
  }

  return resource;
}

/**
 * Update staff territories
 */
export async function updateStaffTerritories(
  staffId: string,
  territories: string[],
  updatedBy: string
): Promise<StaffMemberDocument> {
  const container = getStaffContainer();
  const existing = await findStaffById(staffId);

  if (!existing) {
    throw new Error(`Staff member "${staffId}" not found`);
  }

  const now = new Date().toISOString();
  const updated: StaffMemberDocument = {
    ...existing,
    territories,
    updatedAt: now,
    updatedBy,
  };

  const { resource } = await container.item(staffId, staffId).replace(updated);

  if (!resource) {
    throw new Error('Failed to update staff territories');
  }

  return resource;
}

/**
 * Update staff team IDs
 */
export async function updateStaffTeams(
  staffId: string,
  teamIds: string[],
  updatedBy: string
): Promise<StaffMemberDocument> {
  const container = getStaffContainer();
  const existing = await findStaffById(staffId);

  if (!existing) {
    throw new Error(`Staff member "${staffId}" not found`);
  }

  const now = new Date().toISOString();
  const updated: StaffMemberDocument = {
    ...existing,
    teamIds,
    updatedAt: now,
    updatedBy,
  };

  const { resource } = await container.item(staffId, staffId).replace(updated);

  if (!resource) {
    throw new Error('Failed to update staff teams');
  }

  return resource;
}

/**
 * Get staff with expiring licenses
 */
export async function getStaffWithExpiringLicenses(
  daysUntilExpiry: number
): Promise<StaffMemberDocument[]> {
  const container = getStaffContainer();
  const futureDate = new Date();
  futureDate.setDate(futureDate.getDate() + daysUntilExpiry);
  const futureDateStr = futureDate.toISOString().split('T')[0];
  const todayStr = new Date().toISOString().split('T')[0];

  const { resources } = await container.items
    .query<StaffMemberDocument>({
      query: `
        SELECT * FROM c 
        WHERE c.status = 'active' 
        AND IS_DEFINED(c.licenses) 
        AND ARRAY_LENGTH(c.licenses) > 0
      `,
      parameters: [],
    })
    .fetchAll();

  // Filter in memory for license expiry
  return resources.filter((staff) => {
    if (!staff.licenses) return false;
    return staff.licenses.some((license) => {
      const expiryDate = license.expiryDate.split('T')[0];
      return expiryDate >= todayStr && expiryDate <= futureDateStr;
    });
  });
}

/**
 * Delete staff member (soft delete)
 */
export async function deleteStaff(
  staffId: string,
  deletedBy: string
): Promise<StaffMemberDocument> {
  const container = getStaffContainer();
  const existing = await findStaffById(staffId);

  if (!existing) {
    throw new Error(`Staff member "${staffId}" not found`);
  }

  if (existing.deletedAt) {
    throw new Error('Staff member already deleted');
  }

  const now = new Date().toISOString();
  const updated: StaffMemberDocument = {
    ...existing,
    status: 'terminated',
    statusChangedAt: now,
    statusReason: 'Deleted from system',
    deletedAt: now,
    deletedBy,
    updatedAt: now,
    updatedBy: deletedBy,
  };

  const { resource } = await container.item(staffId, staffId).replace(updated);

  if (!resource) {
    throw new Error('Failed to delete staff member');
  }

  return resource;
}

