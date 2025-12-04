/**
 * Assignment Engine - Auto-assignment scoring and matching
 */

import { StaffMemberDocument, StaffType } from '../models/StaffMember';
import { TeamDocument } from '../models/Team';
import { calculateLeadUtilization, canAcceptNewLead, canAcceptNewCustomer } from './workloadService';
import { canAcceptAssignments } from './statusService';

/**
 * Assignment type
 */
export type AssignmentType = 'lead' | 'customer' | 'policy';

/**
 * Assignment urgency
 */
export type AssignmentUrgency = 'normal' | 'high' | 'critical';

/**
 * Assignment criteria
 */
export interface AssignmentCriteria {
  assignmentType: AssignmentType;
  territory: string;
  specialization?: string;
  currentOwnerId?: string;
  preferredTeamId?: string;
  urgency?: AssignmentUrgency;
}

/**
 * Scoring factors
 */
export interface ScoringFactors {
  territoryMatch: boolean;
  specializationMatch: boolean;
  workloadCapacity: number;
  performanceScore: number;
  availability: boolean;
}

/**
 * Staff recommendation
 */
export interface StaffRecommendation {
  staffId: string;
  displayName: string;
  email: string;
  score: number;
  factors: ScoringFactors;
}

/**
 * Assignment result
 */
export interface AssignmentResult {
  recommendedStaff: StaffRecommendation[];
  fallbackStaff?: {
    staffId: string;
    displayName: string;
    reason: string;
  };
}

/**
 * Assignment weights
 */
export const ASSIGNMENT_WEIGHTS = {
  territoryMatch: 0.30,
  specializationMatch: 0.20,
  workloadCapacity: 0.25,
  performanceScore: 0.15,
  availability: 0.10,
} as const;

/**
 * Check if staff has territory match
 */
export function hasTerritoryMatch(staff: StaffMemberDocument, territory: string): boolean {
  return staff.territories.includes(territory);
}

/**
 * Check if staff has specialization match
 */
