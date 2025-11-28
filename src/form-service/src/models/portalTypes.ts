import { AuditMetadata } from './formTypes';

export type FieldType = 'string' | 'number' | 'date' | 'boolean';

export interface FieldDefinition {
  type: FieldType;
  required: boolean;
  description?: string;
}

export interface FieldMapping {
  targetField: string;
  transformation?: string; // JSONata expression
}

export interface PortalDefinition extends AuditMetadata {
  portalId: string;
  name: string;
  description?: string;
  fieldDefinitions: Record<string, FieldDefinition>;
  defaultMappings: Record<string, FieldMapping>;
  isDeleted?: boolean;
}

export type UnmappedFieldStatus = 'pending' | 'resolved' | 'ignored';

export interface SuggestedMapping {
  sourceField: string;
  confidence: number; // 0-1
}

export interface UnmappedField extends AuditMetadata {
  id: string;
  portalId: string;
  fieldName: string;
  occurrenceCount: number;
  suggestedMappings: SuggestedMapping[];
  status: UnmappedFieldStatus;
  resolvedMapping?: FieldMapping;
  resolvedAt?: string;
  resolvedBy?: string;
}

