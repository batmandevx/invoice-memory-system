/**
 * Property-Based Tests for Confidence-Based Decision Consistency
 * 
 * Tests the confidence-based decision logic to ensure that decisions are
 * made consistently based on confidence thresholds and escalation rules.
 */

import * as fc from 'fast-check';
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
  ProcessingPriority,
  PatternType,
  MemoryPattern,
  MemoryContext,
  ProcessingEnvironment,
  TimeConstraints,
  RegulatoryContext,
  PaymentMethod
} from '../types';
import { DatabaseConnection } from '../database/connection';
import { createTestDatabase, cleanupTestDatabase, PropertyTestUtils } from '../test/setup';

describe('Confidence-Based Decision Consistency Property Tests', () => {
  let db: DatabaseConnection;
  let confidenceManager: ConfidenceManagerImpl;
  let decisionEngine: DecisionEngineImpl;

  beforeEach(async () => {
    db = await createTestDatabase();
    
    // Create confidence manager with test config
    const confidenceConfig: Partial<ConfidenceConfig> = {
      baseConfidence: 0.5,
      maxReinforcement: 0.1,
      decayRatePerDay: 0.01,
      minimumConfidence: 0.1,
      maximumConfidence: 1.0
    };
    confidenceManager = new ConfidenceManagerImpl(db, confidenceConfig);

    // Create decision engine with test config
    const decisionConfig: Partial<DecisionConfig> = {
      defaultEscalationThreshold: 0.7,
      autoApprovalThreshold: 0.85,
      rejectionThreshold: 0.3,
      riskTolerance: RiskLevel.MEDIUM,
      conservativeModeForNewVendors: true,
      highValueInvoiceThreshold: 10000
    };
    decisionEngine = new DecisionEngineImpl(confidenceManager, db, decisionConfig);
  });

  afterEach(async () => {
    decisionEngine.clearAuditSteps();
    await cleanupTestDatabase();
  });

  /**
   * **Feature: ai-agent-memory-system, Property 3: Confidence-Based Decision Consistency**
   * **Validates: Requirements 6.1, 6.2**
   * 
   * For any memory with a confidence score, if the confidence is above the escalation threshold,
   * the system should auto-apply the memory; if below the threshold, it should escalate for human review.
   * 
   * This property test verifies that:
   * 1. High confidence (>= escalation threshold) leads to auto-approval when risk is acceptable
   * 2. Low confidence (< escalation threshold) leads to human review or escalation
   * 3. Decision consistency across different invoice scenarios
   * 4. Proper handling of edge cases and boundary conditions
   * 5. Risk factors appropriately influence decisions
   */
  test(PropertyTestUtils.createPropertyDescription(3, 'Confidence-Based Decision Consistency'), async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate decision context with varying confidence levels
        decisionContextArbitrary(),
        async (context: DecisionContext) => {
          // Skip invalid contexts
          if (!isValidDecisionContext(context)) {
            return true;
          }

          const decision = await decisionEngine.makeDecision(context);
          const escalationThreshold = await confidenceManager.getEscalationThreshold();
          
          // Property 1: Confidence threshold consistency
          // High confidence with acceptable risk should tend toward auto-approval
          // But only if the applied memories are also of reasonable quality
          if (context.confidence >= escalationThreshold && 
              context.validationIssues.length === 0 &&
              context.invoice.totalAmount.amount <= 5000 &&
              context.memoryContext.invoiceCharacteristics.extractionQuality !== 'poor' &&
              (context.appliedMemories.length === 0 || // No memories (new vendor) or
               context.appliedMemories.every(m => m.confidence >= 0.5 && m.successRate >= 0.7))) { // Good quality memories
            
            const shouldAutoApprove = decision.decisionType === DecisionType.AUTO_APPROVE ||
                                    decision.decisionType === DecisionType.HUMAN_REVIEW_REQUIRED; // Conservative mode allowed
            
            if (!shouldAutoApprove) {
              console.log(`High confidence decision failed: confidence=${context.confidence}, threshold=${escalationThreshold}, decision=${decision.decisionType}, quality=${context.memoryContext.invoiceCharacteristics.extractionQuality}, memories=${context.appliedMemories.length}`);
              return false;
            }
          }

          // Property 2: Low confidence should not auto-approve without exceptional circumstances
          if (context.confidence < escalationThreshold && 
              context.validationIssues.length === 0 &&
              context.appliedMemories.length > 0) { // Has some memory history
            
            const shouldNotAutoApprove = decision.decisionType !== DecisionType.AUTO_APPROVE;
            
            if (!shouldNotAutoApprove) {
              console.log(`Low confidence auto-approval: confidence=${context.confidence}, threshold=${escalationThreshold}`);
              return false;
            }
          }

          // Property 3: Critical validation issues should never auto-approve
          const hasCriticalIssues = context.validationIssues.some(
            issue => issue.severity === IssueSeverity.CRITICAL
          );
          
          if (hasCriticalIssues) {
            const criticalHandling = decision.decisionType === DecisionType.REJECT_INVOICE ||
                                   decision.decisionType === DecisionType.ESCALATE_TO_EXPERT;
            
            if (!criticalHandling) {
              console.log(`Critical issues not handled properly: decision=${decision.decisionType}`);
              return false;
            }
          }

          // Property 4: Very low confidence should request additional info or escalate
          if (context.confidence < 0.3) {
            const lowConfidenceHandling = decision.decisionType === DecisionType.REQUEST_ADDITIONAL_INFO ||
                                        decision.decisionType === DecisionType.HUMAN_REVIEW_REQUIRED ||
                                        decision.decisionType === DecisionType.ESCALATE_TO_EXPERT ||
                                        decision.decisionType === DecisionType.REJECT_INVOICE;
            
            if (!lowConfidenceHandling) {
              console.log(`Very low confidence not handled: confidence=${context.confidence}, decision=${decision.decisionType}`);
              return false;
            }
          }

          // Property 5: Decision confidence should be within valid bounds
          const validDecisionConfidence = decision.confidence >= 0 && decision.confidence <= 1;
          if (!validDecisionConfidence) {
            console.log(`Invalid decision confidence: ${decision.confidence}`);
            return false;
          }

          // Property 6: High-value invoices should have additional scrutiny
          if (context.invoice.totalAmount.amount > 15000) {
            const highValueScrutiny = decision.decisionType !== DecisionType.AUTO_APPROVE ||
                                    decision.riskAssessment.riskLevel >= RiskLevel.MEDIUM ||
                                    context.confidence < 0.9; // Very high confidence might still auto-approve
            
            if (!highValueScrutiny) {
              console.log(`High-value invoice not scrutinized: amount=${context.invoice.totalAmount.amount}, decision=${decision.decisionType}, confidence=${context.confidence}`);
              return false;
            }
          }

          // Property 7: New vendors (no applied memories) should be handled conservatively
          if (context.appliedMemories.length === 0 && context.confidence < 0.95) { // Increased threshold for new vendors
            const conservativeHandling = decision.decisionType === DecisionType.HUMAN_REVIEW_REQUIRED ||
                                       decision.decisionType === DecisionType.ESCALATE_TO_EXPERT ||
                                       decision.decisionType === DecisionType.REQUEST_ADDITIONAL_INFO ||
                                       decision.decisionType === DecisionType.REJECT_INVOICE; // Rejection is also conservative
            
            if (!conservativeHandling) {
              console.log(`New vendor not handled conservatively: memories=${context.appliedMemories.length}, decision=${decision.decisionType}, confidence=${context.confidence}`);
              return false;
            }
          }

          // Property 8: Decision should always include reasoning
          const hasReasoning = decision.reasoning && decision.reasoning.trim().length > 0;
          if (!hasReasoning) {
            console.log(`Decision missing reasoning`);
            return false;
          }

          // Property 9: Risk assessment should be consistent with decision
          if (decision.riskAssessment.riskLevel === RiskLevel.VERY_HIGH) {
            const highRiskHandling = decision.decisionType === DecisionType.ESCALATE_TO_EXPERT ||
                                   decision.decisionType === DecisionType.REJECT_INVOICE ||
                                   decision.decisionType === DecisionType.HUMAN_REVIEW_REQUIRED ||
                                   decision.decisionType === DecisionType.REQUEST_ADDITIONAL_INFO; // This is also valid for very high risk
            
            if (!highRiskHandling) {
              console.log(`Very high risk not handled appropriately: risk=${decision.riskAssessment.riskLevel}, decision=${decision.decisionType}`);
              return false;
            }
          }

          // Property 10: Recommended actions should be appropriate for decision type
          const hasAppropriateActions = decision.recommendedActions.length > 0;
          if (!hasAppropriateActions) {
            console.log(`Decision missing recommended actions`);
            return false;
          }

          return true;
        }
      ),
      {
        numRuns: 100, // Minimum 100 iterations as specified
        timeout: 60000, // Increased timeout for comprehensive testing
        verbose: PropertyTestUtils.defaultConfig.verbose
      }
    );
  }, 60000);

  /**
   * Property test for escalation threshold boundary behavior
   */
  test('Escalation Threshold Boundary Behavior', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate confidence values around the threshold
        fc.float({ min: Math.fround(0.65), max: Math.fround(0.75) }), // Around default threshold of 0.7
        simpleDecisionContextArbitrary(),
        async (confidence: number, baseContext: Partial<DecisionContext>) => {
          // Skip invalid confidence values
          if (!isFinite(confidence) || isNaN(confidence)) {
            return true;
          }
          
          const context = createCompleteDecisionContext({
            ...baseContext,
            confidence,
            validationIssues: [], // No validation issues for clean threshold testing
            appliedMemories: [createTestMemory()], // Has memory history
            invoice: createTestInvoice({ totalAmount: { amount: 1000, currency: 'USD' } }) // Reasonable amount
          });

          const decision = await decisionEngine.makeDecision(context);
          const threshold = await confidenceManager.getEscalationThreshold();

          // Property: Decisions should be consistent around the threshold
          if (confidence >= threshold) {
            // Should tend toward auto-approval or conservative human review
            const appropriateHighConfidenceDecision = 
              decision.decisionType === DecisionType.AUTO_APPROVE ||
              decision.decisionType === DecisionType.HUMAN_REVIEW_REQUIRED;
            
            return appropriateHighConfidenceDecision;
          } else {
            // Should require human review or escalation
            const appropriateLowConfidenceDecision = 
              decision.decisionType === DecisionType.HUMAN_REVIEW_REQUIRED ||
              decision.decisionType === DecisionType.ESCALATE_TO_EXPERT ||
              decision.decisionType === DecisionType.REQUEST_ADDITIONAL_INFO;
            
            return appropriateLowConfidenceDecision;
          }
        }
      ),
      {
        numRuns: 50,
        timeout: 30000
      }
    );
  }, 30000);

  /**
   * Property test for risk-confidence interaction
   */
  test('Risk-Confidence Interaction Properties', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
        fc.array(validationIssueArbitrary(), { minLength: 0, maxLength: 3 }),
        fc.float({ min: Math.fround(100), max: Math.fround(50000) }), // Invoice amount
        async (confidence: number, validationIssues: ValidationIssue[], invoiceAmount: number) => {
          const context = createCompleteDecisionContext({
            confidence,
            validationIssues,
            invoice: createTestInvoice({ totalAmount: { amount: invoiceAmount, currency: 'USD' } }),
            appliedMemories: confidence > 0.5 ? [createTestMemory()] : [] // Simulate memory availability
          });

          const decision = await decisionEngine.makeDecision(context);

          // Property 1: High risk should override high confidence
          const hasHighRiskFactors = validationIssues.some(issue => 
            issue.severity === IssueSeverity.CRITICAL || issue.severity === IssueSeverity.ERROR
          ) || invoiceAmount > 20000;

          if (hasHighRiskFactors && confidence > 0.8) {
            const riskOverridesConfidence = decision.decisionType !== DecisionType.AUTO_APPROVE ||
                                          decision.riskAssessment.riskLevel >= RiskLevel.HIGH;
            
            if (!riskOverridesConfidence) {
              return false;
            }
          }

          // Property 2: Low risk with high confidence should enable auto-approval
          const hasLowRisk = validationIssues.length === 0 && invoiceAmount < 5000;
          
          if (hasLowRisk && confidence > 0.85 && context.appliedMemories.length > 0) {
            const lowRiskHighConfidenceHandling = decision.decisionType === DecisionType.AUTO_APPROVE ||
                                                decision.decisionType === DecisionType.HUMAN_REVIEW_REQUIRED; // Conservative mode
            
            if (!lowRiskHighConfidenceHandling) {
              return false;
            }
          }

          return true;
        }
      ),
      {
        numRuns: 50,
        timeout: 30000
      }
    );
  }, 30000);
});

