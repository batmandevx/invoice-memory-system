/**
 * Unit Tests for Confidence Manager
 * 
 * Tests the confidence calculation algorithms, reinforcement/decay mechanisms,
 * and escalation threshold management.
 */

import { 
  ConfidenceManagerImpl, 
  createConfidenceManager,
  ConfidenceConfig,
  ReliabilityClassification,
  ReliabilityFactorType,
  PerformanceMetrics,
  MemoryPerformanceMetrics
} from './confidence-manager';
import { 
  Memory, 
  MemoryPattern, 
  MemoryContext,
  ProcessingOutcome,
  ProcessingOutcomeType,
  PatternType,
  ComplexityLevel,
  QualityLevel,
  InvoiceCharacteristics,
  FeedbackType
} from '../types';
import { VendorMemoryImpl, CorrectionMemoryImpl } from './memory-base';
import { DatabaseConnection } from '../database/connection';

// Mock database connection
const mockDb = {
  queryOne: jest.fn(),
  execute: jest.fn(),
  query: jest.fn(),
  close: jest.fn(),
  withTransaction: jest.fn()
} as unknown as DatabaseConnection;

describe('ConfidenceManager', () => {
  let confidenceManager: ConfidenceManagerImpl;
  let mockMemory: VendorMemoryImpl;
  let mockContext: MemoryContext;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Reset mock database responses
    (mockDb.queryOne as jest.Mock).mockResolvedValue({ value: '0.7' });
    (mockDb.execute as jest.Mock).mockResolvedValue(undefined);
    
    confidenceManager = new ConfidenceManagerImpl(mockDb);
    
    // Create mock memory
    const pattern: MemoryPattern = {
      patternType: PatternType.FIELD_MAPPING,
      patternData: { sourceField: 'Leistungsdatum', targetField: 'serviceDate' },
      threshold: 0.7
    };

    const invoiceCharacteristics: InvoiceCharacteristics = {
      complexity: ComplexityLevel.MODERATE,
      language: 'de',
      documentFormat: 'PDF',
      extractionQuality: QualityLevel.GOOD
    };

    mockContext = {
      vendorId: 'supplier-gmbh',
      invoiceCharacteristics,
      historicalContext: {
        recentResults: [],
        trendingPatterns: [],
        seasonalFactors: []
      },
      environmentalFactors: []
    };

    mockMemory = new VendorMemoryImpl(
      'test-memory-1',
      pattern,
      0.6,
      mockContext,
      'supplier-gmbh',
      [],
      {
        vatIncludedInPrices: false,
        defaultVatRate: 0.19,
        vatInclusionIndicators: ['inkl. MwSt.'],
        vatExclusionIndicators: ['zzgl. MwSt.']
      }
    );

    // Set some usage statistics
    mockMemory.usageCount = 10;
    mockMemory.successRate = 0.8;
    mockMemory.lastUsed = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
  });

  describe('calculateInitialConfidence', () => {
    it('should calculate appropriate initial confidence for vendor memory', () => {
      const vendorMemory = new VendorMemoryImpl(
        'vendor-memory',
        mockMemory.pattern,
        0.5,
        mockContext,
        'test-vendor',
        [],
        mockMemory.vatBehavior
      );

      const confidence = confidenceManager.calculateInitialConfidence(vendorMemory);
      
      expect(confidence).toBeGreaterThan(0.5); // Should be higher than base for vendor memories
      expect(confidence).toBeLessThanOrEqual(1.0);
      expect(confidence).toBeGreaterThanOrEqual(0.1);
    });

    it('should calculate lower initial confidence for correction memory', () => {
      const correctionMemory = new CorrectionMemoryImpl(
        'correction-memory',
        mockMemory.pattern,
        0.5,
        mockContext,
        'QUANTITY_CORRECTION' as any,
        [],
        {
          actionType: 'SET_VALUE' as any,
          targetField: 'quantity',
          newValue: 5
        }
      );

      const confidence = confidenceManager.calculateInitialConfidence(correctionMemory);
      
      expect(confidence).toBeLessThan(0.6); // Should be lower for correction memories
      expect(confidence).toBeGreaterThanOrEqual(0.1);
    });

    it('should adjust confidence based on extraction quality', () => {
      const highQualityContext = {
        ...mockContext,
        invoiceCharacteristics: {
          ...mockContext.invoiceCharacteristics,
          extractionQuality: QualityLevel.EXCELLENT
        }
      };

      const lowQualityContext = {
        ...mockContext,
        invoiceCharacteristics: {
          ...mockContext.invoiceCharacteristics,
          extractionQuality: QualityLevel.POOR
        }
      };

      const highQualityMemory = new VendorMemoryImpl(
        'high-quality',
        mockMemory.pattern,
        0.5,
        highQualityContext,
        'test-vendor',
        [],
        mockMemory.vatBehavior
      );

      const lowQualityMemory = new VendorMemoryImpl(
        'low-quality',
        mockMemory.pattern,
        0.5,
        lowQualityContext,
        'test-vendor',
        [],
        mockMemory.vatBehavior
      );

      const highConfidence = confidenceManager.calculateInitialConfidence(highQualityMemory);
      const lowConfidence = confidenceManager.calculateInitialConfidence(lowQualityMemory);

      expect(highConfidence).toBeGreaterThan(lowConfidence);
    });

    it('should record audit steps for confidence calculations', () => {
      confidenceManager.clearAuditSteps();
      
      confidenceManager.calculateInitialConfidence(mockMemory);
      
      const auditSteps = confidenceManager.getAuditSteps();
      expect(auditSteps).toHaveLength(1);
      expect(auditSteps[0]?.operation).toBe('confidence_calculation');
      expect(auditSteps[0]?.description).toBe('Initial confidence calculation');
    });
  });

  describe('reinforceMemory', () => {
    it('should increase confidence for successful outcomes', () => {
      const outcome: ProcessingOutcome = {
        result: {} as any,
        outcomeType: ProcessingOutcomeType.SUCCESS_AUTO,
        performanceMetrics: {} as any
      };

      const originalConfidence = mockMemory.confidence;
      const newConfidence = confidenceManager.reinforceMemory(mockMemory, outcome);

      expect(newConfidence).toBeGreaterThan(originalConfidence);
      expect(newConfidence).toBeLessThanOrEqual(1.0);
    });

    it('should decrease confidence for failed outcomes', () => {
      const outcome: ProcessingOutcome = {
        result: {} as any,
        outcomeType: ProcessingOutcomeType.FAILED_VALIDATION,
        performanceMetrics: {} as any
      };

      const originalConfidence = mockMemory.confidence;
      const newConfidence = confidenceManager.reinforceMemory(mockMemory, outcome);

      expect(newConfidence).toBeLessThan(originalConfidence);
      expect(newConfidence).toBeGreaterThanOrEqual(0.1);
    });

    it('should apply human feedback to reinforcement', () => {
      const positiveOutcome: ProcessingOutcome = {
        result: {} as any,
        outcomeType: ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW,
        performanceMetrics: {} as any,
        humanFeedback: {
          userId: 'user1',
          timestamp: new Date(),
          feedbackType: FeedbackType.APPROVAL,
          corrections: [],
          satisfactionRating: 5
        }
      };

      const negativeOutcome: ProcessingOutcome = {
        result: {} as any,
        outcomeType: ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW,
        performanceMetrics: {} as any,
        humanFeedback: {
          userId: 'user1',
          timestamp: new Date(),
          feedbackType: FeedbackType.CORRECTION,
          corrections: [],
          satisfactionRating: 2
        }
      };

      const originalConfidence = mockMemory.confidence;
      const positiveReinforcement = confidenceManager.reinforceMemory(mockMemory, positiveOutcome);
      
      // Reset confidence
      mockMemory.confidence = originalConfidence;
      const negativeReinforcement = confidenceManager.reinforceMemory(mockMemory, negativeOutcome);

      expect(positiveReinforcement).toBeGreaterThan(negativeReinforcement);
    });

    it('should record audit steps for reinforcement', () => {
      confidenceManager.clearAuditSteps();
      
      const outcome: ProcessingOutcome = {
        result: {} as any,
        outcomeType: ProcessingOutcomeType.SUCCESS_AUTO,
        performanceMetrics: {} as any
      };

      confidenceManager.reinforceMemory(mockMemory, outcome);
      
      const auditSteps = confidenceManager.getAuditSteps();
      expect(auditSteps).toHaveLength(1);
      expect(auditSteps[0]?.operation).toBe('confidence_calculation');
      expect(auditSteps[0]?.description).toBe('Memory confidence reinforcement');
    });
  });

  describe('decayMemory', () => {
    it('should decrease confidence based on time since last use', () => {
      const originalConfidence = mockMemory.confidence;
      const timeSinceLastUse = 7 * 24 * 60 * 60 * 1000; // 7 days in milliseconds
      
      const newConfidence = confidenceManager.decayMemory(mockMemory, timeSinceLastUse);

      expect(newConfidence).toBeLessThan(originalConfidence);
      expect(newConfidence).toBeGreaterThanOrEqual(0.1);
    });

    it('should apply exponential decay', () => {
      const originalConfidence = mockMemory.confidence;
      const shortTime = 1 * 24 * 60 * 60 * 1000; // 1 day
      const longTime = 30 * 24 * 60 * 60 * 1000; // 30 days

      const shortDecay = confidenceManager.decayMemory(mockMemory, shortTime);
      
      // Reset confidence
      mockMemory.confidence = originalConfidence;
      const longDecay = confidenceManager.decayMemory(mockMemory, longTime);

      expect(shortDecay).toBeGreaterThan(longDecay);
      expect(longDecay).toBeGreaterThan(0); // Should not decay to zero
    });

    it('should not decay below minimum confidence', () => {
      // Set very low initial confidence
      mockMemory.confidence = 0.15;
      const longTime = 365 * 24 * 60 * 60 * 1000; // 1 year
      
      const newConfidence = confidenceManager.decayMemory(mockMemory, longTime);

      expect(newConfidence).toBeGreaterThanOrEqual(0.1); // Minimum confidence
    });

    it('should record audit steps for decay', () => {
      confidenceManager.clearAuditSteps();
      
      const timeSinceLastUse = 7 * 24 * 60 * 60 * 1000;
      confidenceManager.decayMemory(mockMemory, timeSinceLastUse);
      
      const auditSteps = confidenceManager.getAuditSteps();
      expect(auditSteps).toHaveLength(1);
      expect(auditSteps[0]?.operation).toBe('confidence_calculation');
      expect(auditSteps[0]?.description).toBe('Memory confidence decay');
    });
  });

  describe('evaluateMemoryReliability', () => {
    it('should evaluate memory reliability based on multiple factors', () => {
      const reliability = confidenceManager.evaluateMemoryReliability(mockMemory);

      expect(reliability.score).toBeGreaterThanOrEqual(0);
      expect(reliability.score).toBeLessThanOrEqual(1);
      expect(reliability.classification).toBeDefined();
      expect(reliability.factors).toHaveLength(3); // Success rate, usage frequency, recency
      expect(reliability.recommendations).toBeDefined();
    });

    it('should classify high-performing memories as highly reliable', () => {
      // Set up high-performing memory
      mockMemory.successRate = 0.95;
      mockMemory.usageCount = 50;
      mockMemory.lastUsed = new Date(); // Recently used

      const reliability = confidenceManager.evaluateMemoryReliability(mockMemory);

      expect(reliability.classification).toBe(ReliabilityClassification.VERY_HIGH);
      expect(reliability.score).toBeGreaterThan(0.7);
    });

    it('should classify poor-performing memories as low reliability', () => {
      // Set up poor-performing memory
      mockMemory.successRate = 0.3;
      mockMemory.usageCount = 2;
      mockMemory.lastUsed = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

      const reliability = confidenceManager.evaluateMemoryReliability(mockMemory);

      expect(reliability.classification).toBe(ReliabilityClassification.LOW);
      expect(reliability.score).toBeLessThan(0.5);
    });

    it('should include appropriate reliability factors', () => {
      const reliability = confidenceManager.evaluateMemoryReliability(mockMemory);

      const factorTypes = reliability.factors.map(f => f.factorType);
      expect(factorTypes).toContain(ReliabilityFactorType.SUCCESS_RATE);
      expect(factorTypes).toContain(ReliabilityFactorType.USAGE_FREQUENCY);
      expect(factorTypes).toContain(ReliabilityFactorType.RECENCY);
    });

    it('should provide relevant recommendations', () => {
      // Set up memory that needs improvement
      mockMemory.successRate = 0.5;
      mockMemory.usageCount = 3;

      const reliability = confidenceManager.evaluateMemoryReliability(mockMemory);

      expect(reliability.recommendations.length).toBeGreaterThan(0);
      expect(reliability.recommendations.some(r => r.includes('validation'))).toBe(true);
    });
  });

  describe('adjustEscalationThreshold', () => {
    let performanceMetrics: PerformanceMetrics;

    beforeEach(() => {
      const memoryMetrics: MemoryPerformanceMetrics = {
        averageConfidence: 0.7,
        utilizationRate: 0.8,
        accuracyRate: 0.85,
        falsePositiveRate: 0.1,
        falseNegativeRate: 0.05
      };

      performanceMetrics = {
        averageProcessingTime: 1000,
        successRate: 0.85,
        automationRate: 0.7,
        humanReviewRate: 0.3,
        memoryMetrics,
        thresholdHistory: [],
        confidenceTrends: []
      };
    });

    it('should lower threshold when automation rate is low', async () => {
      performanceMetrics.automationRate = 0.5; // Low automation rate
      
      const newThreshold = await confidenceManager.adjustEscalationThreshold(performanceMetrics);
      
      expect(newThreshold).toBeLessThan(0.7); // Should be lower than default
    });

    it('should raise threshold when accuracy is low despite high automation', async () => {
      performanceMetrics.automationRate = 0.95; // Very high automation
      performanceMetrics.successRate = 0.6; // But low success rate
      
      const newThreshold = await confidenceManager.adjustEscalationThreshold(performanceMetrics);
      
      expect(newThreshold).toBeGreaterThan(0.7); // Should be higher than default
    });

    it('should lower threshold when human review rate is too high', async () => {
      performanceMetrics.humanReviewRate = 0.6; // High human review rate
      
      const newThreshold = await confidenceManager.adjustEscalationThreshold(performanceMetrics);
      
      expect(newThreshold).toBeLessThan(0.7);
    });

    it('should raise threshold when memory accuracy is low', async () => {
      performanceMetrics.memoryMetrics.accuracyRate = 0.6; // Low accuracy
      
      const newThreshold = await confidenceManager.adjustEscalationThreshold(performanceMetrics);
      
      expect(newThreshold).toBeGreaterThan(0.7);
    });

    it('should not change threshold for minor adjustments', async () => {
      // Performance metrics that would result in very small changes
      performanceMetrics.automationRate = 0.69; // Slightly below target but not significant
      
      const newThreshold = await confidenceManager.adjustEscalationThreshold(performanceMetrics);
      
      expect(newThreshold).toBe(0.7); // Should remain unchanged
    });
  });

  describe('getEscalationThreshold', () => {
    it('should retrieve threshold from database', async () => {
      (mockDb.queryOne as jest.Mock).mockResolvedValue({ value: '0.8' });
      
      const threshold = await confidenceManager.getEscalationThreshold();
      
      expect(threshold).toBe(0.8);
      expect(mockDb.queryOne).toHaveBeenCalledWith(
        'SELECT value FROM system_config WHERE key = ?',
        ['escalation_threshold']
      );
    });

    it('should return default threshold when not found in database', async () => {
      (mockDb.queryOne as jest.Mock).mockResolvedValue(null);
      
      const threshold = await confidenceManager.getEscalationThreshold();
      
      expect(threshold).toBe(0.7); // Default value
    });
  });

  describe('shouldAutoApply', () => {
    it('should return true when confidence is above threshold', async () => {
      (mockDb.queryOne as jest.Mock).mockResolvedValue({ value: '0.7' });
      
      const shouldApply = await confidenceManager.shouldAutoApply(0.8);
      
      expect(shouldApply).toBe(true);
    });

    it('should return false when confidence is below threshold', async () => {
      (mockDb.queryOne as jest.Mock).mockResolvedValue({ value: '0.7' });
      
      const shouldApply = await confidenceManager.shouldAutoApply(0.6);
      
      expect(shouldApply).toBe(false);
    });

    it('should return true when confidence equals threshold', async () => {
      (mockDb.queryOne as jest.Mock).mockResolvedValue({ value: '0.7' });
      
      const shouldApply = await confidenceManager.shouldAutoApply(0.7);
      
      expect(shouldApply).toBe(true);
    });
  });

  describe('calculateOverallConfidence', () => {
    let memories: Memory[];

    beforeEach(() => {
      // Create multiple memories with different characteristics
      const memory1 = new VendorMemoryImpl(
        'memory-1',
        mockMemory.pattern,
        0.8,
        mockContext,
        'supplier-gmbh',
        [],
        mockMemory.vatBehavior
      );
      memory1.usageCount = 20;
      memory1.successRate = 0.9;

      const memory2 = new VendorMemoryImpl(
        'memory-2',
        mockMemory.pattern,
        0.6,
        mockContext,
        'supplier-gmbh',
        [],
        mockMemory.vatBehavior
      );
      memory2.usageCount = 5;
      memory2.successRate = 0.7;

      memories = [memory1, memory2];
    });

    it('should calculate weighted average confidence', () => {
      const calculation = confidenceManager.calculateOverallConfidence(memories, mockContext);

      expect(calculation.baseConfidence).toBeGreaterThan(0);
      expect(calculation.baseConfidence).toBeLessThanOrEqual(1);
      expect(calculation.finalConfidence).toBeGreaterThan(0);
      expect(calculation.finalConfidence).toBeLessThanOrEqual(1);
    });

    it('should return zero confidence for empty memory array', () => {
      const calculation = confidenceManager.calculateOverallConfidence([], mockContext);

      expect(calculation.baseConfidence).toBe(0);
      expect(calculation.finalConfidence).toBe(0);
      expect(calculation.reasoning).toContain('No memories available');
    });

    it('should apply reinforcement factor based on success rates', () => {
      // Set high success rates
      memories.forEach(memory => {
        memory.successRate = 0.95;
      });

      const calculation = confidenceManager.calculateOverallConfidence(memories, mockContext);

      expect(calculation.reinforcementFactor).toBeGreaterThan(0);
    });

    it('should apply decay factor for old memories', () => {
      // Set old last used dates
      const oldDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 days ago
      memories.forEach(memory => {
        memory.lastUsed = oldDate;
      });

      const calculation = confidenceManager.calculateOverallConfidence(memories, mockContext);

      expect(calculation.decayFactor).toBeLessThan(0);
    });

    it('should provide detailed reasoning', () => {
      const calculation = confidenceManager.calculateOverallConfidence(memories, mockContext);

      expect(calculation.reasoning).toContain('Base confidence');
      expect(calculation.reasoning).toContain(memories.length.toString());
      expect(typeof calculation.reasoning).toBe('string');
      expect(calculation.reasoning.length).toBeGreaterThan(0);
    });

    it('should apply contextual adjustments', () => {
      // Create memories with matching vendor context
      const calculation = confidenceManager.calculateOverallConfidence(memories, mockContext);

      // Should have some contextual adjustment due to vendor matching
      expect(calculation.contextualAdjustment).toBeGreaterThanOrEqual(0);
    });
  });

  describe('createConfidenceManager', () => {
    it('should create a confidence manager instance', () => {
      const manager = createConfidenceManager(mockDb);
      
      expect(manager).toBeInstanceOf(ConfidenceManagerImpl);
    });

    it('should accept custom configuration', () => {
      const customConfig: Partial<ConfidenceConfig> = {
        baseConfidence: 0.3,
        maxReinforcement: 0.2,
        decayRatePerDay: 0.02
      };

      const manager = createConfidenceManager(mockDb, customConfig);
      
      expect(manager).toBeInstanceOf(ConfidenceManagerImpl);
      // Configuration is applied internally, so we test behavior
      const testMemory = new VendorMemoryImpl(
        'test',
        mockMemory.pattern,
        0.5,
        mockContext,
        'test-vendor',
        [],
        mockMemory.vatBehavior
      );
      
      // The custom base confidence should affect initial calculation
      const confidence = (manager as ConfidenceManagerImpl).calculateInitialConfidence(testMemory);
      expect(confidence).toBeDefined();
    });
  });

  describe('edge cases and error handling', () => {
    it('should handle memories with zero usage count', () => {
      mockMemory.usageCount = 0;
      mockMemory.successRate = 0;

      const reliability = confidenceManager.evaluateMemoryReliability(mockMemory);
      
      expect(reliability.score).toBeGreaterThanOrEqual(0);
      expect(reliability.score).toBeLessThanOrEqual(1);
    });

    it('should handle very old memories gracefully', () => {
      const veryOldTime = 1000 * 24 * 60 * 60 * 1000; // 1000 days
      
      const newConfidence = confidenceManager.decayMemory(mockMemory, veryOldTime);
      
      expect(newConfidence).toBeGreaterThanOrEqual(0.1); // Should not go below minimum
      expect(newConfidence).toBeLessThanOrEqual(1.0);
    });

    it('should handle extreme confidence values', () => {
      // Test with confidence at boundaries
      mockMemory.confidence = 1.0;
      
      const outcome: ProcessingOutcome = {
        result: {} as any,
        outcomeType: ProcessingOutcomeType.SUCCESS_AUTO,
        performanceMetrics: {} as any
      };

      const newConfidence = confidenceManager.reinforceMemory(mockMemory, outcome);
      
      expect(newConfidence).toBeLessThanOrEqual(1.0); // Should not exceed maximum
    });

    it('should handle database errors gracefully', async () => {
      (mockDb.queryOne as jest.Mock).mockRejectedValue(new Error('Database error'));
      
      // Should not throw, should use default value
      await expect(confidenceManager.getEscalationThreshold()).resolves.toBe(0.7);
    });
  });
});