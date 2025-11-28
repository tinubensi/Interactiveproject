export type FormStatus = 'draft' | 'completed';

export interface AuditMetadata {
  createdAt?: string;
  createdBy?: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface ValidationRule {
  required?: boolean;
  minLength?: number;
  maxLength?: number;
  min?: number;
  max?: number;
  pattern?: string;
  enum?: string[];
  message?: string;
}

export type QuestionType =
  | 'text'
  | 'number'
  | 'currency'
  | 'date'
  | 'dropdown'
  | 'radio'
  | 'checkbox'
  | 'email'
  | 'phone';

export interface ConnectorFieldMapping {
  portal: string;
  destinationField: string;
  transform?: 'concatFirstLast' | 'uppercase' | 'lowercase' | 'none';
}

export interface FormQuestion {
  id: string;
  label: string;
  dataKey: string;
  type: QuestionType;
  order: number;
  placeholder?: string;
  helperText?: string;
  options?: Array<{ label: string; value: string }>;
  validation?: ValidationRule;
  connectors?: ConnectorFieldMapping[];
}

export interface FormSection {
  id: string;
  title: string;
  order: number;
  questions: FormQuestion[];
}

export interface StandaloneQuestion extends FormQuestion {
  sectionId?: never;
}

export interface FormTemplate extends AuditMetadata {
  templateId: string;
  name: string;
  description?: string;
  insuranceLine: string;
  organizationId: string;
  status: FormStatus;
  version: number;
  sections: FormSection[];
  questionsWithoutSection?: StandaloneQuestion[];
  connectors?: ConnectorConfig[];
  isDeleted?: boolean;
}

export type IntakeStatus = 'draft' | 'completed';

export interface FormIntake extends AuditMetadata {
  id: string;
  intakeId: string;
  templateId: string;
  insuranceLine: string;
  customerId: string;
  status: IntakeStatus;
  formDataRaw: Record<string, unknown>;
  formDataNormalized: Record<string, Record<string, unknown>>;
  isRenewal?: boolean;
  sourceEventId?: string;
  isDeleted?: boolean;
}

export interface ConnectorConfig {
  portal: string;
  description?: string;
  fieldMap: Record<string, string>;
  transformations?: Record<
    string,
    {
      type: 'concat';
      fields: string[];
      separator?: string;
    }
  >;
}