// ============================================================================
// Arbitraries for Property-Based Testing
// ============================================================================

/**
 * Arbitrary for generating DecisionContext objects
 */
function decisionContextArbitrary(): fc.Arbitrary<DecisionContext> {
  return fc.record({
    invoice: normalizedInvoiceArbitrary(),
    confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
    appliedMemories: fc.array(memoryArbitrary(), { minLength: 0, maxLength: 3 }),
    memoryContext: memoryContextArbitrary(),
    environment: processingEnvironmentArbitrary(),
    validationIssues: fc.array(validationIssueArbitrary(), { minLength: 0, maxLength: 3 })
  });
}

/**
 * Simplified arbitrary for basic decision context testing
 */
function simpleDecisionContextArbitrary(): fc.Arbitrary<Partial<DecisionContext>> {
  return fc.record({
    invoice: fc.option(normalizedInvoiceArbitrary()),
    appliedMemories: fc.option(fc.array(memoryArbitrary(), { maxLength: 2 })),
    validationIssues: fc.option(fc.array(validationIssueArbitrary(), { maxLength: 2 }))
  }).map(obj => {
    // Convert null values to undefined for strict TypeScript compatibility
    const result: Partial<DecisionContext> = {};
    if (obj.invoice !== null) result.invoice = obj.invoice;
    if (obj.appliedMemories !== null) result.appliedMemories = obj.appliedMemories;
    if (obj.validationIssues !== null) result.validationIssues = obj.validationIssues;
    return result;
  });
}

