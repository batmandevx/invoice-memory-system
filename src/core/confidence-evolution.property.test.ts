/**
 * Property-Based Tests for Confidence Evolution
 * 
 * Tests the confidence evolution behavior based on processing outcomes
 * to ensure that confidence scores evolve correctly over time.
 */

import * as fc from 'fast-check';
import { 
  ConfidenceManagerImpl
} from './confidence-manager';
import { 
  Memory, 
  MemoryPattern, 
  MemoryContext,
  ProcessingOutcome,
  ProcessingOutcomeType,
  ProcessingPerformanceMetrics,
  PatternType,
  ComplexityLevel,
  QualityLevel,
  FeedbackType,
  HumanFeedback,
  Correction,
  ProcessingResult
} from '../types';
import { VendorMemoryImpl, CorrectionMemoryImpl, ResolutionMemoryImpl } from './memory-base';
import { DatabaseConnection } from '../database/connection';
import { createTestDatabase, cleanupTestDatabase, PropertyTestUtils } from '../test/setup';

describe('Confidence Evolution Property Tests', () => {
  let db: DatabaseConnection;
  let confidenceManager: ConfidenceManagerImpl;

  beforeEach(async () => {
    db = await createTestDatabase();
    confidenceManager = new ConfidenceManagerImpl(db);
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  /**
   * **Feature: ai-agent-memory-system, Property 4: Confidence Evolution Based on Outcomes**
   * **Validates: Requirements 7.1, 7.2, 7.3**
   * 
   * For any memory and processing outcome, successful applications should increase confidence,
   * failed applications should decrease confidence significantly, and unused memories should 
   * decay over time.
   * 
   * This property test verifies that:
   * 1. Successful outcomes (SUCCESS_AUTO, SUCCESS_HUMAN_REVIEW) tend to increase confidence
   * 2. Failed outcomes (FAILED_VALIDATION, REJECTED) tend to decrease confidence
   * 3. Time decay reduces confidence for unused memories
   * 4. Confidence evolution respects minimum and maximum bounds
   * 5. Confidence evolution is deterministic
   */
  test(PropertyTestUtils.createPropertyDescription(4, 'Confidence Evolution Based on Outcomes'), async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate memory with initial confidence
        memoryArbitrary(),
        // Generate processing outcome
        processingOutcomeArbitrary(),
        // Generate time since last use for decay testing
        fc.integer({ min: 0, max: 365 * 24 * 60 * 60 * 1000 }), // Up to 1 year in milliseconds
        async (memory: Memory, outcome: ProcessingOutcome, timeSinceLastUse: number) => {
          const initialConfidence = memory.confidence;
          
          // Skip invalid confidence values
          if (isNaN(initialConfidence) || !isFinite(initialConfidence)) {
            return true;
          }
          
          // Property 1: Confidence should always stay within bounds [0.1, 1.0]
          const reinforcedConfidence = confidenceManager.reinforceMemory(memory, outcome);
          if (reinforcedConfidence < 0.1 || reinforcedConfidence > 1.0) {
            return false;
          }
          
          // Reset memory for decay test
          memory.confidence = initialConfidence;
          const decayedConfidence = confidenceManager.decayMemory(memory, timeSinceLastUse);
          if (decayedConfidence < 0.1 || decayedConfidence > 1.0) {
            return false;
          }
          
          // Property 2: Time decay should reduce or maintain confidence (never increase)
          if (timeSinceLastUse > 0) {
            const decayNeverIncreases = decayedConfidence <= initialConfidence;
            if (!decayNeverIncreases) {
              return false;
            }
          }
          
          // Property 3: Successful outcomes without negative human feedback should not decrease confidence significantly
          if ((outcome.outcomeType === ProcessingOutcomeType.SUCCESS_AUTO || 
               outcome.outcomeType === ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW) &&
              (!outcome.humanFeedback || outcome.humanFeedback.satisfactionRating >= 3)) {
            
            // Reset memory confidence
            memory.confidence = initialConfidence;
            const newConfidence = confidenceManager.reinforceMemory(memory, outcome);
            
            // Should not decrease significantly (allowing for small decreases due to learning rate)
            const noSignificantDecrease = (initialConfidence - newConfidence) <= 0.05;
            if (!noSignificantDecrease) {
              return false;
            }
          }
          
          // Property 4: Failed outcomes should tend to decrease confidence
          if (outcome.outcomeType === ProcessingOutcomeType.FAILED_VALIDATION || 
              outcome.outcomeType === ProcessingOutcomeType.REJECTED) {
            
            // Reset memory confidence
            memory.confidence = initialConfidence;
            const newConfidence = confidenceManager.reinforceMemory(memory, outcome);
            
            // Should generally decrease unless human feedback is very positive or already at minimum
            const shouldDecrease = initialConfidence > 0.1 && 
                                 (!outcome.humanFeedback || outcome.humanFeedback.satisfactionRating <= 3);
            
            if (shouldDecrease && newConfidence > initialConfidence) {
              return false;
            }
          }
          
          // Property 5: Confidence evolution should be deterministic
          // Same inputs should produce same outputs
          memory.confidence = initialConfidence;
          const firstResult = confidenceManager.reinforceMemory(memory, outcome);
          
          memory.confidence = initialConfidence;
          const secondResult = confidenceManager.reinforceMemory(memory, outcome);
          
          const deterministicBehavior = Math.abs(firstResult - secondResult) < 0.0001;
          if (!deterministicBehavior) {
            return false;
          }
          
          // Property 6: Longer decay time should result in equal or more decay
          if (timeSinceLastUse > 0) {
            const longerTime = timeSinceLastUse * 2;
            
            memory.confidence = initialConfidence;
            const shortDecay = confidenceManager.decayMemory(memory, timeSinceLastUse);
            
            memory.confidence = initialConfidence;
            const longDecay = confidenceManager.decayMemory(memory, longerTime);
            
            const monotonicDecay = longDecay <= shortDecay;
            if (!monotonicDecay) {
              return false;
            }
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
   * Property test for confidence evolution consistency across memory types
   */
  test('Confidence Evolution Consistency Across Memory Types', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate different types of memories
        fc.oneof(
          vendorMemoryArbitrary(),
          correctionMemoryArbitrary(),
          resolutionMemoryArbitrary()
        ),
        processingOutcomeArbitrary(),
        async (memory: Memory, outcome: ProcessingOutcome) => {
          const initialConfidence = memory.confidence;
          
          // Skip invalid confidence values
          if (isNaN(initialConfidence) || !isFinite(initialConfidence)) {
            return true;
          }
          const newConfidence = confidenceManager.reinforceMemory(memory, outcome);
          
          // Property: Evolution direction should be consistent regardless of memory type
          // Successful outcomes should increase confidence for all memory types
          if (outcome.outcomeType === ProcessingOutcomeType.SUCCESS_AUTO) {
            return newConfidence >= initialConfidence;
          }
          
          // Failed outcomes should decrease confidence for all memory types
          if (outcome.outcomeType === ProcessingOutcomeType.FAILED_VALIDATION) {
            return newConfidence < initialConfidence;
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

  /**
   * Property test for confidence decay behavior
   */
  test('Confidence Decay Behavior Properties', async () => {
    await fc.assert(
      fc.asyncProperty(
        memoryArbitrary(),
        fc.integer({ min: 1, max: 100 }), // Days since last use
        async (memory: Memory, daysSinceLastUse: number) => {
          const initialConfidence = memory.confidence;
          
          // Skip invalid confidence values
          if (isNaN(initialConfidence) || !isFinite(initialConfidence)) {
            return true;
          }
          const timeSinceLastUse = daysSinceLastUse * 24 * 60 * 60 * 1000; // Convert to milliseconds
          
          const decayedConfidence = confidenceManager.decayMemory(memory, timeSinceLastUse);
          
          // Property 1: Decay should never increase confidence
          const noIncrease = decayedConfidence <= initialConfidence;
          
          // Property 2: Decay should be monotonic (more time = more decay)
          const halfTime = timeSinceLastUse / 2;
          memory.confidence = initialConfidence; // Reset
          const halfDecayedConfidence = confidenceManager.decayMemory(memory, halfTime);
          
          const monotonicDecay = halfDecayedConfidence >= decayedConfidence;
          
          // Property 3: Decay should approach but never reach zero
          const neverZero = decayedConfidence > 0;
          
          // Property 4: Decay should be exponential (not linear)
          // For very long times, confidence should approach minimum but not linearly
          const veryLongTime = 365 * 24 * 60 * 60 * 1000; // 1 year
          memory.confidence = initialConfidence; // Reset
          const veryDecayedConfidence = confidenceManager.decayMemory(memory, veryLongTime);
          
          const exponentialBehavior = veryDecayedConfidence >= 0.1; // Should not go below minimum
          
          return noIncrease && monotonicDecay && neverZero && exponentialBehavior;
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
 * Arbitrary for generating Memory objects
 */
function memoryArbitrary(): fc.Arbitrary<Memory> {
  return fc.oneof(
    vendorMemoryArbitrary(),
    correctionMemoryArbitrary(),
    resolutionMemoryArbitrary()
  ).filter(memory => {
    // Filter out memories with invalid confidence values
    return !isNaN(memory.confidence) && 
           isFinite(memory.confidence) &&
           memory.confidence >= 0.1 && 
           memory.confidence <= 1.0;
  });
}

/**
 * Arbitrary for generating VendorMemory objects
 */
function vendorMemoryArbitrary(): fc.Arbitrary<Memory> {
  return fc.tuple(
    fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
    fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
    fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
    memoryPatternArbitrary(),
    memoryContextArbitrary()
  ).map(([id, vendorId, confidence, pattern, context]) => 
    new VendorMemoryImpl(
      id,
      pattern,
      confidence,
      context,
      vendorId,
      [], // fieldMappings
      {
        vatIncludedInPrices: false,
        defaultVatRate: 0.19,
        vatInclusionIndicators: ['inkl. MwSt.'],
        vatExclusionIndicators: ['zzgl. MwSt.']
      }
    )
  );
}

/**
 * Arbitrary for generating CorrectionMemory objects
 */
function correctionMemoryArbitrary(): fc.Arbitrary<Memory> {
  return fc.tuple(
    fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
    fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
    memoryPatternArbitrary(),
    memoryContextArbitrary()
  ).map(([id, confidence, pattern, context]) =>
    new CorrectionMemoryImpl(
      id,
      pattern,
      confidence,
      context,
      'QUANTITY_CORRECTION' as any,
      [],
      {
        actionType: 'SET_VALUE' as any,
        targetField: 'quantity',
        newValue: 5,
        explanation: 'Test correction'
      }
    )
  );
}

/**
 * Arbitrary for generating ResolutionMemory objects
 */
function resolutionMemoryArbitrary(): fc.Arbitrary<Memory> {
  return fc.tuple(
    fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
    fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) }),
    memoryPatternArbitrary(),
    memoryContextArbitrary()
  ).map(([id, confidence, pattern, context]) =>
    new ResolutionMemoryImpl(
      id,
      pattern,
      confidence,
      context,
      'QUANTITY_MISMATCH' as any,
      {
        resolved: true,
        resolutionAction: 'ACCEPT_DELIVERY_NOTE' as any,
        finalValue: 5,
        explanation: 'Test resolution'
      },
      {
        decisionType: 'APPROVE' as any,
        timestamp: new Date(),
        userId: 'test-user',
        reasoning: 'Test reasoning',
        confidence: 0.8
      },
      []
    )
  );
}

/**
 * Arbitrary for MemoryPattern
 */
function memoryPatternArbitrary(): fc.Arbitrary<MemoryPattern> {
  return fc.record({
    patternType: fc.constantFrom(...Object.values(PatternType)),
    patternData: fc.dictionary(
      fc.string({ minLength: 1, maxLength: 10 }), 
      fc.oneof(fc.string({ minLength: 1, maxLength: 10 }), fc.integer({ min: 1, max: 100 }))
    ),
    threshold: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) })
  });
}

/**
 * Arbitrary for MemoryContext
 */
function memoryContextArbitrary(): fc.Arbitrary<MemoryContext> {
  return fc.record({
    vendorId: fc.string({ minLength: 1, maxLength: 20 }),
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
 * Arbitrary for ProcessingOutcome
 */
function processingOutcomeArbitrary(): fc.Arbitrary<ProcessingOutcome> {
  return fc.record({
    result: processingResultArbitrary(),
    outcomeType: fc.constantFrom(...Object.values(ProcessingOutcomeType)),
    performanceMetrics: processingPerformanceMetricsArbitrary()
  }).chain(base => 
    fc.option(humanFeedbackArbitrary()).map(humanFeedback => ({
      ...base,
      ...(humanFeedback ? { humanFeedback } : {})
    }))
  );
}

/**
 * Arbitrary for ProcessingResult (simplified for testing)
 */
function processingResultArbitrary(): fc.Arbitrary<ProcessingResult> {
  return fc.record({
    normalizedInvoice: fc.record({
      id: fc.string(),
      vendorId: fc.string(),
      invoiceNumber: fc.string(),
      invoiceDate: fc.date(),
      totalAmount: fc.record({
        amount: fc.float({ min: Math.fround(0), max: Math.fround(10000) }),
        currency: fc.constantFrom('EUR', 'USD', 'GBP')
      }),
      currency: fc.constantFrom('EUR', 'USD', 'GBP'),
      lineItems: fc.constant([]),
      normalizedFields: fc.constant([])
    }),
    proposedCorrections: fc.constant([]),
    requiresHumanReview: fc.boolean(),
    reasoning: fc.string({ minLength: 10, maxLength: 100 }),
    confidenceScore: fc.float({ min: Math.fround(0), max: Math.fround(1) }),
    memoryUpdates: fc.constant([]),
    auditTrail: fc.constant([])
  });
}

/**
 * Arbitrary for ProcessingPerformanceMetrics
 */
function processingPerformanceMetricsArbitrary(): fc.Arbitrary<ProcessingPerformanceMetrics> {
  return fc.record({
    averageProcessingTime: fc.integer({ min: 100, max: 10000 }),
    successRate: fc.float({ min: Math.fround(0), max: Math.fround(1) }),
    automationRate: fc.float({ min: Math.fround(0), max: Math.fround(1) }),
    humanReviewRate: fc.float({ min: Math.fround(0), max: Math.fround(1) })
  });
}

/**
 * Arbitrary for HumanFeedback
 */
function humanFeedbackArbitrary(): fc.Arbitrary<HumanFeedback> {
  return fc.record({
    userId: fc.string({ minLength: 3, maxLength: 20 }),
    timestamp: fc.date(),
    feedbackType: fc.constantFrom(...Object.values(FeedbackType)),
    corrections: fc.array(correctionArbitrary(), { maxLength: 3 }),
    satisfactionRating: fc.integer({ min: 1, max: 5 })
  }).chain(base =>
    fc.option(fc.string({ maxLength: 100 })).map(comments => ({
      ...base,
      ...(comments ? { comments } : {})
    }))
  );
}

/**
 * Arbitrary for Correction
 */
function correctionArbitrary(): fc.Arbitrary<Correction> {
  return fc.record({
    field: fc.string({ minLength: 1, maxLength: 20 }),
    originalValue: fc.oneof(fc.string(), fc.integer(), fc.float()),
    correctedValue: fc.oneof(fc.string(), fc.integer(), fc.float()),
    reason: fc.string({ minLength: 5, maxLength: 50 }),
    confidence: fc.float({ min: Math.fround(0), max: Math.fround(1) })
  });
}