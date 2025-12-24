"use strict";
/**
 * Tests for handlePolicyIssued event handler
 * Verifies pipeline integration - skips stage change when pipeline is active
 *
 * Uses dependency injection pattern for testability
 */
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var node_test_1 = require("node:test");
var node_assert_1 = require("node:assert");
// Create testable version of the handler with injected dependencies
function createHandlePolicyIssued(cosmosService, isLeadManagedByPipeline) {
    return function handlePolicyIssued(eventGridEvent, context) {
        return __awaiter(this, void 0, void 0, function () {
            var event_1, data, query, leads, lead, hasPipeline, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 7, , 8]);
                        event_1 = eventGridEvent;
                        data = event_1.data;
                        context.log("Received policy.issued event for lead ".concat(data.leadId));
                        query = {
                            query: 'SELECT * FROM c WHERE c.id = @leadId AND NOT IS_DEFINED(c.deletedAt)',
                            parameters: [{ name: '@leadId', value: data.leadId }]
                        };
                        return [4 /*yield*/, cosmosService.leadsContainer.items.query(query).fetchAll()];
                    case 1:
                        leads = (_a.sent()).resources;
                        if (leads.length === 0) {
                            context.warn("Lead not found: ".concat(data.leadId));
                            return [2 /*return*/];
                        }
                        lead = leads[0];
                        return [4 /*yield*/, isLeadManagedByPipeline(data.leadId)];
                    case 2:
                        hasPipeline = _a.sent();
                        if (!hasPipeline) return [3 /*break*/, 4];
                        context.log("Lead ".concat(data.leadId, " is managed by pipeline - skipping hardcoded stage change"));
                        // Still update policy reference but don't change stage
                        return [4 /*yield*/, cosmosService.updateLead(lead.id, lead.lineOfBusiness, {
                                policyId: data.policyId,
                                updatedAt: expect.any(Date)
                            })];
                    case 3:
                        // Still update policy reference but don't change stage
                        _a.sent();
                        return [2 /*return*/];
                    case 4:
                        // Fallback: No pipeline active - use hardcoded stage change
                        context.log("Lead ".concat(data.leadId, " has no active pipeline - using hardcoded stage change"));
                        // Update lead with stage change
                        return [4 /*yield*/, cosmosService.updateLead(lead.id, lead.lineOfBusiness, {
                                policyId: data.policyId,
                                currentStage: 'Policy Issued',
                                stageId: 'stage-6',
                                updatedAt: expect.any(Date)
                            })];
                    case 5:
                        // Update lead with stage change
                        _a.sent();
                        // Create timeline entry
                        return [4 /*yield*/, cosmosService.createTimelineEntry({
                                id: expect.any(String),
                                leadId: lead.id,
                                stage: 'Policy Issued',
                                previousStage: lead.currentStage,
                                stageId: 'stage-6',
                                remark: "Policy ".concat(data.policyNumber, " issued successfully"),
                                changedBy: 'system',
                                changedByName: 'System',
                                quotationId: data.quotationId,
                                policyId: data.policyId,
                                timestamp: expect.any(Date)
                            })];
                    case 6:
                        // Create timeline entry
                        _a.sent();
                        context.log("Lead updated: ".concat(lead.referenceId, " - Policy Issued"));
                        return [3 /*break*/, 8];
                    case 7:
                        error_1 = _a.sent();
                        context.error('Handle policy issued error:', error_1);
                        return [3 /*break*/, 8];
                    case 8: return [2 /*return*/];
                }
            });
        });
    };
}
// Simple expect matchers for flexible matching
var expect = {
    any: function (type) { return ({ __isAnyMatcher: true, type: type }); },
};
// Helper to compare objects with any matchers
function matchesExpected(actual, expected) {
    if (expected && expected.__isAnyMatcher) {
        if (expected.type === Date)
            return actual instanceof Date;
        if (expected.type === String)
            return typeof actual === 'string';
        return true;
    }
    if (typeof expected === 'object' && expected !== null) {
        for (var _i = 0, _a = Object.keys(expected); _i < _a.length; _i++) {
            var key = _a[_i];
            if (!matchesExpected(actual[key], expected[key]))
                return false;
        }
        return true;
    }
    return actual === expected;
}
// Test fixtures
var createMockLead = function (overrides) {
    if (overrides === void 0) { overrides = {}; }
    return (__assign({ id: 'lead-123', referenceId: 'LEAD-2024-0001', lineOfBusiness: 'medical', currentStage: 'Quotation Sent' }, overrides));
};
var createPolicyIssuedEvent = function (leadId) { return ({
    id: 'event-123',
    eventType: 'policy.issued',
    subject: "policy/policy-123",
    eventTime: new Date().toISOString(),
    data: {
        policyId: 'policy-123',
        policyNumber: 'POL-2024-0001',
        leadId: leadId,
        customerId: 'customer-123',
        quotationId: 'quotation-123',
        vendorName: 'Test Vendor',
        lineOfBusiness: 'medical',
        startDate: new Date(),
        endDate: new Date(),
        annualPremium: 5000
    },
    dataVersion: '1.0'
}); };
var createMockContext = function () { return ({
    log: node_test_1.mock.fn(function () { }),
    warn: node_test_1.mock.fn(function () { }),
    error: node_test_1.mock.fn(function () { })
}); };
(0, node_test_1.describe)('handlePolicyIssued', function () {
    var mockCosmosService;
    var mockIsLeadManagedByPipeline;
    var handlePolicyIssued;
    (0, node_test_1.beforeEach)(function () {
        // Reset mocks for each test
        mockCosmosService = {
            updateLead: node_test_1.mock.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/];
            }); }); }),
            createTimelineEntry: node_test_1.mock.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                return [2 /*return*/];
            }); }); }),
            leadsContainer: {
                items: {
                    query: node_test_1.mock.fn(function () { return ({
                        fetchAll: node_test_1.mock.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
                            return __generator(this, function (_a) {
                                return [2 /*return*/, ({
                                        resources: [createMockLead()]
                                    })];
                            });
                        }); })
                    }); })
                }
            }
        };
        mockIsLeadManagedByPipeline = node_test_1.mock.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
            return [2 /*return*/, false];
        }); }); });
        handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
    });
    (0, node_test_1.describe)('when lead has active pipeline', function () {
        (0, node_test_1.it)('should update policyId but NOT change stage', function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, event, updateCall, updateData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Arrange
                        mockIsLeadManagedByPipeline = node_test_1.mock.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, true];
                        }); }); });
                        handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
                        context = createMockContext();
                        event = createPolicyIssuedEvent('lead-123');
                        // Act
                        return [4 /*yield*/, handlePolicyIssued(event, context)];
                    case 1:
                        // Act
                        _a.sent();
                        // Assert - updateLead should be called once with policyId only (no stage)
                        node_assert_1.default.strictEqual(mockCosmosService.updateLead.mock.calls.length, 1, 'updateLead should be called exactly once');
                        updateCall = mockCosmosService.updateLead.mock.calls[0];
                        node_assert_1.default.strictEqual(updateCall.arguments[0], 'lead-123', 'Should update correct lead');
                        node_assert_1.default.strictEqual(updateCall.arguments[1], 'medical', 'Should use correct partition key');
                        updateData = updateCall.arguments[2];
                        node_assert_1.default.strictEqual(updateData.policyId, 'policy-123', 'Should update policyId');
                        node_assert_1.default.strictEqual(updateData.currentStage, undefined, 'Should NOT update currentStage');
                        node_assert_1.default.strictEqual(updateData.stageId, undefined, 'Should NOT update stageId');
                        // Assert - createTimelineEntry should NOT be called
                        node_assert_1.default.strictEqual(mockCosmosService.createTimelineEntry.mock.calls.length, 0, 'createTimelineEntry should NOT be called when pipeline is active');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, node_test_1.it)('should log that stage change is skipped due to pipeline', function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, event, logCalls, pipelineLogFound;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Arrange
                        mockIsLeadManagedByPipeline = node_test_1.mock.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, true];
                        }); }); });
                        handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
                        context = createMockContext();
                        event = createPolicyIssuedEvent('lead-123');
                        // Act
                        return [4 /*yield*/, handlePolicyIssued(event, context)];
                    case 1:
                        // Act
                        _a.sent();
                        logCalls = context.log.mock.calls;
                        pipelineLogFound = logCalls.some(function (call) {
                            return call.arguments[0].includes('managed by pipeline') &&
                                call.arguments[0].includes('skipping');
                        });
                        node_assert_1.default.ok(pipelineLogFound, 'Should log that pipeline is managing the lead');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, node_test_1.describe)('when lead has NO active pipeline', function () {
        (0, node_test_1.it)('should update stage to Policy Issued', function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, event, updateCall, updateData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Arrange
                        mockIsLeadManagedByPipeline = node_test_1.mock.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, false];
                        }); }); });
                        handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
                        context = createMockContext();
                        event = createPolicyIssuedEvent('lead-123');
                        // Act
                        return [4 /*yield*/, handlePolicyIssued(event, context)];
                    case 1:
                        // Act
                        _a.sent();
                        // Assert - updateLead should be called with stage change
                        node_assert_1.default.strictEqual(mockCosmosService.updateLead.mock.calls.length, 1, 'updateLead should be called exactly once');
                        updateCall = mockCosmosService.updateLead.mock.calls[0];
                        updateData = updateCall.arguments[2];
                        node_assert_1.default.strictEqual(updateData.policyId, 'policy-123', 'Should update policyId');
                        node_assert_1.default.strictEqual(updateData.currentStage, 'Policy Issued', 'Should update stage to Policy Issued');
                        node_assert_1.default.strictEqual(updateData.stageId, 'stage-6', 'Should update stageId');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, node_test_1.it)('should create timeline entry for stage change', function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, event, timelineCall, timelineData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Arrange
                        mockIsLeadManagedByPipeline = node_test_1.mock.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, false];
                        }); }); });
                        handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
                        context = createMockContext();
                        event = createPolicyIssuedEvent('lead-123');
                        // Act
                        return [4 /*yield*/, handlePolicyIssued(event, context)];
                    case 1:
                        // Act
                        _a.sent();
                        // Assert - createTimelineEntry should be called
                        node_assert_1.default.strictEqual(mockCosmosService.createTimelineEntry.mock.calls.length, 1, 'createTimelineEntry should be called exactly once');
                        timelineCall = mockCosmosService.createTimelineEntry.mock.calls[0];
                        timelineData = timelineCall.arguments[0];
                        node_assert_1.default.strictEqual(timelineData.leadId, 'lead-123', 'Timeline should reference correct lead');
                        node_assert_1.default.strictEqual(timelineData.stage, 'Policy Issued', 'Timeline should show Policy Issued stage');
                        node_assert_1.default.strictEqual(timelineData.previousStage, 'Quotation Sent', 'Timeline should track previous stage');
                        node_assert_1.default.strictEqual(timelineData.policyId, 'policy-123', 'Timeline should include policyId');
                        node_assert_1.default.strictEqual(timelineData.remark, 'Policy POL-2024-0001 issued successfully', 'Timeline should include policy number in remark');
                        return [2 /*return*/];
                }
            });
        }); });
        (0, node_test_1.it)('should log fallback message', function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, event, logCalls, fallbackLogFound;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Arrange
                        mockIsLeadManagedByPipeline = node_test_1.mock.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, false];
                        }); }); });
                        handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
                        context = createMockContext();
                        event = createPolicyIssuedEvent('lead-123');
                        // Act
                        return [4 /*yield*/, handlePolicyIssued(event, context)];
                    case 1:
                        // Act
                        _a.sent();
                        logCalls = context.log.mock.calls;
                        fallbackLogFound = logCalls.some(function (call) {
                            return call.arguments[0].includes('no active pipeline') &&
                                call.arguments[0].includes('hardcoded stage change');
                        });
                        node_assert_1.default.ok(fallbackLogFound, 'Should log fallback to hardcoded stage change');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, node_test_1.describe)('when lead is not found', function () {
        (0, node_test_1.it)('should log warning and return early without updates', function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, event;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Arrange - setup mock to return empty results
                        mockCosmosService.leadsContainer.items.query = node_test_1.mock.fn(function () { return ({
                            fetchAll: node_test_1.mock.fn(function () { return __awaiter(void 0, void 0, void 0, function () {
                                return __generator(this, function (_a) {
                                    return [2 /*return*/, ({
                                            resources: []
                                        })];
                                });
                            }); })
                        }); });
                        handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
                        context = createMockContext();
                        event = createPolicyIssuedEvent('nonexistent-lead');
                        // Act
                        return [4 /*yield*/, handlePolicyIssued(event, context)];
                    case 1:
                        // Act
                        _a.sent();
                        // Assert - warn should be called
                        node_assert_1.default.strictEqual(context.warn.mock.calls.length, 1, 'Should log warning');
                        node_assert_1.default.ok(context.warn.mock.calls[0].arguments[0].includes('Lead not found'), 'Warning should indicate lead not found');
                        // Assert - no updates should be performed
                        node_assert_1.default.strictEqual(mockCosmosService.updateLead.mock.calls.length, 0, 'updateLead should NOT be called');
                        node_assert_1.default.strictEqual(mockCosmosService.createTimelineEntry.mock.calls.length, 0, 'createTimelineEntry should NOT be called');
                        // Assert - pipeline check should NOT be called (early return)
                        node_assert_1.default.strictEqual(mockIsLeadManagedByPipeline.mock.calls.length, 0, 'isLeadManagedByPipeline should NOT be called when lead not found');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, node_test_1.describe)('when pipeline service is unavailable', function () {
        (0, node_test_1.it)('should fallback to hardcoded stage change (isLeadManagedByPipeline returns false)', function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, event, updateData;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Arrange - pipeline service returns false when unavailable
                        mockIsLeadManagedByPipeline = node_test_1.mock.fn(function () { return __awaiter(void 0, void 0, void 0, function () { return __generator(this, function (_a) {
                            return [2 /*return*/, false];
                        }); }); });
                        handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
                        context = createMockContext();
                        event = createPolicyIssuedEvent('lead-123');
                        // Act
                        return [4 /*yield*/, handlePolicyIssued(event, context)];
                    case 1:
                        // Act
                        _a.sent();
                        // Assert - should update with full stage change
                        node_assert_1.default.strictEqual(mockCosmosService.updateLead.mock.calls.length, 1, 'updateLead should be called');
                        updateData = mockCosmosService.updateLead.mock.calls[0].arguments[2];
                        node_assert_1.default.strictEqual(updateData.currentStage, 'Policy Issued', 'Should fallback to hardcoded stage change');
                        // Assert - timeline should be created
                        node_assert_1.default.strictEqual(mockCosmosService.createTimelineEntry.mock.calls.length, 1, 'Timeline entry should be created on fallback');
                        return [2 /*return*/];
                }
            });
        }); });
    });
    (0, node_test_1.describe)('error handling', function () {
        (0, node_test_1.it)('should catch and log errors', function () { return __awaiter(void 0, void 0, void 0, function () {
            var context, event;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        // Arrange - setup mock to throw error
                        mockCosmosService.leadsContainer.items.query = node_test_1.mock.fn(function () {
                            throw new Error('Database connection failed');
                        });
                        handlePolicyIssued = createHandlePolicyIssued(mockCosmosService, mockIsLeadManagedByPipeline);
                        context = createMockContext();
                        event = createPolicyIssuedEvent('lead-123');
                        // Act
                        return [4 /*yield*/, handlePolicyIssued(event, context)];
                    case 1:
                        // Act
                        _a.sent();
                        // Assert - error should be logged
                        node_assert_1.default.strictEqual(context.error.mock.calls.length, 1, 'Should log error');
                        node_assert_1.default.ok(context.error.mock.calls[0].arguments[0].includes('Handle policy issued error'), 'Error message should indicate handler error');
                        return [2 /*return*/];
                }
            });
        }); });
    });
});