export function hasSpecializationMatch(
  staff: StaffMemberDocument,
  specialization: string | undefined,
  teams: TeamDocument[]
): boolean {
  if (!specialization) {
    return true; // No specialization required
  }

  // Check team specializations
  const staffTeams = teams.filter((t) => staff.teamIds.includes(t.teamId));
  for (const team of staffTeams) {
    if (team.specializations?.includes(specialization)) {
      return true;
    }
  }

  // Check license types for brokers
  if (staff.licenses) {
    for (const license of staff.licenses) {
      if (license.licenseType.toLowerCase().includes(specialization.toLowerCase())) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Calculate workload capacity score (1 = empty, 0 = full)
 */
export function calculateWorkloadCapacity(staff: StaffMemberDocument): number {
  const utilization = calculateLeadUtilization(staff.workload);
  return Math.max(0, 1 - utilization);
}

/**
 * Calculate performance score (0-1)
 */
export function calculatePerformanceScore(staff: StaffMemberDocument): number {
  if (!staff.performance) {
    return 0.5; // Default score for no history
  }

  const { leadsConverted, leadsReceived } = staff.performance;
  if (!leadsReceived || leadsReceived === 0) {
    return 0.5;
  }

  // Conversion rate as performance indicator
  const conversionRate = leadsConverted / leadsReceived;
  return Math.min(1, conversionRate);
}

/**
 * Check if staff is available for assignment
 */
export function isAvailableForAssignment(
  staff: StaffMemberDocument,
  assignmentType: AssignmentType
): boolean {
  // Check status
  if (!canAcceptAssignments(staff.status)) {
    return false;
  }

  // Check availability
  if (!staff.availability.isAvailable) {
    return false;
  }

  // Check capacity based on assignment type
  if (assignmentType === 'lead') {
    return canAcceptNewLead(staff).canAccept;
  }
  if (assignmentType === 'customer') {
    return canAcceptNewCustomer(staff).canAccept;
  }

  return true;
}

/**
 * Calculate assignment score for a staff member
 */
export function calculateAssignmentScore(
  staff: StaffMemberDocument,
  criteria: AssignmentCriteria,
  teams: TeamDocument[]
): { score: number; factors: ScoringFactors } {
  let score = 0;
  
  // Territory match (30%)
  const territoryMatch = hasTerritoryMatch(staff, criteria.territory);
  if (territoryMatch) {
    score += ASSIGNMENT_WEIGHTS.territoryMatch;
  }

  // Specialization match (20%)
  const specializationMatch = hasSpecializationMatch(staff, criteria.specialization, teams);
  if (specializationMatch) {
    score += ASSIGNMENT_WEIGHTS.specializationMatch;
  }

  // Workload capacity (25%)
  const workloadCapacity = calculateWorkloadCapacity(staff);
  score += workloadCapacity * ASSIGNMENT_WEIGHTS.workloadCapacity;

  // Performance score (15%)
  const performanceScore = calculatePerformanceScore(staff);
  score += performanceScore * ASSIGNMENT_WEIGHTS.performanceScore;

  // Availability (10%)
  const availability = isAvailableForAssignment(staff, criteria.assignmentType);
  if (availability) {
    score += ASSIGNMENT_WEIGHTS.availability;
  }

  return {
    score: Math.round(score * 100) / 100, // Round to 2 decimal places
    factors: {
      territoryMatch,
      specializationMatch,
      workloadCapacity: Math.round(workloadCapacity * 100) / 100,
      performanceScore: Math.round(performanceScore * 100) / 100,
      availability,
    },
  };
}

/**
 * Filter staff eligible for assignment
 */
export function filterEligibleStaff(
  staffList: StaffMemberDocument[],
  criteria: AssignmentCriteria
): StaffMemberDocument[] {
  return staffList.filter((staff) => {
    // Exclude current owner
    if (criteria.currentOwnerId && staff.staffId === criteria.currentOwnerId) {
      return false;
    }

    // Must be available
    if (!isAvailableForAssignment(staff, criteria.assignmentType)) {
      return false;
    }

    // Must match territory (required)
    if (!hasTerritoryMatch(staff, criteria.territory)) {
      return false;
    }

    // Filter by preferred team if specified
    if (criteria.preferredTeamId && !staff.teamIds.includes(criteria.preferredTeamId)) {
      return false;
    }

    return true;
  });
}

/**
 * Find best staff for assignment
 */
export function findBestStaffForAssignment(
  staffList: StaffMemberDocument[],
  teams: TeamDocument[],
  criteria: AssignmentCriteria,
  limit: number = 5
): AssignmentResult {
  // Filter eligible staff
  const eligibleStaff = filterEligibleStaff(staffList, criteria);

  // Calculate scores
  const scoredStaff = eligibleStaff.map((staff) => {
    const { score, factors } = calculateAssignmentScore(staff, criteria, teams);
    return {
      staffId: staff.staffId,
      displayName: staff.displayName,
      email: staff.email,
      score,
      factors,
    };
  });

  // Sort by score descending
  scoredStaff.sort((a, b) => b.score - a.score);

  // Take top N
  const recommendedStaff = scoredStaff.slice(0, limit);

  // Find fallback (team manager)
  let fallbackStaff: AssignmentResult['fallbackStaff'];
  
  if (recommendedStaff.length === 0) {
    // Find a manager in the territory
    const managers = staffList.filter(
      (s) =>
        s.staffType === 'broker_manager' &&
        s.territories.includes(criteria.territory) &&
        canAcceptAssignments(s.status)
    );

    if (managers.length > 0) {
      fallbackStaff = {
        staffId: managers[0].staffId,
        displayName: managers[0].displayName,
        reason: 'fallback_to_manager',
      };
    }
  }

  return {
    recommendedStaff,
    fallbackStaff,
  };
}

/**
 * Staff types that can handle leads
 */
export const LEAD_HANDLERS: StaffType[] = [
  'broker',
  'senior_broker',
  'broker_manager',
];

/**
 * Check if staff type can handle leads
 */
export function canHandleLeads(staffType: StaffType): boolean {
  return LEAD_HANDLERS.includes(staffType);
}