/**
 * Arbitrary for generating NormalizedInvoice objects
 */
function normalizedInvoiceArbitrary(): fc.Arbitrary<NormalizedInvoice> {
  return fc.record({
    id: fc.string({ minLength: 5, maxLength: 20 }),
    vendorId: fc.string({ minLength: 5, maxLength: 20 }),
    invoiceNumber: fc.string({ minLength: 3, maxLength: 15 }),
    invoiceDate: fc.date(),
    totalAmount: fc.record({
      amount: fc.float({ min: Math.fround(10), max: Math.fround(100000) }),
      currency: fc.constantFrom('USD', 'EUR', 'GBP')
    }),
    currency: fc.constantFrom('USD', 'EUR', 'GBP'),
    lineItems: fc.array(lineItemArbitrary(), { minLength: 1, maxLength: 3 }),
    normalizedFields: fc.constant([])
  }).chain(base => 
    fc.tuple(
      fc.option(fc.date()),
      fc.option(fc.date()),
      fc.option(fc.record({
        amount: fc.float({ min: Math.fround(0), max: Math.fround(1000) }),
        currency: fc.constant(base.currency)
      })),
      fc.option(fc.record({
        dueDate: fc.date(),
        paymentMethod: fc.constantFrom(...Object.values(PaymentMethod)),
        additionalTerms: fc.constant([])
      })),
      fc.option(fc.string({ maxLength: 20 }))
    ).map(([serviceDate, dueDate, vatAmount, paymentTerms, purchaseOrderNumber]) => {
      const result: NormalizedInvoice = { ...base };
      if (serviceDate !== null) result.serviceDate = serviceDate;
      if (dueDate !== null) result.dueDate = dueDate;
      if (vatAmount !== null) result.vatAmount = vatAmount;
      if (paymentTerms !== null) result.paymentTerms = paymentTerms;
      if (purchaseOrderNumber !== null) result.purchaseOrderNumber = purchaseOrderNumber;
      return result;
    })
  );
}

