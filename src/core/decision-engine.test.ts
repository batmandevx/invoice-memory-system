/**
 * Unit tests for Decision Engine
 * 
 * Tests the confidence-based decision logic and risk assessment
 * functionality of the decision engine.
 */

import { 
  DecisionEngineImpl, 
  DecisionContext, 
  DecisionConfig,
  ValidationIssue,
  IssueSeverity,
  ValidationIssueType
} from './decision-engine';
import { 
  ConfidenceManagerImpl, 
  ConfidenceConfig 
} from './confidence-manager';
import { 
  DecisionType, 
  RiskLevel,
  NormalizedInvoice,
  Memory,
  MemoryType,
  ComplexityLevel,
  QualityLevel,
  ProcessingPriority
} from '../types';
import { DatabaseConnection } from '../database/connection';

describe('DecisionEngine', () => {
  let decisionEngine: DecisionEngineImpl;
  let confidenceManager: ConfidenceManagerImpl;
  let mockDb: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    // Create mock database connection
    mockDb = {
      queryOne: jest.fn(),
      query: jest.fn(),
      execute: jest.fn(),
      close: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn()
    } as any;

    // Mock escalation threshold query
    mockDb.queryOne.mockResolvedValue({ value: '0.7' });

    // Create confidence manager with test config
    const confidenceConfig: Partial<ConfidenceConfig> = {
      baseConfidence: 0.5,
      maxReinforcement: 0.1,
      decayRatePerDay: 0.01
    };
    confidenceManager = new ConfidenceManagerImpl(mockDb, confidenceConfig);

    // Create decision engine with test config
    const decisionConfig: Partial<DecisionConfig> = {
      defaultEscalationThreshold: 0.7,
      autoApprovalThreshold: 0.85,
      rejectionThreshold: 0.3,
      riskTolerance: RiskLevel.MEDIUM,
      conservativeModeForNewVendors: true,
      highValueInvoiceThreshold: 10000
    };
    decisionEngine = new DecisionEngineImpl(confidenceManager, mockDb, decisionConfig);
  });

  afterEach(() => {
    decisionEngine.clearAuditSteps();
  });

  describe('makeDecision', () => {
    it('should auto-approve high confidence invoices with low risk', async () => {
      const context = createTestDecisionContext({
        confidence: 0.9,
        invoiceAmount: 1000,
        validationIssues: []
      });

      const decision = await decisionEngine.makeDecision(context);

      expect(decision.decisionType).toBe(DecisionType.AUTO_APPROVE);
      expect(decision.confidence).toBeGreaterThan(0.8);
      expect(decision.reasoning).toContain('exceeds escalation threshold');
      expect(decision.recommendedActions).toHaveLength(1);
      expect(decision.recommendedActions[0]?.actionType).toBe('apply_correction');
    });

    it('should require human review for medium confidence invoices', async () => {
      const context = createTestDecisionContext({
        confidence: 0.6,
        invoiceAmount: 5000,
        validationIssues: []
      });

      const decision = await decisionEngine.makeDecision(context);

      expect(decision.decisionType).toBe(DecisionType.HUMAN_REVIEW_REQUIRED);
      expect(decision.reasoning).toContain('below escalation threshold');
      expect(decision.recommendedActions.some(action => 
        action.actionType === 'escalate_issue'
      )).toBe(true);
    });

    it('should escalate to expert for high-risk invoices', async () => {
      const context = createTestDecisionContext({
        confidence: 0.8,
        invoiceAmount: 50000, // High value
        validationIssues: [
          {
            severity: IssueSeverity.ERROR,
            issueType: ValidationIssueType.BUSINESS_RULE_VIOLATION,
            affectedField: 'totalAmount',
            description: 'Suspicious amount calculation'
          },
          {
            severity: IssueSeverity.ERROR,
            issueType: ValidationIssueType.INCONSISTENT_DATA,
            affectedField: 'vatAmount',
            description: 'VAT calculation error'
          }
        ]
      });

      const decision = await decisionEngine.makeDecision(context);

      // With multiple errors and high value, should escalate to expert
      expect(decision.decisionType).toBe(DecisionType.ESCALATE_TO_EXPERT);
      expect(decision.riskAssessment.riskLevel).toBe(RiskLevel.VERY_HIGH);
    });

    it('should reject invoices with critical validation issues', async () => {
      const context = createTestDecisionContext({
        confidence: 0.7,
        invoiceAmount: 1000,
        validationIssues: [
          {
            severity: IssueSeverity.CRITICAL,
            issueType: ValidationIssueType.INVALID_FORMAT,
            affectedField: 'invoiceNumber',
            description: 'Invalid invoice number format'
          }
        ]
      });

      const decision = await decisionEngine.makeDecision(context);

      expect(decision.decisionType).toBe(DecisionType.REJECT_INVOICE);
      expect(decision.reasoning).toContain('critical validation issues');
    });

    it('should request additional info for very low confidence', async () => {
      const context = createTestDecisionContext({
        confidence: 0.2,
        invoiceAmount: 1000,
        validationIssues: []
      });

      const decision = await decisionEngine.makeDecision(context);

      expect(decision.decisionType).toBe(DecisionType.REQUEST_ADDITIONAL_INFO);
      expect(decision.reasoning).toContain('Very low confidence');
    });

    it('should apply conservative mode for new vendors', async () => {
      const context = createTestDecisionContext({
        confidence: 0.8,
        invoiceAmount: 1000,
        validationIssues: [],
        appliedMemories: [] // No memories = new vendor
      });

      const decision = await decisionEngine.makeDecision(context);

      expect(decision.decisionType).toBe(DecisionType.HUMAN_REVIEW_REQUIRED);
      expect(decision.reasoning).toContain('limited memory history');
    });
  });

  describe('assessRisk', () => {
    it('should identify financial risk for high-value invoices', async () => {
      const context = createTestDecisionContext({
        confidence: 0.8,
        invoiceAmount: 25000,
        validationIssues: []
      });

      const riskAssessment = await decisionEngine.assessRisk(context);

      expect(riskAssessment.riskFactors.some(factor => 
        factor.riskType === 'financial'
      )).toBe(true);
      expect(riskAssessment.riskLevel).toBeOneOf([RiskLevel.MEDIUM, RiskLevel.HIGH, RiskLevel.VERY_HIGH]);
    });

    it('should identify operational risk for low confidence', async () => {
      const context = createTestDecisionContext({
        confidence: 0.3,
        invoiceAmount: 1000,
        validationIssues: []
      });

      const riskAssessment = await decisionEngine.assessRisk(context);

      expect(riskAssessment.riskFactors.some(factor => 
        factor.riskType === 'operational' && 
        factor.description.includes('Low processing confidence')
      )).toBe(true);
    });

    it('should identify compliance risk for validation issues', async () => {
      const context = createTestDecisionContext({
        confidence: 0.7,
        invoiceAmount: 1000,
        validationIssues: [
          {
            severity: IssueSeverity.CRITICAL,
            issueType: ValidationIssueType.BUSINESS_RULE_VIOLATION,
            affectedField: 'vatAmount',
            description: 'VAT calculation error'
          }
        ]
      });

      const riskAssessment = await decisionEngine.assessRisk(context);

      expect(riskAssessment.riskFactors.some(factor => 
        factor.riskType === 'compliance'
      )).toBe(true);
    });

    it('should provide mitigation strategies for identified risks', async () => {
      const context = createTestDecisionContext({
        confidence: 0.4,
        invoiceAmount: 15000,
        validationIssues: [
          {
            severity: IssueSeverity.ERROR,
            issueType: ValidationIssueType.INCONSISTENT_DATA,
            affectedField: 'totalAmount',
            description: 'Amount mismatch'
          }
        ]
      });

      const riskAssessment = await decisionEngine.assessRisk(context);

      expect(riskAssessment.mitigationStrategies.length).toBeGreaterThan(0);
      expect(riskAssessment.mitigationStrategies.some(strategy =>
        strategy.includes('approval workflow')
      )).toBe(true);
    });
  });

  describe('generateRecommendedActions', () => {
    it('should generate apply correction action for auto-approve decisions', () => {
      const context = createTestDecisionContext({
        confidence: 0.9,
        invoiceAmount: 1000,
        validationIssues: []
      });

      const actions = decisionEngine.generateRecommendedActions(context, DecisionType.AUTO_APPROVE);

      expect(actions).toHaveLength(1);
      expect(actions[0]?.actionType).toBe('apply_correction');
      expect(actions[0]?.priority).toBe('high');
    });

    it('should generate validation actions for human review with issues', () => {
      const context = createTestDecisionContext({
        confidence: 0.6,
        invoiceAmount: 1000,
        validationIssues: [
          {
            severity: IssueSeverity.ERROR,
            issueType: ValidationIssueType.MISSING_FIELD,
            affectedField: 'serviceDate',
            description: 'Service date missing'
          }
        ]
      });

      const actions = decisionEngine.generateRecommendedActions(context, DecisionType.HUMAN_REVIEW_REQUIRED);

      expect(actions.length).toBeGreaterThan(1);
      expect(actions.some(action => action.actionType === 'validate_field')).toBe(true);
      expect(actions.some(action => action.actionType === 'escalate_issue')).toBe(true);
    });

    it('should generate memory update actions for low-confidence memories', () => {
      const lowConfidenceMemory: Memory = {
        id: 'mem-1',
        type: MemoryType.VENDOR,
        pattern: { patternType: 'field_mapping' as any, patternData: {}, threshold: 0.5 },
        confidence: 0.4, // Low confidence
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 5,
        successRate: 0.6,
        context: {
          vendorId: 'vendor-1',
          invoiceCharacteristics: {
            complexity: ComplexityLevel.SIMPLE,
            language: 'en',
            documentFormat: 'pdf',
            extractionQuality: QualityLevel.GOOD
          },
          historicalContext: {
            recentResults: [],
            trendingPatterns: [],
            seasonalFactors: []
          },
          environmentalFactors: []
        }
      };

      const context = createTestDecisionContext({
        confidence: 0.7,
        invoiceAmount: 1000,
        validationIssues: [],
        appliedMemories: [lowConfidenceMemory]
      });

      const actions = decisionEngine.generateRecommendedActions(context, DecisionType.AUTO_APPROVE);

      expect(actions.some(action => action.actionType === 'update_memory')).toBe(true);
    });
  });

  describe('audit trail', () => {
    it('should record audit steps for decision making', async () => {
      const context = createTestDecisionContext({
        confidence: 0.8,
        invoiceAmount: 1000,
        validationIssues: []
      });

      await decisionEngine.makeDecision(context);

      const auditSteps = decisionEngine.getAuditSteps();
      expect(auditSteps).toHaveLength(1);
      expect(auditSteps[0]?.operation).toBe('decision_making');
      expect(auditSteps[0]?.actor).toBe('DecisionEngine');
      expect(auditSteps[0]?.input).toHaveProperty('confidence', 0.8);
      expect(auditSteps[0]?.output).toHaveProperty('decisionType');
    });
  });

  // Helper function to create test decision context
  function createTestDecisionContext(options: {
    confidence: number;
    invoiceAmount: number;
    validationIssues: ValidationIssue[];
    appliedMemories?: Memory[];
  }): DecisionContext {
    const invoice: NormalizedInvoice = {
      id: 'test-invoice-1',
      vendorId: 'test-vendor-1',
      invoiceNumber: 'INV-001',
      invoiceDate: new Date(),
      totalAmount: {
        amount: options.invoiceAmount,
        currency: 'USD'
      },
      currency: 'USD',
      lineItems: [
        {
          description: 'Test item',
          quantity: 1,
          unitPrice: { amount: options.invoiceAmount, currency: 'USD' },
          totalPrice: { amount: options.invoiceAmount, currency: 'USD' }
        }
      ],
      normalizedFields: []
    };

    return {
      invoice,
      confidence: options.confidence,
      appliedMemories: options.appliedMemories || [],
      memoryContext: {
        vendorId: 'test-vendor-1',
        invoiceCharacteristics: {
          complexity: ComplexityLevel.SIMPLE,
          language: 'en',
          documentFormat: 'pdf',
          extractionQuality: QualityLevel.GOOD
        },
        historicalContext: {
          recentResults: [],
          trendingPatterns: [],
          seasonalFactors: []
        },
        environmentalFactors: []
      },
      environment: {
        timestamp: new Date(),
        priority: ProcessingPriority.NORMAL,
        timeConstraints: {
          maxProcessingTime: 30000,
          realTimeRequired: false
        },
        regulatoryContext: {
          regulations: [],
          complianceRequirements: [],
          auditRequirements: []
        }
      },
      validationIssues: options.validationIssues
    };
  }
});

// Custom Jest matcher for testing enum values
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}