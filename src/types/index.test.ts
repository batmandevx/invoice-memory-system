/**
 * Type Definition Tests
 * 
 * Tests to verify type definitions and interfaces are properly structured
 */

import {
  MemorySystem,
  ProcessingResult,
  Memory,
  MemoryType,
  VendorMemory,
  RawInvoice,
  NormalizedInvoice,
  LineItem,
  Money,
  MemoryPattern,
  PatternType,
  ComplexityLevel,
  QualityLevel,
  HistoricalContext,
  VATBehavior,
  InvoiceMetadata
} from './index';

describe('Type Definitions', () => {
  describe('MemorySystem interface', () => {
    it('should have all required methods', () => {
      const memorySystemMethods = [
        'processInvoice',
        'recallMemories',
        'applyMemories',
        'makeDecision',
        'learnFromOutcome'
      ];

      // This test verifies the interface exists and has the expected shape
      // We can't instantiate an interface, but we can check it compiles
      const mockMemorySystem: Partial<MemorySystem> = {
        processInvoice: jest.fn(),
        recallMemories: jest.fn(),
        applyMemories: jest.fn(),
        makeDecision: jest.fn(),
        learnFromOutcome: jest.fn()
      };

      memorySystemMethods.forEach(method => {
        expect(mockMemorySystem).toHaveProperty(method);
        expect(typeof mockMemorySystem[method as keyof typeof mockMemorySystem]).toBe('function');
      });
    });
  });

  describe('ProcessingResult interface', () => {
    it('should have all required properties', () => {
      const mockProcessingResult: ProcessingResult = {
        normalizedInvoice: {} as NormalizedInvoice,
        proposedCorrections: [],
        requiresHumanReview: false,
        reasoning: 'Test reasoning',
        confidenceScore: 0.85,
        memoryUpdates: [],
        auditTrail: []
      };

      expect(mockProcessingResult).toHaveProperty('normalizedInvoice');
      expect(mockProcessingResult).toHaveProperty('proposedCorrections');
      expect(mockProcessingResult).toHaveProperty('requiresHumanReview');
      expect(mockProcessingResult).toHaveProperty('reasoning');
      expect(mockProcessingResult).toHaveProperty('confidenceScore');
      expect(mockProcessingResult).toHaveProperty('memoryUpdates');
      expect(mockProcessingResult).toHaveProperty('auditTrail');

      expect(typeof mockProcessingResult.requiresHumanReview).toBe('boolean');
      expect(typeof mockProcessingResult.reasoning).toBe('string');
      expect(typeof mockProcessingResult.confidenceScore).toBe('number');
      expect(Array.isArray(mockProcessingResult.proposedCorrections)).toBe(true);
      expect(Array.isArray(mockProcessingResult.memoryUpdates)).toBe(true);
      expect(Array.isArray(mockProcessingResult.auditTrail)).toBe(true);
    });
  });

  describe('Memory types', () => {
    it('should have correct MemoryType enum values', () => {
      expect(MemoryType.VENDOR).toBe('vendor');
      expect(MemoryType.CORRECTION).toBe('correction');
      expect(MemoryType.RESOLUTION).toBe('resolution');
    });

    it('should support base Memory interface', () => {
      const mockHistoricalContext: HistoricalContext = {
        recentResults: [],
        trendingPatterns: [],
        seasonalFactors: []
      };

      const mockMemory: Memory = {
        id: 'test-memory-1',
        type: MemoryType.VENDOR,
        pattern: {
          patternType: PatternType.FIELD_MAPPING,
          patternData: { sourceField: 'test', targetField: 'test' },
          threshold: 0.7
        },
        confidence: 0.8,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 5,
        successRate: 0.9,
        context: {
          invoiceCharacteristics: {
            complexity: ComplexityLevel.SIMPLE,
            language: 'en',
            documentFormat: 'pdf',
            extractionQuality: QualityLevel.GOOD
          },
          historicalContext: mockHistoricalContext,
          environmentalFactors: []
        }
      };

      expect(mockMemory.id).toBe('test-memory-1');
      expect(mockMemory.type).toBe(MemoryType.VENDOR);
      expect(mockMemory.confidence).toBe(0.8);
      expect(mockMemory.usageCount).toBe(5);
      expect(mockMemory.successRate).toBe(0.9);
    });

    it('should support VendorMemory extension', () => {
      const mockHistoricalContext: HistoricalContext = {
        recentResults: [],
        trendingPatterns: [],
        seasonalFactors: []
      };

      const mockVATBehavior: VATBehavior = {
        vatIncludedInPrices: true,
        defaultVatRate: 19,
        vatInclusionIndicators: ['incl. VAT', 'inkl. MwSt.'],
        vatExclusionIndicators: ['excl. VAT', 'zzgl. MwSt.']
      };

      const mockVendorMemory: VendorMemory = {
        id: 'vendor-memory-1',
        type: MemoryType.VENDOR,
        pattern: {
          patternType: PatternType.FIELD_MAPPING,
          patternData: {},
          threshold: 0.7
        },
        confidence: 0.8,
        createdAt: new Date(),
        lastUsed: new Date(),
        usageCount: 5,
        successRate: 0.9,
        context: {
          invoiceCharacteristics: {
            complexity: ComplexityLevel.SIMPLE,
            language: 'en',
            documentFormat: 'pdf',
            extractionQuality: QualityLevel.GOOD
          },
          historicalContext: mockHistoricalContext,
          environmentalFactors: []
        },
        vendorId: 'vendor-123',
        fieldMappings: [],
        vatBehavior: mockVATBehavior,
        currencyPatterns: [],
        dateFormats: []
      };

      expect(mockVendorMemory.vendorId).toBe('vendor-123');
      expect(Array.isArray(mockVendorMemory.fieldMappings)).toBe(true);
      expect(Array.isArray(mockVendorMemory.currencyPatterns)).toBe(true);
      expect(Array.isArray(mockVendorMemory.dateFormats)).toBe(true);
      expect(mockVendorMemory.vatBehavior.vatIncludedInPrices).toBe(true);
    });
  });

  describe('Invoice types', () => {
    it('should support RawInvoice interface', () => {
      const mockMetadata: InvoiceMetadata = {
        sourceSystem: 'test-system',
        receivedAt: new Date(),
        fileFormat: 'pdf',
        fileSize: 1024,
        detectedLanguage: 'en',
        extractionQuality: QualityLevel.GOOD,
        additionalMetadata: {}
      };

      const mockRawInvoice: RawInvoice = {
        id: 'invoice-1',
        vendorId: 'vendor-1',
        invoiceNumber: 'INV-001',
        rawText: 'Invoice content',
        extractedFields: [],
        metadata: mockMetadata
      };

      expect(mockRawInvoice.id).toBe('invoice-1');
      expect(mockRawInvoice.vendorId).toBe('vendor-1');
      expect(mockRawInvoice.invoiceNumber).toBe('INV-001');
      expect(typeof mockRawInvoice.rawText).toBe('string');
      expect(Array.isArray(mockRawInvoice.extractedFields)).toBe(true);
      expect(mockRawInvoice.metadata.sourceSystem).toBe('test-system');
    });

    it('should support NormalizedInvoice interface', () => {
      const mockNormalizedInvoice: NormalizedInvoice = {
        id: 'invoice-1',
        vendorId: 'vendor-1',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date(),
        totalAmount: { amount: 100.00, currency: 'EUR' },
        currency: 'EUR',
        lineItems: [],
        normalizedFields: []
      };

      expect(mockNormalizedInvoice.id).toBe('invoice-1');
      expect(mockNormalizedInvoice.currency).toBe('EUR');
      expect(mockNormalizedInvoice.totalAmount.amount).toBe(100.00);
      expect(mockNormalizedInvoice.totalAmount.currency).toBe('EUR');
      expect(Array.isArray(mockNormalizedInvoice.lineItems)).toBe(true);
      expect(Array.isArray(mockNormalizedInvoice.normalizedFields)).toBe(true);
    });

    it('should support LineItem interface', () => {
      const mockLineItem: LineItem = {
        description: 'Test item',
        quantity: 2,
        unitPrice: { amount: 50.00, currency: 'EUR' },
        totalPrice: { amount: 100.00, currency: 'EUR' }
      };

      expect(mockLineItem.description).toBe('Test item');
      expect(mockLineItem.quantity).toBe(2);
      expect(mockLineItem.unitPrice.amount).toBe(50.00);
      expect(mockLineItem.totalPrice.amount).toBe(100.00);
    });

    it('should support Money interface', () => {
      const mockMoney: Money = {
        amount: 123.45,
        currency: 'USD'
      };

      expect(mockMoney.amount).toBe(123.45);
      expect(mockMoney.currency).toBe('USD');
      expect(typeof mockMoney.amount).toBe('number');
      expect(typeof mockMoney.currency).toBe('string');
    });
  });

  describe('Pattern and Context types', () => {
    it('should have correct PatternType enum values', () => {
      expect(PatternType.REGEX).toBe('regex');
      expect(PatternType.KEYWORD).toBe('keyword');
      expect(PatternType.FIELD_MAPPING).toBe('field_mapping');
      expect(PatternType.STRUCTURAL).toBe('structural');
      expect(PatternType.CONTEXTUAL).toBe('contextual');
    });

    it('should support MemoryPattern interface', () => {
      const mockPattern: MemoryPattern = {
        patternType: PatternType.REGEX,
        patternData: { regex: '\\d{4}-\\d{2}-\\d{2}' },
        threshold: 0.8
      };

      expect(mockPattern.patternType).toBe(PatternType.REGEX);
      expect(mockPattern.threshold).toBe(0.8);
      expect(typeof mockPattern.patternData).toBe('object');
    });

    it('should have correct enum values for complexity and quality', () => {
      expect(ComplexityLevel.SIMPLE).toBe('simple');
      expect(ComplexityLevel.MODERATE).toBe('moderate');
      expect(ComplexityLevel.COMPLEX).toBe('complex');
      expect(ComplexityLevel.VERY_COMPLEX).toBe('very_complex');

      expect(QualityLevel.POOR).toBe('poor');
      expect(QualityLevel.FAIR).toBe('fair');
      expect(QualityLevel.GOOD).toBe('good');
      expect(QualityLevel.EXCELLENT).toBe('excellent');
    });
  });
});