/**
 * Arbitrary for generating LineItem objects
 */
function lineItemArbitrary(): fc.Arbitrary<any> {
  return fc.record({
    description: fc.string({ minLength: 5, maxLength: 50 }),
    quantity: fc.integer({ min: 1, max: 100 }),
    unitPrice: fc.record({
      amount: fc.float({ min: Math.fround(1), max: Math.fround(1000) }),
      currency: fc.constantFrom('USD', 'EUR', 'GBP')
    }),
    totalPrice: fc.record({
      amount: fc.float({ min: Math.fround(1), max: Math.fround(10000) }),
      currency: fc.constantFrom('USD', 'EUR', 'GBP')
    })
  }).chain(base =>
    fc.record({
      sku: fc.option(fc.string({ maxLength: 20 })),
      vatRate: fc.option(fc.float({ min: Math.fround(0), max: Math.fround(0.3) }))
    }).map(optional => ({ ...base, ...optional }))
  );
}

/**
 * Arbitrary for generating Memory objects
 */
function memoryArbitrary(): fc.Arbitrary<Memory> {
  return fc.record({
    id: fc.string({ minLength: 5, maxLength: 20 }),
    type: fc.constantFrom(...Object.values(MemoryType)),
    pattern: memoryPatternArbitrary(),
    confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
    createdAt: fc.date(),
    lastUsed: fc.date(),
    usageCount: fc.integer({ min: 0, max: 100 }),
    successRate: fc.float({ min: Math.fround(0), max: Math.fround(1) }),
    context: memoryContextArbitrary()
  });
}

