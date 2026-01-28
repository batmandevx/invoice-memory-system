/**
 * Memory Base Classes Tests
 * 
 * Tests for the base memory classes and factory
 */

import {
  BaseMemory,
  VendorMemoryImpl,
  CorrectionMemoryImpl,
  ResolutionMemoryImpl,
  MemoryFactory
} from './memory-base';
import {
  MemoryType,
  PatternType,
  ComplexityLevel,
  QualityLevel,
  CorrectionType,
  DiscrepancyType,
  ResolutionAction,
  HumanDecisionType,
  ContextFactorType,
  ConditionOperator,
  CorrectionActionType,
  MemoryPattern,
  MemoryContext,
  VATBehavior,
  Condition,
  CorrectionAction,
  ResolutionOutcome,
  HumanDecision
} from '../types';

describe('Memory Base Classes', () => {
  const mockPattern: MemoryPattern = {
    patternType: PatternType.FIELD_MAPPING,
    patternData: { sourceField: 'test', targetField: 'test' },
    threshold: 0.7
  };

  const mockContext: MemoryContext = {
    vendorId: 'test-vendor',
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
  };

  describe('VendorMemoryImpl', () => {
    const mockVATBehavior: VATBehavior = {
      vatIncludedInPrices: true,
      defaultVatRate: 19,
      vatInclusionIndicators: ['incl. VAT'],
      vatExclusionIndicators: ['excl. VAT']
    };

    it('should create vendor memory with correct properties', () => {
      const vendorMemory = new VendorMemoryImpl(
        'vendor-1',
        mockPattern,
        0.8,
        mockContext,
        'test-vendor',
        [],
        mockVATBehavior
      );

      expect(vendorMemory.id).toBe('vendor-1');
      expect(vendorMemory.type).toBe(MemoryType.VENDOR);
      expect(vendorMemory.vendorId).toBe('test-vendor');
      expect(vendorMemory.confidence).toBe(0.8);
      expect(vendorMemory.vatBehavior.vatIncludedInPrices).toBe(true);
      expect(vendorMemory.fieldMappings).toEqual([]);
      expect(vendorMemory.currencyPatterns).toEqual([]);
      expect(vendorMemory.dateFormats).toEqual([]);
    });

    it('should be applicable for matching vendor', () => {
      const vendorMemory = new VendorMemoryImpl(
        'vendor-1',
        mockPattern,
        0.8,
        mockContext,
        'test-vendor',
        [],
        mockVATBehavior
      );

      expect(vendorMemory.isApplicable(mockContext)).toBe(true);

      const differentContext = {
        ...mockContext,
        vendorId: 'different-vendor'
      };
      expect(vendorMemory.isApplicable(differentContext)).toBe(false);
    });

    it('should calculate relevance correctly', () => {
      const vendorMemory = new VendorMemoryImpl(
        'vendor-1',
        mockPattern,
        0.8,
        mockContext,
        'test-vendor',
        [],
        mockVATBehavior
      );

      // Set success rate for testing
      vendorMemory.successRate = 0.9;

      const relevance = vendorMemory.calculateRelevance(mockContext);
      expect(relevance).toBeGreaterThan(0);
      expect(relevance).toBeLessThanOrEqual(1);
    });

    it('should add field mappings correctly', () => {
      const vendorMemory = new VendorMemoryImpl(
        'vendor-1',
        mockPattern,
        0.8,
        mockContext,
        'test-vendor',
        [],
        mockVATBehavior
      );

      const mapping = {
        sourceField: 'Leistungsdatum',
        targetField: 'serviceDate',
        confidence: 0.9,
        examples: []
      };

      vendorMemory.addFieldMapping(mapping);
      expect(vendorMemory.fieldMappings).toHaveLength(1);
      expect(vendorMemory.fieldMappings[0]).toEqual(mapping);

      // Adding same mapping with lower confidence should not replace
      const lowerConfidenceMapping = {
        ...mapping,
        confidence: 0.7
      };
      vendorMemory.addFieldMapping(lowerConfidenceMapping);
      expect(vendorMemory.fieldMappings).toHaveLength(1);
      expect(vendorMemory.fieldMappings[0]!.confidence).toBe(0.9);

      // Adding same mapping with higher confidence should replace
      const higherConfidenceMapping = {
        ...mapping,
        confidence: 0.95
      };
      vendorMemory.addFieldMapping(higherConfidenceMapping);
      expect(vendorMemory.fieldMappings).toHaveLength(1);
      expect(vendorMemory.fieldMappings[0]!.confidence).toBe(0.95);
    });

    it('should provide meaningful description', () => {
      const vendorMemory = new VendorMemoryImpl(
        'vendor-1',
        mockPattern,
        0.8,
        mockContext,
        'test-vendor',
        [],
        mockVATBehavior
      );

      const description = vendorMemory.getDescription();
      expect(description).toContain('test-vendor');
      expect(description).toContain('0 field mappings');
      expect(description).toContain('0 currency patterns');
    });
  });

  describe('CorrectionMemoryImpl', () => {
    const mockCondition: Condition = {
      field: 'quantity',
      operator: ConditionOperator.GREATER_THAN,
      value: 0
    };

    const mockCorrectionAction: CorrectionAction = {
      actionType: CorrectionActionType.MULTIPLY_BY,
      targetField: 'quantity',
      newValue: 2,
      explanation: 'Double the quantity based on delivery note'
    };

    it('should create correction memory with correct properties', () => {
      const correctionMemory = new CorrectionMemoryImpl(
        'correction-1',
        mockPattern,
        0.7,
        mockContext,
        CorrectionType.QUANTITY_CORRECTION,
        [mockCondition],
        mockCorrectionAction
      );

      expect(correctionMemory.id).toBe('correction-1');
      expect(correctionMemory.type).toBe(MemoryType.CORRECTION);
      expect(correctionMemory.correctionType).toBe(CorrectionType.QUANTITY_CORRECTION);
      expect(correctionMemory.triggerConditions).toHaveLength(1);
      expect(correctionMemory.correctionAction).toEqual(mockCorrectionAction);
    });

    it('should be applicable when trigger conditions exist', () => {
      const correctionMemory = new CorrectionMemoryImpl(
        'correction-1',
        mockPattern,
        0.7,
        mockContext,
        CorrectionType.QUANTITY_CORRECTION,
        [mockCondition],
        mockCorrectionAction
      );

      expect(correctionMemory.isApplicable(mockContext)).toBe(true);

      // Memory with no conditions should not be applicable
      const emptyMemory = new CorrectionMemoryImpl(
        'correction-2',
        mockPattern,
        0.7,
        mockContext,
        CorrectionType.QUANTITY_CORRECTION,
        [],
        mockCorrectionAction
      );

      expect(emptyMemory.isApplicable(mockContext)).toBe(false);
    });

    it('should calculate relevance based on success rate and context', () => {
      const correctionMemory = new CorrectionMemoryImpl(
        'correction-1',
        mockPattern,
        0.8,
        mockContext,
        CorrectionType.QUANTITY_CORRECTION,
        [mockCondition],
        mockCorrectionAction
      );

      correctionMemory.successRate = 0.9;
      const relevance = correctionMemory.calculateRelevance(mockContext);
      
      expect(relevance).toBeGreaterThan(0);
      expect(relevance).toBeLessThanOrEqual(1);
    });
  });

  describe('ResolutionMemoryImpl', () => {
    const mockResolutionOutcome: ResolutionOutcome = {
      resolved: true,
      resolutionAction: ResolutionAction.APPROVE_AS_IS,
      finalValue: 'approved',
      explanation: 'Invoice approved after review'
    };

    const mockHumanDecision: HumanDecision = {
      decisionType: HumanDecisionType.APPROVE,
      timestamp: new Date(),
      userId: 'user-123',
      reasoning: 'Invoice looks correct',
      confidence: 0.9
    };

    it('should create resolution memory with correct properties', () => {
      const resolutionMemory = new ResolutionMemoryImpl(
        'resolution-1',
        mockPattern,
        0.8,
        mockContext,
        DiscrepancyType.QUANTITY_MISMATCH,
        mockResolutionOutcome,
        mockHumanDecision
      );

      expect(resolutionMemory.id).toBe('resolution-1');
      expect(resolutionMemory.type).toBe(MemoryType.RESOLUTION);
      expect(resolutionMemory.discrepancyType).toBe(DiscrepancyType.QUANTITY_MISMATCH);
      expect(resolutionMemory.resolutionOutcome).toEqual(mockResolutionOutcome);
      expect(resolutionMemory.humanDecision).toEqual(mockHumanDecision);
    });

    it('should calculate relevance based on confidence and human decision', () => {
      const resolutionMemory = new ResolutionMemoryImpl(
        'resolution-1',
        mockPattern,
        0.8,
        mockContext,
        DiscrepancyType.QUANTITY_MISMATCH,
        mockResolutionOutcome,
        mockHumanDecision
      );

      const relevance = resolutionMemory.calculateRelevance(mockContext);
      expect(relevance).toBeGreaterThan(0);
      expect(relevance).toBeLessThanOrEqual(1);
    });

    it('should add context factors correctly', () => {
      const resolutionMemory = new ResolutionMemoryImpl(
        'resolution-1',
        mockPattern,
        0.8,
        mockContext,
        DiscrepancyType.QUANTITY_MISMATCH,
        mockResolutionOutcome,
        mockHumanDecision
      );

      const contextFactor = {
        factorType: ContextFactorType.VENDOR_HISTORY,
        value: 'reliable vendor',
        weight: 0.8
      };

      resolutionMemory.addContextFactor(contextFactor);
      expect(resolutionMemory.contextFactors).toHaveLength(1);
      expect(resolutionMemory.contextFactors[0]).toEqual(contextFactor);
    });
  });

  describe('BaseMemory functionality', () => {
    class TestMemory extends BaseMemory {
      isApplicable(): boolean { return true; }
      calculateRelevance(): number { return 0.5; }
      getDescription(): string { return 'Test memory'; }
    }

    it('should enforce confidence bounds', () => {
      const memory = new TestMemory('test', MemoryType.VENDOR, mockPattern, 1.5, mockContext);
      expect(memory.confidence).toBe(1); // Should be clamped to 1

      const memory2 = new TestMemory('test2', MemoryType.VENDOR, mockPattern, -0.5, mockContext);
      expect(memory2.confidence).toBe(0); // Should be clamped to 0
    });

    it('should update usage statistics correctly', () => {
      const memory = new TestMemory('test', MemoryType.VENDOR, mockPattern, 0.8, mockContext);
      
      expect(memory.usageCount).toBe(0);
      expect(memory.successRate).toBe(0);

      memory.updateUsage(true);
      expect(memory.usageCount).toBe(1);
      expect(memory.successRate).toBeGreaterThan(0);

      const oldLastUsed = memory.lastUsed;
      setTimeout(() => {
        memory.updateUsage(false);
        expect(memory.usageCount).toBe(2);
        expect(memory.lastUsed.getTime()).toBeGreaterThan(oldLastUsed.getTime());
      }, 1);
    });

    it('should update confidence within bounds', () => {
      const memory = new TestMemory('test', MemoryType.VENDOR, mockPattern, 0.8, mockContext);
      
      memory.updateConfidence(1.5);
      expect(memory.confidence).toBe(1);

      memory.updateConfidence(-0.5);
      expect(memory.confidence).toBe(0);

      memory.updateConfidence(0.6);
      expect(memory.confidence).toBe(0.6);
    });
  });

  describe('MemoryFactory', () => {
    const mockVATBehavior: VATBehavior = {
      vatIncludedInPrices: true,
      vatInclusionIndicators: [],
      vatExclusionIndicators: []
    };

    it('should create VendorMemory instances', () => {
      const memory = MemoryFactory.createVendorMemory(
        'vendor-1',
        mockPattern,
        0.8,
        mockContext,
        'test-vendor',
        mockVATBehavior
      );

      expect(memory).toBeInstanceOf(VendorMemoryImpl);
      expect(memory.vendorId).toBe('test-vendor');
      expect(memory.type).toBe(MemoryType.VENDOR);
    });

    it('should create CorrectionMemory instances', () => {
      const condition: Condition = {
        field: 'test',
        operator: ConditionOperator.EQUALS,
        value: 'test'
      };

      const action: CorrectionAction = {
        actionType: CorrectionActionType.SET_VALUE,
        targetField: 'test',
        newValue: 'corrected'
      };

      const memory = MemoryFactory.createCorrectionMemory(
        'correction-1',
        mockPattern,
        0.7,
        mockContext,
        CorrectionType.FIELD_MAPPING_CORRECTION,
        [condition],
        action
      );

      expect(memory).toBeInstanceOf(CorrectionMemoryImpl);
      expect(memory.correctionType).toBe(CorrectionType.FIELD_MAPPING_CORRECTION);
      expect(memory.type).toBe(MemoryType.CORRECTION);
    });

    it('should create ResolutionMemory instances', () => {
      const outcome: ResolutionOutcome = {
        resolved: true,
        resolutionAction: ResolutionAction.APPROVE_AS_IS,
        finalValue: 'approved',
        explanation: 'Test resolution'
      };

      const decision: HumanDecision = {
        decisionType: HumanDecisionType.APPROVE,
        timestamp: new Date(),
        userId: 'user-1',
        reasoning: 'Test decision',
        confidence: 0.9
      };

      const memory = MemoryFactory.createResolutionMemory(
        'resolution-1',
        mockPattern,
        0.8,
        mockContext,
        DiscrepancyType.PRICE_DISCREPANCY,
        outcome,
        decision
      );

      expect(memory).toBeInstanceOf(ResolutionMemoryImpl);
      expect(memory.discrepancyType).toBe(DiscrepancyType.PRICE_DISCREPANCY);
      expect(memory.type).toBe(MemoryType.RESOLUTION);
    });
  });
});