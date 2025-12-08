import type {
  WorkflowTemplate,
  TriggerDefinition,
  WorkflowStep,
  VariableDefinition,
  WorkflowSettings,
} from '../models/workflowTypes';

// ----------------------------------------------------------------------------
// Insurance Workflow Templates
// ----------------------------------------------------------------------------

type SeedTemplate = Omit<WorkflowTemplate, 'id' | 'createdAt'>;

export const INSURANCE_TEMPLATES: SeedTemplate[] = [
  // ============================================================================
  // NEW BUSINESS QUOTE-TO-BIND TEMPLATE
  // ============================================================================
  {
    templateId: 'tpl-new-business',
    name: 'New Business Quote-to-Bind',
    description:
      'Standard new business workflow from intake form submission to policy binding. Includes quote generation, optional manager approval for high-value quotes, and AML compliance check.',
    category: 'new-business',
    tags: ['quote', 'policy', 'intake', 'approval', 'aml', 'personal-lines'],
    baseWorkflow: {
      triggers: [
        {
          id: 'intake-trigger',
          type: 'event',
          config: {
            eventType: 'IntakeFormSubmittedEvent',
            extractVariables: {
              customerId: '$.data.customerId',
              customerEmail: '$.data.email',
              insuranceLine: '$.data.insuranceLine',
              formData: '$.data',
            },
          },
          isActive: true,
        },
        {
          id: 'manual-trigger',
          type: 'manual',
          config: {
            requiredInputs: {
              customerId: { type: 'string', required: true },
              customerEmail: { type: 'string', required: true },
              insuranceLine: { type: 'string', required: true },
            },
          },
          isActive: true,
        },
      ],
      steps: [
        {
          id: 'step-init',
          name: 'Initialize Variables',
          type: 'setVariable',
          order: 1,
          setVariables: {
            processStartedAt: '{{fn.now()}}',
            correlationId: '{{fn.uuid()}}',
            highRisk: false,
          },
        },
        {
          id: 'step-validate',
          name: 'Validate Intake Data',
          type: 'action',
          order: 2,
          action: {
            type: 'http_request',
            config: {
              url: '{{env.INTAKE_SERVICE_URL}}/api/intake/{{$.intakeId}}/validate',
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
            },
            outputVariable: 'validationResult',
          },
          onError: {
            action: 'retry',
            retryPolicy: {
              maxAttempts: 3,
              backoffType: 'exponential',
              initialDelaySeconds: 2,
            },
          },
        },
        {
          id: 'step-check-validation',
          name: 'Check Validation Result',
          type: 'decision',
          order: 3,
          conditions: [
            {
              targetStepId: 'step-validation-failed',
              condition: {
                left: '$.validationResult.isValid',
                operator: 'eq',
                right: false,
              },
            },
            {
              targetStepId: 'step-request-quotes',
              isDefault: true,
            },
          ],
        },
        {
          id: 'step-request-quotes',
          name: 'Request Quotes from Insurers',
          type: 'action',
          order: 4,
          action: {
            type: 'publish_event',
            config: {
              eventType: 'GenerateQuotesRequestedEvent',
              data: {
                customerId: '{{$.customerId}}',
                insuranceLine: '{{$.insuranceLine}}',
                formData: '{{$.formData}}',
                correlationId: '{{$.correlationId}}',
              },
            },
          },
        },
        {
          id: 'step-wait-quotes',
          name: 'Wait for Quote Responses',
          type: 'wait',
          order: 5,
          waitConfig: {
            type: 'event',
            eventType: 'QuotesAggregatedEvent',
            eventFilter: 'data.correlationId == "{{$.correlationId}}"',
            extractVariables: {
              quotes: '$.data.quotes',
              quoteCount: '$.data.quoteCount',
            },
          },
          timeout: 300, // 5 minutes
        },
        {
          id: 'step-check-quotes',
          name: 'Check Quote Availability',
          type: 'decision',
          order: 6,
          conditions: [
            {
              targetStepId: 'step-no-quotes',
              condition: {
                left: '{{fn.length($.quotes)}}',
                operator: 'eq',
                right: 0,
              },
            },
            {
              targetStepId: 'step-check-high-value',
              isDefault: true,
            },
          ],
        },
        {
          id: 'step-check-high-value',
          name: 'Check for High-Value Quote',
          type: 'decision',
          order: 7,
          conditions: [
            {
              targetStepId: 'step-manager-approval',
              condition: {
                left: '$.quotes[0].premium',
                operator: 'gt',
                right: 10000,
              },
            },
            {
              targetStepId: 'step-notify-customer',
              isDefault: true,
            },
          ],
        },
        {
          id: 'step-manager-approval',
          name: 'Manager Approval Required',
          type: 'human',
          order: 8,
          humanConfig: {
            approverRoles: ['underwriting-manager'],
            requiredApprovals: 1,
            expiresInSeconds: 86400, // 24 hours
            context: {
              displayFields: ['customerId', 'insuranceLine', 'quotes'],
              instructions:
                'High-value quote requires manager approval before proceeding to customer.',
            },
          },
          transitions: [
            {
              targetStepId: 'step-approval-rejected',
              condition: {
                left: 'steps.step-manager-approval.approvalResult.status',
                operator: 'eq',
                right: 'rejected',
              },
            },
            {
              targetStepId: 'step-notify-customer',
              isDefault: true,
            },
          ],
        },
        {
          id: 'step-notify-customer',
          name: 'Send Quotes to Customer',
          type: 'action',
          order: 9,
          action: {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'quotes-ready',
              to: '{{$.customerEmail}}',
              subject: 'Your Insurance Quotes Are Ready',
              data: {
                customerName: '{{$.formData.firstName}}',
                quotes: '{{$.quotes}}',
                expiresAt: '{{fn.addDays(fn.now(), 7)}}',
              },
            },
          },
        },
        {
          id: 'step-wait-selection',
          name: 'Wait for Customer Selection',
          type: 'wait',
          order: 10,
          waitConfig: {
            type: 'event',
            eventType: 'CustomerQuoteSelectedEvent',
            eventFilter: 'data.customerId == "{{$.customerId}}"',
            extractVariables: {
              selectedQuoteId: '$.data.quoteId',
              selectedQuote: '$.data.quote',
            },
          },
          timeout: 604800, // 7 days
        },
        {
          id: 'step-parallel-checks',
          name: 'Run Compliance Checks',
          type: 'parallel',
          order: 11,
          parallelConfig: {
            branches: [
              {
                id: 'branch-aml',
                name: 'AML Check',
                steps: [
                  {
                    id: 'step-aml-request',
                    name: 'Request AML Check',
                    type: 'action',
                    order: 1,
                    action: {
                      type: 'publish_event',
                      config: {
                        eventType: 'AMLCheckRequestedEvent',
                        data: {
                          customerId: '{{$.customerId}}',
                          correlationId: '{{$.correlationId}}',
                        },
                      },
                    },
                  },
                  {
                    id: 'step-aml-wait',
                    name: 'Wait for AML Result',
                    type: 'wait',
                    order: 2,
                    waitConfig: {
                      type: 'event',
                      eventType: 'AMLCheckCompletedEvent',
                      eventFilter: 'data.customerId == "{{$.customerId}}"',
                      extractVariables: {
                        amlResult: '$.data.result',
                        amlPassed: '$.data.passed',
                      },
                    },
                    timeout: 60,
                  },
                ],
              },
            ],
            joinCondition: 'all',
            timeout: 120,
          },
        },
        {
          id: 'step-check-aml',
          name: 'Check AML Result',
          type: 'decision',
          order: 12,
          conditions: [
            {
              targetStepId: 'step-aml-failed',
              condition: {
                left: '$.amlPassed',
                operator: 'eq',
                right: false,
              },
            },
            {
              targetStepId: 'step-bind-policy',
              isDefault: true,
            },
          ],
        },
        {
          id: 'step-bind-policy',
          name: 'Bind Policy',
          type: 'action',
          order: 13,
          action: {
            type: 'http_request',
            config: {
              url: '{{env.POLICY_SERVICE_URL}}/api/policies/bind',
              method: 'POST',
              body: {
                quoteId: '{{$.selectedQuoteId}}',
                customerId: '{{$.customerId}}',
                correlationId: '{{$.correlationId}}',
              },
            },
            outputVariable: 'policyResult',
          },
        },
        {
          id: 'step-complete',
          name: 'Complete - Policy Bound',
          type: 'action',
          order: 14,
          action: {
            type: 'publish_event',
            config: {
              eventType: 'NewBusinessCompletedEvent',
              data: {
                customerId: '{{$.customerId}}',
                policyId: '{{$.policyResult.policyId}}',
                policyNumber: '{{$.policyResult.policyNumber}}',
                status: 'completed',
              },
            },
          },
        },
        // Error/Alternative paths
        {
          id: 'step-validation-failed',
          name: 'Handle Validation Failure',
          type: 'action',
          order: 100,
          action: {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'validation-failed',
              to: '{{$.customerEmail}}',
              subject: 'Issue with Your Application',
              data: {
                errors: '{{$.validationResult.errors}}',
              },
            },
          },
        },
        {
          id: 'step-no-quotes',
          name: 'Handle No Quotes Available',
          type: 'action',
          order: 101,
          action: {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'no-quotes-available',
              to: '{{$.customerEmail}}',
              subject: 'Unable to Provide Quotes',
            },
          },
        },
        {
          id: 'step-approval-rejected',
          name: 'Handle Approval Rejected',
          type: 'action',
          order: 102,
          action: {
            type: 'publish_event',
            config: {
              eventType: 'NewBusinessRejectedEvent',
              data: {
                customerId: '{{$.customerId}}',
                reason: 'Manager approval rejected',
              },
            },
          },
        },
        {
          id: 'step-aml-failed',
          name: 'Handle AML Check Failed',
          type: 'action',
          order: 103,
          action: {
            type: 'publish_event',
            config: {
              eventType: 'NewBusinessRejectedEvent',
              data: {
                customerId: '{{$.customerId}}',
                reason: 'AML compliance check failed',
              },
            },
          },
        },
      ],
      variables: {
        customerId: { type: 'string', required: true, description: 'Customer ID' },
        customerEmail: { type: 'string', required: true, description: 'Customer email' },
        insuranceLine: { type: 'string', required: true, description: 'Insurance line (auto, home, etc.)' },
        formData: { type: 'object', required: true, description: 'Intake form data' },
        intakeId: { type: 'string', description: 'Intake form ID' },
        quotes: { type: 'array', defaultValue: [], description: 'Available quotes' },
        selectedQuoteId: { type: 'string', description: 'Customer selected quote ID' },
        highRisk: { type: 'boolean', defaultValue: false },
        correlationId: { type: 'string' },
      },
      settings: {
        maxExecutionDurationSeconds: 604800, // 7 days
        enableAuditLogging: true,
        enableMetrics: true,
      },
    },
    requiredVariables: ['customerId', 'customerEmail', 'insuranceLine'],
    isPublic: true,
    createdBy: 'system',
    version: 1,
    documentation: `
# New Business Quote-to-Bind Workflow

This workflow automates the new business process from intake form submission to policy binding.

## Trigger
- **Event**: IntakeFormSubmittedEvent
- **Manual**: Start manually with customer details

## Flow
1. Validate intake data
2. Request quotes from insurers
3. Wait for quote aggregation
4. Manager approval (for high-value quotes >$10,000)
5. Send quotes to customer
6. Wait for customer selection
7. Run AML compliance check
8. Bind policy

## Configuration
- Customize approval threshold by modifying the decision step condition
- Add additional compliance checks in the parallel step
    `,
  },

  // ============================================================================
  // POLICY RENEWAL TEMPLATE
  // ============================================================================
  {
    templateId: 'tpl-renewal',
    name: 'Policy Renewal Workflow',
    description:
      'Automated policy renewal workflow triggered 60 days before expiry. Pre-fills renewal form and optionally generates renewal quotes.',
    category: 'renewal',
    tags: ['renewal', 'policy', 'automation', 'personal-lines'],
    baseWorkflow: {
      triggers: [
        {
          id: 'expiry-trigger',
          type: 'event',
          config: {
            eventType: 'PolicyNearingExpiryEvent',
            extractVariables: {
              policyId: '$.data.policyId',
              customerId: '$.data.customerId',
              customerEmail: '$.data.customerEmail',
              expiryDate: '$.data.expiryDate',
              currentPremium: '$.data.premium',
            },
          },
          isActive: true,
        },
        {
          id: 'schedule-trigger',
          type: 'schedule',
          config: {
            cronExpression: '0 9 * * *', // Daily at 9 AM
            timezone: 'America/New_York',
          },
          isActive: false,
        },
      ],
      steps: [
        {
          id: 'step-init',
          name: 'Initialize Renewal',
          type: 'setVariable',
          order: 1,
          setVariables: {
            renewalStartedAt: '{{fn.now()}}',
            renewalCorrelationId: '{{fn.uuid()}}',
          },
        },
        {
          id: 'step-get-policy',
          name: 'Fetch Current Policy',
          type: 'action',
          order: 2,
          action: {
            type: 'http_request',
            config: {
              url: '{{env.POLICY_SERVICE_URL}}/api/policies/{{$.policyId}}',
              method: 'GET',
            },
            outputVariable: 'currentPolicy',
          },
        },
        {
          id: 'step-prefill-form',
          name: 'Pre-fill Renewal Form',
          type: 'action',
          order: 3,
          action: {
            type: 'http_request',
            config: {
              url: '{{env.INTAKE_SERVICE_URL}}/api/intake/prefill',
              method: 'POST',
              body: {
                customerId: '{{$.customerId}}',
                policyId: '{{$.policyId}}',
                insuranceLine: '{{$.currentPolicy.insuranceLine}}',
                previousData: '{{$.currentPolicy.coverageDetails}}',
              },
            },
            outputVariable: 'prefilledForm',
          },
        },
        {
          id: 'step-notify-renewal',
          name: 'Send Renewal Notice',
          type: 'action',
          order: 4,
          action: {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'renewal-notice',
              to: '{{$.customerEmail}}',
              subject: 'Your Policy Renewal is Coming Up',
              data: {
                policyNumber: '{{$.currentPolicy.policyNumber}}',
                expiryDate: '{{$.expiryDate}}',
                currentPremium: '{{$.currentPremium}}',
                renewalLink: '{{env.PORTAL_URL}}/renew/{{$.policyId}}',
              },
            },
          },
        },
        {
          id: 'step-wait-response',
          name: 'Wait for Customer Response',
          type: 'wait',
          order: 5,
          waitConfig: {
            type: 'event',
            eventType: 'RenewalResponseReceivedEvent',
            eventFilter: 'data.policyId == "{{$.policyId}}"',
            extractVariables: {
              renewalDecision: '$.data.decision',
              updatedData: '$.data.formData',
            },
          },
          timeout: 2592000, // 30 days
        },
        {
          id: 'step-check-decision',
          name: 'Check Renewal Decision',
          type: 'decision',
          order: 6,
          conditions: [
            {
              targetStepId: 'step-cancel-policy',
              condition: {
                left: '$.renewalDecision',
                operator: 'eq',
                right: 'cancel',
              },
            },
            {
              targetStepId: 'step-process-renewal',
              isDefault: true,
            },
          ],
        },
        {
          id: 'step-process-renewal',
          name: 'Process Renewal',
          type: 'action',
          order: 7,
          action: {
            type: 'http_request',
            config: {
              url: '{{env.POLICY_SERVICE_URL}}/api/policies/{{$.policyId}}/renew',
              method: 'POST',
              body: {
                updatedData: '{{$.updatedData}}',
                correlationId: '{{$.renewalCorrelationId}}',
              },
            },
            outputVariable: 'renewalResult',
          },
        },
        {
          id: 'step-complete',
          name: 'Renewal Complete',
          type: 'action',
          order: 8,
          action: {
            type: 'publish_event',
            config: {
              eventType: 'PolicyRenewedEvent',
              data: {
                policyId: '{{$.policyId}}',
                newPolicyId: '{{$.renewalResult.newPolicyId}}',
                customerId: '{{$.customerId}}',
              },
            },
          },
        },
        {
          id: 'step-cancel-policy',
          name: 'Handle Cancellation',
          type: 'action',
          order: 100,
          action: {
            type: 'publish_event',
            config: {
              eventType: 'PolicyCancellationRequestedEvent',
              data: {
                policyId: '{{$.policyId}}',
                customerId: '{{$.customerId}}',
                reason: 'Customer declined renewal',
              },
            },
          },
        },
      ],
      variables: {
        policyId: { type: 'string', required: true },
        customerId: { type: 'string', required: true },
        customerEmail: { type: 'string', required: true },
        expiryDate: { type: 'date', required: true },
        currentPremium: { type: 'number' },
        renewalDecision: { type: 'string' },
      },
      settings: {
        maxExecutionDurationSeconds: 2592000, // 30 days
        enableAuditLogging: true,
      },
    },
    requiredVariables: ['policyId', 'customerId', 'customerEmail', 'expiryDate'],
    isPublic: true,
    createdBy: 'system',
    version: 1,
  },

  // ============================================================================
  // DOCUMENT APPROVAL TEMPLATE
  // ============================================================================
  {
    templateId: 'tpl-document-approval',
    name: 'Document Approval Workflow',
    description:
      'Generic document review and approval workflow. Configurable approver roles and escalation.',
    category: 'approval',
    tags: ['document', 'approval', 'review', 'generic'],
    baseWorkflow: {
      triggers: [
        {
          id: 'document-trigger',
          type: 'event',
          config: {
            eventType: 'DocumentUploadedEvent',
            extractVariables: {
              documentId: '$.data.documentId',
              documentType: '$.data.documentType',
              uploadedBy: '$.data.uploadedBy',
              customerId: '$.data.customerId',
            },
          },
          isActive: true,
        },
        {
          id: 'manual-trigger',
          type: 'manual',
          config: {
            requiredInputs: {
              documentId: { type: 'string', required: true },
              documentType: { type: 'string', required: true },
            },
          },
          isActive: true,
        },
      ],
      steps: [
        {
          id: 'step-request-approval',
          name: 'Request Document Approval',
          type: 'human',
          order: 1,
          humanConfig: {
            approverRoles: ['document-reviewer'],
            requiredApprovals: 1,
            expiresInSeconds: 172800, // 48 hours
            context: {
              displayFields: ['documentId', 'documentType', 'uploadedBy', 'customerId'],
              instructions: 'Please review the uploaded document and approve or reject.',
            },
          },
        },
        {
          id: 'step-check-decision',
          name: 'Check Approval Decision',
          type: 'decision',
          order: 2,
          conditions: [
            {
              targetStepId: 'step-approved',
              condition: {
                left: 'steps.step-request-approval.approvalResult.status',
                operator: 'eq',
                right: 'approved',
              },
            },
            {
              targetStepId: 'step-rejected',
              isDefault: true,
            },
          ],
        },
        {
          id: 'step-approved',
          name: 'Document Approved',
          type: 'action',
          order: 3,
          action: {
            type: 'publish_event',
            config: {
              eventType: 'DocumentApprovedEvent',
              data: {
                documentId: '{{$.documentId}}',
                approvedBy: '{{steps.step-request-approval.approvalResult.decidedBy}}',
                approvedAt: '{{fn.now()}}',
              },
            },
          },
        },
        {
          id: 'step-rejected',
          name: 'Document Rejected',
          type: 'action',
          order: 4,
          action: {
            type: 'publish_event',
            config: {
              eventType: 'DocumentRejectedEvent',
              data: {
                documentId: '{{$.documentId}}',
                rejectedBy: '{{steps.step-request-approval.approvalResult.decidedBy}}',
                reason: '{{steps.step-request-approval.approvalResult.comment}}',
                rejectedAt: '{{fn.now()}}',
              },
            },
          },
        },
      ],
      variables: {
        documentId: { type: 'string', required: true },
        documentType: { type: 'string', required: true },
        uploadedBy: { type: 'string' },
        customerId: { type: 'string' },
      },
      settings: {
        maxExecutionDurationSeconds: 172800, // 48 hours
      },
    },
    requiredVariables: ['documentId', 'documentType'],
    configurationSchema: {
      type: 'object',
      properties: {
        approverRole: {
          type: 'string',
          description: 'Role required to approve documents',
          default: 'document-reviewer',
        },
        expirationHours: {
          type: 'number',
          description: 'Hours before approval request expires',
          default: 48,
        },
      },
    },
    isPublic: true,
    createdBy: 'system',
    version: 1,
  },

  // ============================================================================
  // LEAD QUALIFICATION TEMPLATE
  // ============================================================================
  {
    templateId: 'tpl-lead-qualification',
    name: 'Lead Qualification Workflow',
    description:
      'Automated lead scoring and qualification workflow with assignment to agents.',
    category: 'lead-management',
    tags: ['lead', 'qualification', 'scoring', 'assignment'],
    baseWorkflow: {
      triggers: [
        {
          id: 'lead-trigger',
          type: 'event',
          config: {
            eventType: 'LeadCreatedEvent',
            extractVariables: {
              leadId: '$.data.leadId',
              leadEmail: '$.data.email',
              leadPhone: '$.data.phone',
              source: '$.data.source',
              insuranceLine: '$.data.insuranceLine',
            },
          },
          isActive: true,
        },
      ],
      steps: [
        {
          id: 'step-enrich',
          name: 'Enrich Lead Data',
          type: 'action',
          order: 1,
          action: {
            type: 'http_request',
            config: {
              url: '{{env.LEAD_SERVICE_URL}}/api/leads/{{$.leadId}}/enrich',
              method: 'POST',
            },
            outputVariable: 'enrichedData',
          },
        },
        {
          id: 'step-score',
          name: 'Calculate Lead Score',
          type: 'transform',
          order: 2,
          transformConfig: {
            expression: `
              $sum([
                $boolean($.enrichedData.hasExistingPolicy) ? 20 : 0,
                $.source = 'referral' ? 30 : 10,
                $boolean($.enrichedData.phoneVerified) ? 15 : 0,
                $boolean($.enrichedData.emailVerified) ? 10 : 0,
                $.enrichedData.estimatedPremium > 5000 ? 25 : 10
              ])
            `,
            outputVariable: 'leadScore',
          },
        },
        {
          id: 'step-qualify',
          name: 'Determine Qualification',
          type: 'decision',
          order: 3,
          conditions: [
            {
              targetStepId: 'step-high-priority',
              condition: {
                left: '$.leadScore',
                operator: 'gte',
                right: 70,
              },
            },
            {
              targetStepId: 'step-medium-priority',
              condition: {
                operator: 'and',
                conditions: [
                  { left: '$.leadScore', operator: 'gte', right: 40 },
                  { left: '$.leadScore', operator: 'lt', right: 70 },
                ],
              },
            },
            {
              targetStepId: 'step-low-priority',
              isDefault: true,
            },
          ],
        },
        {
          id: 'step-high-priority',
          name: 'Assign to Senior Agent',
          type: 'action',
          order: 4,
          action: {
            type: 'http_request',
            config: {
              url: '{{env.LEAD_SERVICE_URL}}/api/leads/{{$.leadId}}/assign',
              method: 'POST',
              body: {
                priority: 'high',
                agentTier: 'senior',
                score: '{{$.leadScore}}',
              },
            },
            outputVariable: 'assignmentResult',
          },
          transitions: [
            {
              targetStepId: 'step-notify-agent',
              isDefault: true,
            },
          ],
        },
        {
          id: 'step-medium-priority',
          name: 'Assign to Standard Agent',
          type: 'action',
          order: 5,
          action: {
            type: 'http_request',
            config: {
              url: '{{env.LEAD_SERVICE_URL}}/api/leads/{{$.leadId}}/assign',
              method: 'POST',
              body: {
                priority: 'medium',
                agentTier: 'standard',
                score: '{{$.leadScore}}',
              },
            },
            outputVariable: 'assignmentResult',
          },
          transitions: [
            {
              targetStepId: 'step-notify-agent',
              isDefault: true,
            },
          ],
        },
        {
          id: 'step-low-priority',
          name: 'Add to Nurture Queue',
          type: 'action',
          order: 6,
          action: {
            type: 'http_request',
            config: {
              url: '{{env.LEAD_SERVICE_URL}}/api/leads/{{$.leadId}}/nurture',
              method: 'POST',
              body: {
                score: '{{$.leadScore}}',
              },
            },
          },
          transitions: [
            {
              targetStepId: 'step-complete',
              isDefault: true,
            },
          ],
        },
        {
          id: 'step-notify-agent',
          name: 'Notify Assigned Agent',
          type: 'action',
          order: 7,
          action: {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'lead-assigned',
              to: '{{$.assignmentResult.agentEmail}}',
              subject: 'New Lead Assigned: {{$.leadId}}',
              data: {
                leadId: '{{$.leadId}}',
                leadEmail: '{{$.leadEmail}}',
                leadPhone: '{{$.leadPhone}}',
                score: '{{$.leadScore}}',
                insuranceLine: '{{$.insuranceLine}}',
              },
            },
          },
        },
        {
          id: 'step-complete',
          name: 'Lead Qualified',
          type: 'action',
          order: 8,
          action: {
            type: 'publish_event',
            config: {
              eventType: 'LeadQualifiedEvent',
              data: {
                leadId: '{{$.leadId}}',
                score: '{{$.leadScore}}',
                qualified: true,
              },
            },
          },
        },
      ],
      variables: {
        leadId: { type: 'string', required: true },
        leadEmail: { type: 'string' },
        leadPhone: { type: 'string' },
        source: { type: 'string' },
        insuranceLine: { type: 'string' },
        leadScore: { type: 'number', defaultValue: 0 },
      },
      settings: {
        maxExecutionDurationSeconds: 3600, // 1 hour
      },
    },
    requiredVariables: ['leadId'],
    isPublic: true,
    createdBy: 'system',
    version: 1,
  },

  // ============================================================================
  // CLAIMS FNOL TEMPLATE
  // ============================================================================
  {
    templateId: 'tpl-claims-fnol',
    name: 'First Notice of Loss (FNOL)',
    description:
      'Claims intake workflow from first notice through initial assessment and adjuster assignment.',
    category: 'claims',
    tags: ['claims', 'fnol', 'intake', 'auto-insurance', 'home-insurance'],
    baseWorkflow: {
      triggers: [
        {
          id: 'claim-trigger',
          type: 'event',
          config: {
            eventType: 'ClaimReportedEvent',
            extractVariables: {
              claimId: '$.data.claimId',
              policyId: '$.data.policyId',
              customerId: '$.data.customerId',
              claimType: '$.data.claimType',
              incidentDate: '$.data.incidentDate',
              description: '$.data.description',
            },
          },
          isActive: true,
        },
      ],
      steps: [
        {
          id: 'step-validate-policy',
          name: 'Validate Policy Coverage',
          type: 'action',
          order: 1,
          action: {
            type: 'http_request',
            config: {
              url: '{{env.POLICY_SERVICE_URL}}/api/policies/{{$.policyId}}/coverage',
              method: 'GET',
            },
            outputVariable: 'coverageInfo',
          },
        },
        {
          id: 'step-check-coverage',
          name: 'Check Coverage Valid',
          type: 'decision',
          order: 2,
          conditions: [
            {
              targetStepId: 'step-no-coverage',
              condition: {
                left: '$.coverageInfo.isActive',
                operator: 'eq',
                right: false,
              },
            },
            {
              targetStepId: 'step-create-claim',
              isDefault: true,
            },
          ],
        },
        {
          id: 'step-create-claim',
          name: 'Create Claim Record',
          type: 'action',
          order: 3,
          action: {
            type: 'http_request',
            config: {
              url: '{{env.CLAIMS_SERVICE_URL}}/api/claims',
              method: 'POST',
              body: {
                claimId: '{{$.claimId}}',
                policyId: '{{$.policyId}}',
                customerId: '{{$.customerId}}',
                claimType: '{{$.claimType}}',
                incidentDate: '{{$.incidentDate}}',
                description: '{{$.description}}',
                status: 'open',
              },
            },
            outputVariable: 'claimRecord',
          },
        },
        {
          id: 'step-assign-adjuster',
          name: 'Assign Adjuster',
          type: 'action',
          order: 4,
          action: {
            type: 'http_request',
            config: {
              url: '{{env.CLAIMS_SERVICE_URL}}/api/claims/{{$.claimId}}/assign',
              method: 'POST',
              body: {
                claimType: '{{$.claimType}}',
                priority: '{{$.coverageInfo.claimPriority}}',
              },
            },
            outputVariable: 'adjusterAssignment',
          },
        },
        {
          id: 'step-notify-customer',
          name: 'Send Claim Acknowledgment',
          type: 'action',
          order: 5,
          action: {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'claim-acknowledged',
              to: '{{$.coverageInfo.customerEmail}}',
              subject: 'Your Claim Has Been Received - {{$.claimRecord.claimNumber}}',
              data: {
                claimNumber: '{{$.claimRecord.claimNumber}}',
                adjusterName: '{{$.adjusterAssignment.adjusterName}}',
                adjusterPhone: '{{$.adjusterAssignment.adjusterPhone}}',
              },
            },
          },
        },
        {
          id: 'step-complete',
          name: 'FNOL Complete',
          type: 'action',
          order: 6,
          action: {
            type: 'publish_event',
            config: {
              eventType: 'FNOLCompletedEvent',
              data: {
                claimId: '{{$.claimId}}',
                claimNumber: '{{$.claimRecord.claimNumber}}',
                adjusterId: '{{$.adjusterAssignment.adjusterId}}',
              },
            },
          },
        },
        {
          id: 'step-no-coverage',
          name: 'Handle No Coverage',
          type: 'action',
          order: 100,
          action: {
            type: 'publish_event',
            config: {
              eventType: 'ClaimDeniedEvent',
              data: {
                claimId: '{{$.claimId}}',
                reason: 'Policy not active or coverage not applicable',
              },
            },
          },
        },
      ],
      variables: {
        claimId: { type: 'string', required: true },
        policyId: { type: 'string', required: true },
        customerId: { type: 'string', required: true },
        claimType: { type: 'string', required: true },
        incidentDate: { type: 'date' },
        description: { type: 'string' },
      },
      settings: {
        maxExecutionDurationSeconds: 3600,
        enableAuditLogging: true,
      },
    },
    requiredVariables: ['claimId', 'policyId', 'customerId', 'claimType'],
    isPublic: true,
    createdBy: 'system',
    version: 1,
  },
];