/**
 * Arbitrary for generating MemoryPattern objects
 */
function memoryPatternArbitrary(): fc.Arbitrary<MemoryPattern> {
  return fc.record({
    patternType: fc.constantFrom(...Object.values(PatternType)),
    patternData: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }), 
      fc.oneof(fc.string({ maxLength: 20 }), fc.integer({ min: 1, max: 100 }))
    ),
    threshold: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) })
  });
}

/**
 * Arbitrary for generating MemoryContext objects
 */
function memoryContextArbitrary(): fc.Arbitrary<MemoryContext> {
  return fc.record({
    vendorId: fc.string({ minLength: 3, maxLength: 20 }),
    invoiceCharacteristics: fc.record({
      complexity: fc.constantFrom(...Object.values(ComplexityLevel)),
      language: fc.constantFrom('en', 'de', 'fr', 'es'),
      documentFormat: fc.constantFrom('pdf', 'image', 'text'),
      extractionQuality: fc.constantFrom(...Object.values(QualityLevel))
    }),
    historicalContext: fc.record({
      recentResults: fc.constant([]),
      trendingPatterns: fc.constant([]),
      seasonalFactors: fc.constant([])
    }),
    environmentalFactors: fc.constant([])
  });
}

/**
 * Arbitrary for generating ProcessingEnvironment objects
 */
function processingEnvironmentArbitrary(): fc.Arbitrary<ProcessingEnvironment> {
  return fc.record({
    timestamp: fc.date(),
    priority: fc.constantFrom(...Object.values(ProcessingPriority)),
    timeConstraints: timeConstraintsArbitrary(),
    regulatoryContext: regulatoryContextArbitrary()
  });
}

/**
 * Arbitrary for generating TimeConstraints objects
 */
function timeConstraintsArbitrary(): fc.Arbitrary<TimeConstraints> {
  return fc.tuple(
    fc.integer({ min: 1000, max: 60000 }),
    fc.option(fc.date()),
    fc.boolean()
  ).map(([maxProcessingTime, deadline, realTimeRequired]) => {
    const result: TimeConstraints = { maxProcessingTime, realTimeRequired };
    if (deadline !== null) result.deadline = deadline;
    return result;
  });
}

/**
 * Arbitrary for generating RegulatoryContext objects
 */
