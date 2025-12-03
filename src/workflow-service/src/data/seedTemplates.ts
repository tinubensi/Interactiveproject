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

/**
 * Seed templates into the database
 * Run this once during initial setup
 */
export async function seedTemplates(): Promise<void> {
  // This would be called during initialization
  // Implementation would use templateRepository.createTemplate for each
  console.log(`Ready to seed ${INSURANCE_TEMPLATES.length} templates`);
}