// ============================================================================
// NECTARIA PET/MEDICAL INSURANCE TEMPLATES
// ============================================================================

export const PET_INSURANCE_TEMPLATES: SeedTemplate[] = [
  // ============================================================================
  // STANDARD PET INSURANCE LEAD FLOW
  // ============================================================================
  {
    templateId: 'tpl-pet-insurance-flow',
    name: 'Standard Pet Insurance Lead Flow',
    description:
      'Complete pet insurance workflow from lead creation to policy issuance. Includes automatic plan fetching, quotation generation, and customer follow-ups.',
    category: 'lead-flow',
    tags: ['pet-insurance', 'medical', 'lead', 'quotation', 'policy', 'automation'],
    baseWorkflow: {
      triggers: [
        {
          id: 'lead-created-trigger',
          type: 'event',
          config: {
            eventType: 'lead.created',
            eventFilter: 'data.lineOfBusiness == "medical"',
            extractVariables: {
              leadId: '$.data.leadId',
              referenceId: '$.data.referenceId',
              customerId: '$.data.customerId',
              email: '$.data.email',
              firstName: '$.data.firstName',
              lineOfBusiness: '$.data.lineOfBusiness',
              lobData: '$.data.lobData',
            },
          },
          isActive: true,
        },
      ],
      steps: [
        // Step 1: Initialize workflow
        {
          id: 'step-init',
          name: 'Initialize Lead Flow',
          type: 'setVariable',
          order: 1,
          setVariables: {
            workflowStartedAt: '{{fn.now()}}',
            currentStage: 'Plans Fetching',
          },
        },
        // Step 2: Wait for plans to be fetched
        {
          id: 'step-wait-plans',
          name: 'Wait for Plans',
          type: 'wait',
          order: 2,
          waitConfig: {
            type: 'event',
            eventType: 'plans.fetch_completed',
            eventFilter: 'data.leadId == "{{$.leadId}}"',
            extractVariables: {
              plansCount: '$.data.totalPlans',
              fetchRequestId: '$.data.fetchRequestId',
            },
          },
          timeout: 300, // 5 minutes
        },
        // Step 3: Check if plans are available
        {
          id: 'step-check-plans',
          name: 'Check Plans Availability',
          type: 'decision',
          order: 3,
          conditions: [
            {
              targetStepId: 'step-no-plans',
              condition: {
                left: '$.plansCount',
                operator: 'eq',
                right: 0,
              },
            },
            {
              targetStepId: 'step-change-to-plans-available',
              isDefault: true,
            },
          ],
        },
        // Step 4: Change stage to Plans Available
        {
          id: 'step-change-to-plans-available',
          name: 'Move to Plans Available',
          type: 'action',
          order: 4,
          action: {
            type: 'change_lead_stage',
            config: {
              stageId: 'stage-2',
              stageName: 'Plans Available',
              remark: 'Plans fetched successfully',
            },
          },
        },
        // Step 5: Create quotation
        {
          id: 'step-create-quotation',
          name: 'Create Quotation',
          type: 'action',
          order: 5,
          action: {
            type: 'create_quotation',
            config: {
              planSelectionStrategy: 'best-value',
              maxPlans: 5,
              validityDays: 30,
              autoSelectRecommended: true,
            },
            outputVariable: 'quotation',
          },
        },
        // Step 6: Change stage to Quotation Created
        {
          id: 'step-change-to-quotation-created',
          name: 'Move to Quotation Created',
          type: 'action',
          order: 6,
          action: {
            type: 'change_lead_stage',
            config: {
              stageId: 'stage-3',
              stageName: 'Quotation Created',
              remark: 'Quotation generated with {{$.quotation.planCount}} plans',
            },
          },
        },
        // Step 7: Send quotation to customer
        {
          id: 'step-send-quotation',
          name: 'Send Quotation to Customer',
          type: 'action',
          order: 7,
          action: {
            type: 'send_quotation',
            config: {
              recipient: '{{$.email}}',
              template: 'quotation-email',
              generatePdf: true,
              includeComparison: true,
              trackOpens: true,
            },
          },
        },
        // Step 8: Change stage to Quotation Sent
        {
          id: 'step-change-to-quotation-sent',
          name: 'Move to Quotation Sent',
          type: 'action',
          order: 8,
          action: {
            type: 'change_lead_stage',
            config: {
              stageId: 'stage-4',
              stageName: 'Quotation Sent',
            },
          },
        },
        // Step 9: Wait for customer response (3 days)
        {
          id: 'step-wait-customer',
          name: 'Wait for Customer Response',
          type: 'wait',
          order: 9,
          waitConfig: {
            type: 'event',
            eventType: 'quotation.plan_selected',
            eventFilter: 'data.leadId == "{{$.leadId}}"',
            extractVariables: {
              selectedPlanId: '$.data.selectedPlanId',
            },
          },
          timeout: 259200, // 3 days
        },
        // Step 10: Send reminder if no response
        {
          id: 'step-send-reminder',
          name: 'Send Reminder',
          type: 'action',
          order: 10,
          action: {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'quote-reminder',
              to: '{{$.email}}',
              subject: 'Your Pet Insurance Quote is Waiting!',
              data: {
                firstName: '{{$.firstName}}',
                quotationId: '{{$.quotation.id}}',
              },
            },
          },
        },
        // Step 11: Wait another 3 days
        {
          id: 'step-wait-final',
          name: 'Final Wait for Response',
          type: 'wait',
          order: 11,
          waitConfig: {
            type: 'event',
            eventType: 'quotation.plan_selected',
            eventFilter: 'data.leadId == "{{$.leadId}}"',
            extractVariables: {
              selectedPlanId: '$.data.selectedPlanId',
            },
          },
          timeout: 259200, // 3 more days
        },
        // Step 12: Check if customer responded
        {
          id: 'step-check-response',
          name: 'Check Customer Response',
          type: 'decision',
          order: 12,
          conditions: [
            {
              targetStepId: 'step-mark-lost',
              condition: {
                left: '$.selectedPlanId',
                operator: 'notExists',
                right: true,
              },
            },
            {
              targetStepId: 'step-change-to-pending-review',
              isDefault: true,
            },
          ],
        },
        // Step 13: Move to Pending Review
        {
          id: 'step-change-to-pending-review',
          name: 'Move to Pending Review',
          type: 'action',
          order: 13,
          action: {
            type: 'change_lead_stage',
            config: {
              stageId: 'stage-5',
              stageName: 'Pending Review',
            },
          },
        },
        // Step 14: Create policy request
        {
          id: 'step-create-policy-request',
          name: 'Create Policy Request',
          type: 'action',
          order: 14,
          action: {
            type: 'create_policy_request',
            config: {
              useSelectedPlan: true,
              notifyUnderwriter: true,
            },
            outputVariable: 'policyRequest',
          },
        },
        // Step 15: Wait for policy issuance
        {
          id: 'step-wait-policy',
          name: 'Wait for Policy Issuance',
          type: 'wait',
          order: 15,
          waitConfig: {
            type: 'event',
            eventType: 'policy.issued',
            eventFilter: 'data.leadId == "{{$.leadId}}"',
            extractVariables: {
              policyId: '$.data.policyId',
              policyNumber: '$.data.policyNumber',
            },
          },
          timeout: 604800, // 7 days
        },
        // Step 16: Move to Policy Issued (Success!)
        {
          id: 'step-policy-issued',
          name: 'Policy Issued Successfully',
          type: 'action',
          order: 16,
          action: {
            type: 'change_lead_stage',
            config: {
              stageId: 'stage-6',
              stageName: 'Policy Issued',
              remark: 'Policy {{$.policyNumber}} issued successfully',
            },
          },
        },
        // Step 17: Send welcome email
        {
          id: 'step-welcome-email',
          name: 'Send Welcome Email',
          type: 'action',
          order: 17,
          action: {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'welcome-email',
              to: '{{$.email}}',
              subject: 'Welcome to Pet Insurance - Your Policy is Active!',
              data: {
                firstName: '{{$.firstName}}',
                policyNumber: '{{$.policyNumber}}',
              },
            },
          },
        },
        // Alternative paths
        {
          id: 'step-no-plans',
          name: 'Handle No Plans',
          type: 'action',
          order: 100,
          action: {
            type: 'change_lead_stage',
            config: {
              stageId: 'stage-8',
              stageName: 'Lost',
              remark: 'No insurance plans available for this profile',
            },
          },
        },
        {
          id: 'step-mark-lost',
          name: 'Mark Lead as Lost',
          type: 'action',
          order: 101,
          action: {
            type: 'change_lead_stage',
            config: {
              stageId: 'stage-8',
              stageName: 'Lost',
              remark: 'Customer did not respond within the allowed time',
            },
          },
        },
      ],
      variables: {
        leadId: { type: 'string', required: true },
        referenceId: { type: 'string' },
        customerId: { type: 'string', required: true },
        email: { type: 'string', required: true },
        firstName: { type: 'string' },
        lineOfBusiness: { type: 'string', defaultValue: 'medical' },
        lobData: { type: 'object' },
        plansCount: { type: 'number', defaultValue: 0 },
        selectedPlanId: { type: 'string' },
      },
      settings: {
        maxExecutionDurationSeconds: 1209600, // 14 days
        enableAuditLogging: true,
        enableMetrics: true,
      },
    },
    requiredVariables: ['leadId', 'customerId', 'email'],
    isPublic: true,
    createdBy: 'system',
    version: 1,
    documentation: `
# Standard Pet Insurance Lead Flow

Automates the complete pet insurance journey from lead creation to policy issuance.

## Flow Steps
1. Lead created → Wait for plans
2. Plans fetched → Create quotation
3. Send quotation to customer
4. Wait for response (with reminder)
5. Customer selects plan → Create policy request
6. Policy issued → Send welcome email

## Configurable Parameters
- Quotation validity (default: 30 days)
- Wait times for customer response
- Email templates

## Triggers
- Event: lead.created (filtered for medical/pet insurance)
    `,
  },

  // ============================================================================
  // HIGH-VALUE QUOTE APPROVAL WORKFLOW
  // ============================================================================
  {
    templateId: 'tpl-high-value-approval',
    name: 'High-Value Quote Approval',
    description:
      'Manager approval workflow for high-value pet insurance quotes. Automatically routes quotes above threshold for manual approval before sending to customer.',
    category: 'approval',
    tags: ['pet-insurance', 'approval', 'high-value', 'manager', 'medical'],
    baseWorkflow: {
      triggers: [
        {
          id: 'quotation-trigger',
          type: 'event',
          config: {
            eventType: 'quotation.created',
            extractVariables: {
              quotationId: '$.data.quotationId',
              leadId: '$.data.leadId',
              customerId: '$.data.customerId',
              totalPremium: '$.data.totalPremium',
              email: '$.data.email',
            },
          },
          isActive: true,
        },
      ],
      steps: [
        // Step 1: Check premium threshold
        {
          id: 'step-check-premium',
          name: 'Check Premium Threshold',
          type: 'decision',
          order: 1,
          conditions: [
            {
              targetStepId: 'step-require-approval',
              condition: {
                left: '$.totalPremium',
                operator: 'gt',
                right: 10000,
              },
            },
            {
              targetStepId: 'step-auto-send',
              isDefault: true,
            },
          ],
        },
        // Step 2a: Require manager approval
        {
          id: 'step-require-approval',
          name: 'Request Manager Approval',
          type: 'human',
          order: 2,
          humanConfig: {
            approverRoles: ['manager', 'underwriter'],
            requiredApprovals: 1,
            expiresInSeconds: 86400, // 24 hours
            context: {
              displayFields: ['quotationId', 'totalPremium', 'email'],
              instructions: 'High-value quote requires manager approval before sending to customer.',
            },
          },
          transitions: [
            {
              targetStepId: 'step-notify-rejection',
              condition: {
                left: 'steps.step-require-approval.approvalResult.status',
                operator: 'eq',
                right: 'rejected',
              },
            },
            {
              targetStepId: 'step-send-to-customer',
              isDefault: true,
            },
          ],
        },
        // Step 2b: Auto-send for low-value quotes
        {
          id: 'step-auto-send',
          name: 'Auto-Send Quotation',
          type: 'action',
          order: 3,
          action: {
            type: 'send_quotation',
            config: {
              recipient: '{{$.email}}',
              template: 'quotation-email',
              generatePdf: true,
              trackOpens: true,
            },
          },
        },
        // Step 3: Send to customer (after approval)
        {
          id: 'step-send-to-customer',
          name: 'Send Approved Quotation',
          type: 'action',
          order: 4,
          action: {
            type: 'send_quotation',
            config: {
              recipient: '{{$.email}}',
              template: 'quotation-email-premium',
              generatePdf: true,
              customMessage: 'This quote has been personally reviewed by our team.',
              trackOpens: true,
            },
          },
        },
        // Step 4: Notify sales rep of rejection
        {
          id: 'step-notify-rejection',
          name: 'Notify Sales Rep of Rejection',
          type: 'action',
          order: 100,
          action: {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'quote-rejected-internal',
              to: '{{env.SALES_TEAM_EMAIL}}',
              subject: 'Quote Rejected - {{$.quotationId}}',
              data: {
                quotationId: '{{$.quotationId}}',
                reason: '{{steps.step-require-approval.approvalResult.comment}}',
              },
            },
          },
        },
      ],
      variables: {
        quotationId: { type: 'string', required: true },
        leadId: { type: 'string', required: true },
        customerId: { type: 'string' },
        totalPremium: { type: 'number', required: true },
        email: { type: 'string', required: true },
      },
      settings: {
        maxExecutionDurationSeconds: 172800, // 48 hours
        enableAuditLogging: true,
      },
    },
    requiredVariables: ['quotationId', 'leadId', 'totalPremium', 'email'],
    configurationSchema: {
      type: 'object',
      properties: {
        premiumThreshold: {
          type: 'number',
          description: 'Minimum premium requiring approval (AED)',
          default: 10000,
        },
        approvalExpirationHours: {
          type: 'number',
          description: 'Hours before approval request expires',
          default: 24,
        },
      },
    },
    isPublic: true,
    createdBy: 'system',
    version: 1,
  },

  // ============================================================================
  // FOLLOW-UP AUTOMATION WORKFLOW
  // ============================================================================
  {
    templateId: 'tpl-followup-automation',
    name: 'Quote Follow-up Automation',
    description:
      'Scheduled workflow that finds pending quotes older than 3 days and sends automated reminder emails to customers.',
    category: 'communication',
    tags: ['pet-insurance', 'follow-up', 'automation', 'reminder', 'scheduled'],
    baseWorkflow: {
      triggers: [
        {
          id: 'schedule-trigger',
          type: 'schedule',
          config: {
            cronExpression: '0 9 * * *', // Daily at 9 AM
            timezone: 'Asia/Dubai',
          },
          isActive: true,
        },
      ],
      steps: [
        // Step 1: Query pending quotes
        {
          id: 'step-find-pending',
          name: 'Find Pending Quotes',
          type: 'action',
          order: 1,
          action: {
            type: 'cosmos_query',
            config: {
              container: 'quotations',
              query: "SELECT * FROM c WHERE c.status = 'sent' AND c.sentAt < @cutoffDate AND c.lineOfBusiness = 'medical'",
              parameters: {
                cutoffDate: '{{fn.addDays(fn.now(), -3)}}',
              },
            },
            outputVariable: 'pendingQuotes',
          },
        },
        // Step 2: Loop through pending quotes
        {
          id: 'step-process-quotes',
          name: 'Process Each Quote',
          type: 'loop',
          order: 2,
          loopConfig: {
            collection: '{{$.pendingQuotes}}',
            itemVariable: 'quote',
            steps: [
              {
                id: 'step-send-reminder',
                name: 'Send Reminder Email',
                type: 'action',
                order: 1,
                action: {
                  type: 'send_notification',
                  config: {
                    channel: 'email',
                    template: 'quote-reminder',
                    to: '{{$.quote.customerEmail}}',
                    subject: 'Don\'t miss out on your pet insurance quote!',
                    data: {
                      firstName: '{{$.quote.customerName}}',
                      quotationId: '{{$.quote.id}}',
                      validUntil: '{{$.quote.validUntil}}',
                    },
                  },
                },
              },
              {
                id: 'step-log-activity',
                name: 'Log Reminder Sent',
                type: 'action',
                order: 2,
                action: {
                  type: 'publish_event',
                  config: {
                    eventType: 'quotation.reminder_sent',
                    subject: 'quotation/{{$.quote.id}}',
                    data: {
                      quotationId: '{{$.quote.id}}',
                      leadId: '{{$.quote.leadId}}',
                      sentAt: '{{fn.now()}}',
                    },
                  },
                },
              },
            ],
            maxIterations: 100,
          },
        },
        // Step 3: Complete with summary
        {
          id: 'step-complete',
          name: 'Follow-up Complete',
          type: 'setVariable',
          order: 3,
          setVariables: {
            completedAt: '{{fn.now()}}',
            processedCount: '{{fn.length($.pendingQuotes)}}',
          },
        },
      ],
      variables: {
        pendingQuotes: { type: 'array', defaultValue: [] },
        processedCount: { type: 'number', defaultValue: 0 },
      },
      settings: {
        maxExecutionDurationSeconds: 3600, // 1 hour
        enableAuditLogging: true,
      },
    },
    requiredVariables: [],
    isPublic: true,
    createdBy: 'system',
    version: 1,
  },

  // ============================================================================
  // NEW LEAD ASSIGNMENT WORKFLOW
  // ============================================================================
  {
    templateId: 'tpl-lead-assignment',
    name: 'New Lead Auto-Assignment',
    description:
      'Automatically assigns new leads to agents based on line of business, sends welcome email, and marks high-value leads.',
    category: 'lead-flow',
    tags: ['pet-insurance', 'lead', 'assignment', 'automation', 'welcome'],
    baseWorkflow: {
      triggers: [
        {
          id: 'lead-trigger',
          type: 'event',
          config: {
            eventType: 'lead.created',
            extractVariables: {
              leadId: '$.data.leadId',
              referenceId: '$.data.referenceId',
              email: '$.data.email',
              firstName: '$.data.firstName',
              lineOfBusiness: '$.data.lineOfBusiness',
              source: '$.data.source',
              estimatedPremium: '$.data.estimatedPremium',
            },
          },
          isActive: true,
        },
      ],
      steps: [
        // Step 1: Determine team based on LOB
        {
          id: 'step-check-lob',
          name: 'Check Line of Business',
          type: 'decision',
          order: 1,
          conditions: [
            {
              targetStepId: 'step-assign-pet-team',
              condition: {
                left: '$.lineOfBusiness',
                operator: 'eq',
                right: 'medical',
              },
            },
            {
              targetStepId: 'step-assign-motor-team',
              condition: {
                left: '$.lineOfBusiness',
                operator: 'eq',
                right: 'motor',
              },
            },
            {
              targetStepId: 'step-assign-general-team',
              isDefault: true,
            },
          ],
        },
        // Step 2a: Assign to Pet Insurance Team
        {
          id: 'step-assign-pet-team',
          name: 'Assign to Pet Insurance Team',
          type: 'action',
          order: 2,
          action: {
            type: 'assign_lead',
            config: {
              assignmentStrategy: 'round-robin',
              teamFilter: 'pet-insurance',
              notifyAgent: true,
            },
            outputVariable: 'assignment',
          },
          transitions: [
            {
              targetStepId: 'step-check-high-value',
              isDefault: true,
            },
          ],
        },
        // Step 2b: Assign to Motor Team
        {
          id: 'step-assign-motor-team',
          name: 'Assign to Motor Team',
          type: 'action',
          order: 3,
          action: {
            type: 'assign_lead',
            config: {
              assignmentStrategy: 'round-robin',
              teamFilter: 'motor',
              notifyAgent: true,
            },
            outputVariable: 'assignment',
          },
          transitions: [
            {
              targetStepId: 'step-check-high-value',
              isDefault: true,
            },
          ],
        },
        // Step 2c: Assign to General Team
        {
          id: 'step-assign-general-team',
          name: 'Assign to General Team',
          type: 'action',
          order: 4,
          action: {
            type: 'assign_lead',
            config: {
              assignmentStrategy: 'round-robin',
              teamFilter: 'sales',
              notifyAgent: true,
            },
            outputVariable: 'assignment',
          },
          transitions: [
            {
              targetStepId: 'step-check-high-value',
              isDefault: true,
            },
          ],
        },
        // Step 3: Check if high-value
        {
          id: 'step-check-high-value',
          name: 'Check if High-Value Lead',
          type: 'decision',
          order: 5,
          conditions: [
            {
              targetStepId: 'step-mark-hot',
              condition: {
                operator: 'or',
                conditions: [
                  { left: '$.estimatedPremium', operator: 'gt', right: 10000 },
                  { left: '$.source', operator: 'eq', right: 'referral' },
                ],
              },
            },
            {
              targetStepId: 'step-send-welcome',
              isDefault: true,
            },
          ],
        },
        // Step 4: Mark as hot lead
        {
          id: 'step-mark-hot',
          name: 'Mark as Hot Lead',
          type: 'action',
          order: 6,
          action: {
            type: 'mark_hot_lead',
            config: {
              isHotLead: true,
              notifyManager: true,
              reason: 'High-value or referral lead',
            },
          },
        },
        // Step 5: Send welcome email
        {
          id: 'step-send-welcome',
          name: 'Send Welcome Email',
          type: 'action',
          order: 7,
          action: {
            type: 'send_notification',
            config: {
              channel: 'email',
              template: 'welcome-email',
              to: '{{$.email}}',
              subject: 'Welcome to Our Insurance Services!',
              data: {
                firstName: '{{$.firstName}}',
                agentName: '{{$.assignment.agentName}}',
                agentEmail: '{{$.assignment.agentEmail}}',
              },
            },
          },
        },
        // Step 6: Complete
        {
          id: 'step-complete',
          name: 'Assignment Complete',
          type: 'action',
          order: 8,
          action: {
            type: 'publish_event',
            config: {
              eventType: 'lead.assignment_completed',
              subject: 'lead/{{$.leadId}}',
              data: {
                leadId: '{{$.leadId}}',
                assignedTo: '{{$.assignment.agentId}}',
                isHotLead: '{{$.isHotLead}}',
              },
            },
          },
        },
      ],
      variables: {
        leadId: { type: 'string', required: true },
        referenceId: { type: 'string' },
        email: { type: 'string', required: true },
        firstName: { type: 'string' },
        lineOfBusiness: { type: 'string', required: true },
        source: { type: 'string' },
        estimatedPremium: { type: 'number', defaultValue: 0 },
        isHotLead: { type: 'boolean', defaultValue: false },
      },
      settings: {
        maxExecutionDurationSeconds: 300, // 5 minutes
        enableAuditLogging: true,
      },
    },
    requiredVariables: ['leadId', 'email', 'lineOfBusiness'],
    isPublic: true,
    createdBy: 'system',
    version: 1,
  },
];

// Combine all templates
export const ALL_TEMPLATES: SeedTemplate[] = [
  ...INSURANCE_TEMPLATES,
  ...PET_INSURANCE_TEMPLATES,
];

/**
 * Seed templates into the database
 * Run this once during initial setup
 */
export async function seedTemplates(): Promise<void> {
  // This would be called during initialization
  // Implementation would use templateRepository.createTemplate for each
  console.log(`Ready to seed ${ALL_TEMPLATES.length} templates`);
  console.log(`- General insurance templates: ${INSURANCE_TEMPLATES.length}`);
  console.log(`- Pet/Medical insurance templates: ${PET_INSURANCE_TEMPLATES.length}`);
}