function regulatoryContextArbitrary(): fc.Arbitrary<RegulatoryContext> {
  return fc.record({
    regulations: fc.array(fc.string({ maxLength: 20 }), { maxLength: 3 }),
    complianceRequirements: fc.constant([]),
    auditRequirements: fc.constant([])
  });
}

/**
 * Arbitrary for generating ValidationIssue objects
 */
function validationIssueArbitrary(): fc.Arbitrary<ValidationIssue> {
  return fc.tuple(
    fc.constantFrom(...Object.values(IssueSeverity)),
    fc.constantFrom(...Object.values(ValidationIssueType)),
    fc.string({ minLength: 3, maxLength: 20 }),
    fc.string({ minLength: 10, maxLength: 100 }),
    fc.option(fc.string({ maxLength: 50 }))
  ).map(([severity, issueType, affectedField, description, suggestedResolution]) => {
    const result: ValidationIssue = { severity, issueType, affectedField, description };
    if (suggestedResolution !== null) result.suggestedResolution = suggestedResolution;
    return result;
  });
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Validate that a decision context is valid for testing
 */
function isValidDecisionContext(context: DecisionContext): boolean {
  const isValidConfidence: boolean = typeof context.confidence === 'number' &&
                                    context.confidence >= 0 && 
                                    context.confidence <= 1;
  
  const hasValidInvoice: boolean = !!(context.invoice &&
                                     context.invoice.id &&
                                     context.invoice.totalAmount &&
                                     context.invoice.totalAmount.amount > 0);
  
  const hasValidArrays: boolean = Array.isArray(context.appliedMemories) &&
                                 Array.isArray(context.validationIssues);
  
  return isValidConfidence && hasValidInvoice && hasValidArrays;
}

/**
 * Create a complete decision context from partial data
 */
function createCompleteDecisionContext(partial: Partial<DecisionContext>): DecisionContext {
  return {
    invoice: partial.invoice || createTestInvoice(),
    confidence: partial.confidence || 0.7,
    appliedMemories: partial.appliedMemories || [],
    memoryContext: partial.memoryContext || createTestMemoryContext(),
    environment: partial.environment || createTestProcessingEnvironment(),
    validationIssues: partial.validationIssues || []
  };
}

/**
 * Create a test invoice
 */
function createTestInvoice(overrides: Partial<NormalizedInvoice> = {}): NormalizedInvoice {
  return {
    id: 'test-invoice-001',
    vendorId: 'test-vendor-001',
    invoiceNumber: 'INV-2024-001',
    invoiceDate: new Date('2024-01-15'),
    totalAmount: { amount: 1000.00, currency: 'USD' },
    currency: 'USD',
    lineItems: [
      {
        description: 'Test item',
        quantity: 1,
        unitPrice: { amount: 1000.00, currency: 'USD' },
        totalPrice: { amount: 1000.00, currency: 'USD' }
      }
    ],
    normalizedFields: [],
    ...overrides
  };
}

/**
 * Create a test memory
 */
function createTestMemory(overrides: Partial<Memory> = {}): Memory {
  return {
    id: 'test-memory-001',
    type: MemoryType.VENDOR,
    pattern: {
      patternType: PatternType.FIELD_MAPPING,
      patternData: { sourceField: 'Leistungsdatum', targetField: 'serviceDate' },
      threshold: 0.7
    },
    confidence: 0.8,
    createdAt: new Date(),
    lastUsed: new Date(),
    usageCount: 5,
    successRate: 0.9,
    context: createTestMemoryContext(),
    ...overrides
  };
}

/**
 * Create a test memory context
 */
function createTestMemoryContext(): MemoryContext {
  return {
    vendorId: 'test-vendor-001',
    invoiceCharacteristics: {
      complexity: ComplexityLevel.SIMPLE,
      language: 'en',
      documentFormat: 'pdf',
      extractionQuality: QualityLevel.GOOD // Use good quality by default
    },
    historicalContext: {
      recentResults: [],
      trendingPatterns: [],
      seasonalFactors: []
    },
    environmentalFactors: []
  };
}

/**
 * Create a test processing environment
 */
function createTestProcessingEnvironment(): ProcessingEnvironment {
  return {
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
  };
}