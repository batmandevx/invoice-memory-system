/**
 * Unit tests for Vendor Pattern Recognition System
 * 
 * Tests vendor memory isolation, vendor-specific field mapping learning,
 * and VAT behavior pattern recognition as specified in task 9.1.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.5
 */

import {
  VendorPatternRecognitionEngineImpl,
  VendorPatternConfig,
  VendorLearningContext,
  VendorCorrection
} from './vendor-pattern-recognition';
import { MemoryRepository } from '../database/memory-repository';
import { MemoryFactory } from './memory-base';
import {
  Memory,
  MemoryType,
  VendorMemory,
  RawInvoice,
  ExtractedField,
  VATBehavior,
  MemoryPattern,
  PatternType,
  MemoryContext,
  ComplexityLevel,
  QualityLevel,
  TransformationType,
  MappingExample
} from '../types';

// Mock repository for testing
class MockMemoryRepository implements MemoryRepository {
  private memories: Memory[] = [];

  async saveMemory(memory: Memory): Promise<void> {
    const existingIndex = this.memories.findIndex(m => m.id === memory.id);
    if (existingIndex >= 0) {
      this.memories[existingIndex] = memory;
    } else {
      this.memories.push(memory);
    }
  }

  async findMemoryById(id: string): Promise<Memory | null> {
    return this.memories.find(m => m.id === id) || null;
  }

  async findMemoriesByVendor(vendorId: string): Promise<Memory[]> {
    return this.memories.filter(m => 
      m.context.vendorId === vendorId || 
      (m.type === MemoryType.VENDOR && (m as VendorMemory).vendorId === vendorId)
    );
  }

  async findMemoriesByPattern(pattern: MemoryPattern): Promise<Memory[]> {
    return this.memories.filter(m => 
      m.pattern.patternType === pattern.patternType
    );
  }

  async findMemoriesByType(type: MemoryType): Promise<Memory[]> {
    return this.memories.filter(m => m.type === type);
  }

  async updateConfidence(memoryId: string, confidence: number): Promise<void> {
    const memory = this.memories.find(m => m.id === memoryId);
    if (memory) {
      (memory as any).updateConfidence(confidence);
    }
  }

  async archiveMemory(memoryId: string): Promise<void> {
    this.memories = this.memories.filter(m => m.id !== memoryId);
  }

  async deleteMemory(memoryId: string): Promise<void> {
    this.memories = this.memories.filter(m => m.id !== memoryId);
  }

  async getAllMemories(): Promise<Memory[]> {
    return [...this.memories];
  }

  async getMemoryCount(): Promise<number> {
    return this.memories.length;
  }

  // Helper methods for testing
  addMemory(memory: Memory): void {
    this.memories.push(memory);
  }

  getMemories(): Memory[] {
    return [...this.memories];
  }

  clear(): void {
    this.memories = [];
  }
}

describe('VendorPatternRecognitionEngine', () => {
  let engine: VendorPatternRecognitionEngineImpl;
  let mockRepository: MockMemoryRepository;
  let defaultConfig: VendorPatternConfig;

  beforeEach(() => {
    mockRepository = new MockMemoryRepository();
    defaultConfig = {
      minPatternConfidence: 0.6,
      minExamplesForPattern: 2,
      maxExampleAgeDays: 90,
      enableVATDetection: true,
      enableCurrencyLearning: true,
      enableDateFormatLearning: true,
      vendorSpecificBoost: 0.2
    };
    engine = new VendorPatternRecognitionEngineImpl(mockRepository, defaultConfig);
  });

  afterEach(() => {
    engine.clearAuditSteps();
  });

  describe('vendor memory isolation', () => {
    it('should isolate memories by vendor ID', async () => {
      // Create memories for different vendors
      const vendor1Memory = createTestVendorMemory('vendor-1', 'memory-1');
      const vendor2Memory = createTestVendorMemory('vendor-2', 'memory-2');
      const vendor1Memory2 = createTestVendorMemory('vendor-1', 'memory-3');

      mockRepository.addMemory(vendor1Memory);
      mockRepository.addMemory(vendor2Memory);
      mockRepository.addMemory(vendor1Memory2);

      // Test isolation for vendor-1
      const vendor1Memories = await engine.isolateVendorMemories('vendor-1');
      expect(vendor1Memories).toHaveLength(2);
      expect(vendor1Memories.every(m => m.vendorId === 'vendor-1')).toBe(true);

      // Test isolation for vendor-2
      const vendor2Memories = await engine.isolateVendorMemories('vendor-2');
      expect(vendor2Memories).toHaveLength(1);
      expect(vendor2Memories[0]!.vendorId).toBe('vendor-2');

      // Test isolation for non-existent vendor
      const nonExistentMemories = await engine.isolateVendorMemories('vendor-3');
      expect(nonExistentMemories).toHaveLength(0);
    });

    it('should not return memories from other vendors', async () => {
      const vendor1Memory = createTestVendorMemory('vendor-1', 'memory-1');
      const vendor2Memory = createTestVendorMemory('vendor-2', 'memory-2');

      mockRepository.addMemory(vendor1Memory);
      mockRepository.addMemory(vendor2Memory);

      const vendor1Memories = await engine.isolateVendorMemories('vendor-1');
      
      expect(vendor1Memories).toHaveLength(1);
      expect(vendor1Memories[0]!.vendorId).toBe('vendor-1');
      expect(vendor1Memories.some(m => m.vendorId === 'vendor-2')).toBe(false);
    });

    it('should record audit steps for memory isolation', async () => {
      const vendorMemory = createTestVendorMemory('test-vendor', 'memory-1');
      mockRepository.addMemory(vendorMemory);

      await engine.isolateVendorMemories('test-vendor');

      const auditSteps = engine.getAuditSteps();
      expect(auditSteps).toHaveLength(1);
      expect(auditSteps[0]!.description).toBe('Vendor memory isolation');
      expect(auditSteps[0]!.input['vendorId']).toBe('test-vendor');
      expect(auditSteps[0]!.output['isolatedMemoriesCount']).toBe(1);
    });
  });

  describe('German field mapping detection', () => {
    it('should detect Leistungsdatum -> serviceDate mapping', async () => {
      const invoice = createTestInvoice('supplier-gmbh', [
        { name: 'Leistungsdatum', value: '15.01.2024', confidence: 0.9 }
      ]);

      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [],
        humanCorrections: []
      };

      const result = await engine.recognizePatterns(context);

      expect(result.detectedMappings).toHaveLength(1);
      expect(result.detectedMappings[0]!.sourceField).toBe('Leistungsdatum');
      expect(result.detectedMappings[0]!.targetField).toBe('serviceDate');
      expect(result.detectedMappings[0]!.transformationRule?.type).toBe(TransformationType.DATE_PARSING);
    });

    it('should detect multiple German field mappings', async () => {
      const invoice = createTestInvoice('supplier-gmbh', [
        { name: 'Leistungsdatum', value: '15.01.2024', confidence: 0.9 },
        { name: 'Rechnungsnummer', value: 'INV-001', confidence: 0.95 },
        { name: 'Gesamtbetrag', value: '100,50 €', confidence: 0.85 }
      ]);

      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [],
        humanCorrections: []
      };

      const result = await engine.recognizePatterns(context);

      expect(result.detectedMappings).toHaveLength(3);
      
      const mappings = result.detectedMappings;
      expect(mappings.some(m => m.sourceField === 'Leistungsdatum' && m.targetField === 'serviceDate')).toBe(true);
      expect(mappings.some(m => m.sourceField === 'Rechnungsnummer' && m.targetField === 'invoiceNumber')).toBe(true);
      expect(mappings.some(m => m.sourceField === 'Gesamtbetrag' && m.targetField === 'totalAmount')).toBe(true);
    });

    it('should apply vendor-specific confidence boost', async () => {
      const invoice = createTestInvoice('supplier-gmbh', [
        { name: 'Leistungsdatum', value: '15.01.2024', confidence: 0.7 }
      ]);

      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [],
        humanCorrections: []
      };

      const result = await engine.recognizePatterns(context);

      expect(result.detectedMappings).toHaveLength(1);
      // Original confidence 0.7 + vendor boost 0.2 = 0.9
      expect(result.detectedMappings[0]!.confidence).toBeCloseTo(0.9, 5);
    });
  });

  describe('VAT behavior detection', () => {
    it('should detect VAT inclusive pricing', async () => {
      const invoices = [
        createTestInvoiceWithText('parts-ag', 'Preise inkl. MwSt. Total: 119,00 €'),
        createTestInvoiceWithText('parts-ag', 'MwSt. inkl. Betrag: 238,00 €'),
        createTestInvoiceWithText('parts-ag', 'Prices incl. VAT: 357,00 €')
      ];

      const vatBehavior = await engine.detectVATBehavior('parts-ag', invoices);

      expect(vatBehavior.vatIncludedInPrices).toBe(true);
      expect(vatBehavior.vatInclusionIndicators).toContain('preise inkl. mwst');
      expect(vatBehavior.vatInclusionIndicators).toContain('mwst. inkl.');
      expect(vatBehavior.vatInclusionIndicators).toContain('prices incl. vat');
    });

    it('should detect VAT exclusive pricing', async () => {
      const invoices = [
        createTestInvoiceWithText('freight-co', 'Netto Betrag: 100,00 € zzgl. MwSt.'),
        createTestInvoiceWithText('freight-co', 'Prices excl. VAT: 200,00 €'),
        createTestInvoiceWithText('freight-co', 'MwSt. excl. Total: 300,00 €')
      ];

      const vatBehavior = await engine.detectVATBehavior('freight-co', invoices);

      expect(vatBehavior.vatIncludedInPrices).toBe(false);
      expect(vatBehavior.vatExclusionIndicators).toContain('zzgl. mwst');
      expect(vatBehavior.vatExclusionIndicators).toContain('prices excl. vat');
      expect(vatBehavior.vatExclusionIndicators).toContain('mwst. excl.');
    });

    it('should detect default VAT rate', async () => {
      const invoices = [
        createTestInvoiceWithText('test-vendor', 'MwSt 19%: 19,00 €'),
        createTestInvoiceWithText('test-vendor', '19% MwSt: 38,00 €'),
        createTestInvoiceWithText('test-vendor', 'VAT 19%: 57,00 €')
      ];

      const vatBehavior = await engine.detectVATBehavior('test-vendor', invoices);

      expect(vatBehavior.defaultVatRate).toBe(19);
    });

    it('should handle mixed VAT indicators by majority', async () => {
      const invoices = [
        createTestInvoiceWithText('mixed-vendor', 'Preise inkl. MwSt.'),
        createTestInvoiceWithText('mixed-vendor', 'MwSt. inkl.'),
        createTestInvoiceWithText('mixed-vendor', 'zzgl. MwSt.') // minority
      ];

      const vatBehavior = await engine.detectVATBehavior('mixed-vendor', invoices);

      expect(vatBehavior.vatIncludedInPrices).toBe(true);
    });
  });

  describe('currency pattern detection', () => {
    it('should detect Euro currency patterns', async () => {
      const invoice = createTestInvoiceWithText('euro-vendor', 
        'Total: 100,50 € Subtotal: €50,25 Amount: 75,75 EUR Final: EUR 200,00'
      );

      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [
          createTestInvoiceWithText('euro-vendor', 'Price: 150,00 € VAT: €30,00'),
          createTestInvoiceWithText('euro-vendor', 'Sum: 250,50 EUR Total: EUR 500,00')
        ],
        humanCorrections: []
      };

      const result = await engine.recognizePatterns(context);

      expect(result.currencyPatterns.length).toBeGreaterThan(0);
      expect(result.currencyPatterns.every(p => p.currencyCode === 'EUR')).toBe(true);
      
      const patterns = result.currencyPatterns.map(p => p.pattern.source);
      expect(patterns.some(p => p.includes('€'))).toBe(true);
      expect(patterns.some(p => p.includes('EUR'))).toBe(true);
    });

    it('should apply vendor-specific boost to currency patterns', async () => {
      const invoice = createTestInvoiceWithText('test-vendor', 'Amount: 100,00 €');
      
      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [
          createTestInvoiceWithText('test-vendor', 'Price: 200,00 €'),
          createTestInvoiceWithText('test-vendor', 'Total: 300,00 €')
        ],
        humanCorrections: []
      };

      const result = await engine.recognizePatterns(context);

      expect(result.currencyPatterns.length).toBeGreaterThan(0);
      // Should have vendor-specific boost applied
      expect(result.currencyPatterns[0]!.confidence).toBeGreaterThan(0.2);
    });
  });

  describe('date format detection', () => {
    it('should detect German date formats', async () => {
      const invoice = createTestInvoiceWithText('german-vendor',
        'Datum: 15.01.2024 Fällig: 28.02.2024 Service: 01.03.24'
      );

      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [
          createTestInvoiceWithText('german-vendor', 'Date: 10.12.2023 Due: 25.12.23'),
          createTestInvoiceWithText('german-vendor', 'Invoice: 05.11.2024 Payment: 20.11.24')
        ],
        humanCorrections: []
      };

      const result = await engine.recognizePatterns(context);

      expect(result.dateFormats.length).toBeGreaterThan(0);
      
      const formats = result.dateFormats.map(f => f.format);
      expect(formats).toContain('DD.MM.YYYY');
      expect(formats).toContain('DD.MM.YY');
    });

    it('should detect ISO date formats', async () => {
      const invoice = createTestInvoiceWithText('iso-vendor',
        'Date: 2024-01-15 Due: 2024-02-28 Service: 2024-03-01'
      );

      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [
          createTestInvoiceWithText('iso-vendor', 'Invoice: 2023-12-10 Payment: 2023-12-25'),
          createTestInvoiceWithText('iso-vendor', 'Created: 2024-11-05 Expires: 2024-11-20')
        ],
        humanCorrections: []
      };

      const result = await engine.recognizePatterns(context);

      expect(result.dateFormats.length).toBeGreaterThan(0);
      expect(result.dateFormats.some(f => f.format === 'YYYY-MM-DD')).toBe(true);
    });
  });

  describe('human correction learning', () => {
    it('should learn from human corrections', async () => {
      const corrections: VendorCorrection[] = [
        {
          invoiceId: 'inv-1',
          fieldName: 'serviceDate',
          originalValue: '2024-01-15',
          correctedValue: '2024-01-16',
          timestamp: new Date(),
          confidence: 0.9
        },
        {
          invoiceId: 'inv-2',
          fieldName: 'totalAmount',
          originalValue: '100.00',
          correctedValue: '119.00',
          timestamp: new Date(),
          confidence: 0.85
        }
      ];

      const invoice = createTestInvoice('corrected-vendor', []);
      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [],
        humanCorrections: corrections
      };

      const result = await engine.recognizePatterns(context);

      expect(result.detectedMappings.length).toBeGreaterThan(0);
      expect(result.reasoning).toContain('human corrections');
    });

    it('should apply vendor-specific boost to correction-based mappings', async () => {
      const corrections: VendorCorrection[] = [
        {
          invoiceId: 'inv-1',
          fieldName: 'serviceDate',
          originalValue: '2024-01-15',
          correctedValue: '2024-01-16',
          timestamp: new Date(),
          confidence: 0.7
        }
      ];

      const invoice = createTestInvoice('test-vendor', []);
      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [],
        humanCorrections: corrections
      };

      const result = await engine.recognizePatterns(context);

      const correctionMapping = result.detectedMappings.find(m => m.sourceField === 'serviceDate');
      expect(correctionMapping).toBeDefined();
      // Original confidence 0.7 + vendor boost 0.2 = 0.9
      expect(correctionMapping!.confidence).toBeCloseTo(0.9, 5);
    });
  });

  describe('field mapping learning', () => {
    it('should learn field mappings from examples', async () => {
      const examples: MappingExample[] = [
        {
          sourceValue: 'Leistungsdatum',
          targetValue: 'serviceDate',
          context: 'Leistungsdatum -> serviceDate'
        },
        {
          sourceValue: '15.01.2024',
          targetValue: '2024-01-15',
          context: 'Leistungsdatum -> serviceDate'
        },
        {
          sourceValue: 'Rechnungsnummer',
          targetValue: 'invoiceNumber',
          context: 'Rechnungsnummer -> invoiceNumber'
        },
        {
          sourceValue: 'INV-001',
          targetValue: 'INV-001',
          context: 'Rechnungsnummer -> invoiceNumber'
        }
      ];

      const mappings = await engine.learnFieldMappings('test-vendor', examples);

      expect(mappings).toHaveLength(2);
      
      const serviceDateMapping = mappings.find(m => m.targetField === 'serviceDate');
      expect(serviceDateMapping).toBeDefined();
      expect(serviceDateMapping!.sourceField).toBe('Leistungsdatum');
      
      const invoiceNumberMapping = mappings.find(m => m.targetField === 'invoiceNumber');
      expect(invoiceNumberMapping).toBeDefined();
      expect(invoiceNumberMapping!.sourceField).toBe('Rechnungsnummer');
    });

    it('should require minimum examples for pattern creation', async () => {
      const examples: MappingExample[] = [
        {
          sourceValue: 'SingleExample',
          targetValue: 'singleTarget',
          context: 'SingleExample -> singleTarget'
        }
      ];

      const mappings = await engine.learnFieldMappings('test-vendor', examples);

      // Should not create mapping with only 1 example (minExamplesForPattern = 2)
      expect(mappings).toHaveLength(0);
    });

    it('should require minimum confidence for pattern creation', async () => {
      // Create engine with high confidence threshold
      const highConfidenceEngine = new VendorPatternRecognitionEngineImpl(
        mockRepository,
        { ...defaultConfig, minPatternConfidence: 0.9 }
      );

      const examples: MappingExample[] = [
        {
          sourceValue: 'LowConfidence1',
          targetValue: 'target1',
          context: 'LowConfidence1 -> target1'
        },
        {
          sourceValue: 'LowConfidence2',
          targetValue: 'target2',
          context: 'LowConfidence1 -> target1'
        }
      ];

      const mappings = await highConfidenceEngine.learnFieldMappings('test-vendor', examples);

      // Should not create mapping due to low confidence
      expect(mappings).toHaveLength(0);
    });
  });

  describe('vendor memory updates', () => {
    it('should create new vendor memory when none exists', async () => {
      const patterns = {
        vendorId: 'new-vendor',
        detectedMappings: [
          {
            sourceField: 'Leistungsdatum',
            targetField: 'serviceDate',
            confidence: 0.9,
            examples: []
          }
        ],
        vatBehavior: {
          vatIncludedInPrices: true,
          vatInclusionIndicators: ['inkl. mwst'],
          vatExclusionIndicators: []
        },
        currencyPatterns: [],
        dateFormats: [],
        overallConfidence: 0.85,
        reasoning: 'Test patterns',
        newPatternsLearned: true
      };

      const vendorMemory = await engine.updateVendorMemory('new-vendor', patterns);

      expect(vendorMemory.vendorId).toBe('new-vendor');
      expect(vendorMemory.fieldMappings).toHaveLength(1);
      expect(vendorMemory.vatBehavior.vatIncludedInPrices).toBe(true);
      expect(vendorMemory.confidence).toBe(0.85);
    });

    it('should update existing vendor memory', async () => {
      // Create existing memory
      const existingMemory = createTestVendorMemory('existing-vendor', 'memory-1');
      mockRepository.addMemory(existingMemory);

      const patterns = {
        vendorId: 'existing-vendor',
        detectedMappings: [
          {
            sourceField: 'NewField',
            targetField: 'newTarget',
            confidence: 0.8,
            examples: []
          }
        ],
        vatBehavior: {
          vatIncludedInPrices: false,
          vatInclusionIndicators: [],
          vatExclusionIndicators: ['excl. vat']
        },
        currencyPatterns: [],
        dateFormats: [],
        overallConfidence: 0.75,
        reasoning: 'Updated patterns',
        newPatternsLearned: true
      };

      const updatedMemory = await engine.updateVendorMemory('existing-vendor', patterns);

      expect(updatedMemory.id).toBe('memory-1');
      expect(updatedMemory.fieldMappings.length).toBe(1); // Should have the new mapping
      expect(updatedMemory.confidence).toBeCloseTo(0.9125, 3); // Should be approximately 0.8 + 0.75 * 0.15
    });
  });

  describe('overall pattern recognition', () => {
    it('should provide comprehensive pattern analysis', async () => {
      const invoice = createTestInvoice('comprehensive-vendor', [
        { name: 'Leistungsdatum', value: '15.01.2024', confidence: 0.9 },
        { name: 'Gesamtbetrag', value: '119,00 €', confidence: 0.85 }
      ]);

      invoice.rawText = 'Leistungsdatum: 15.01.2024 Gesamtbetrag: 119,00 € inkl. 19% MwSt.';

      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [
          createTestInvoiceWithText('comprehensive-vendor', 'Datum: 10.12.2023 Betrag: 238,00 € inkl. MwSt.')
        ],
        humanCorrections: []
      };

      const result = await engine.recognizePatterns(context);

      expect(result.vendorId).toBe('comprehensive-vendor');
      expect(result.detectedMappings.length).toBeGreaterThan(0);
      expect(result.vatBehavior.vatIncludedInPrices).toBe(true);
      expect(result.currencyPatterns.length).toBeGreaterThan(0);
      expect(result.dateFormats.length).toBeGreaterThan(0);
      expect(result.overallConfidence).toBeGreaterThan(0);
      expect(result.reasoning).toContain('Analyzed vendor comprehensive-vendor');
    });

    it('should generate detailed reasoning', async () => {
      const invoice = createTestInvoice('reasoning-vendor', [
        { name: 'Leistungsdatum', value: '15.01.2024', confidence: 0.9 }
      ]);

      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [
          createTestInvoiceWithText('reasoning-vendor', 'Previous invoice text')
        ],
        humanCorrections: [
          {
            invoiceId: 'prev-inv',
            fieldName: 'serviceDate',
            originalValue: '2024-01-14',
            correctedValue: '2024-01-15',
            timestamp: new Date(),
            confidence: 0.9
          }
        ]
      };

      const result = await engine.recognizePatterns(context);

      expect(result.reasoning).toContain('Analyzed vendor reasoning-vendor');
      expect(result.reasoning).toContain('1 historical invoices');
      expect(result.reasoning).toContain('field mappings');
      expect(result.reasoning).toContain('human corrections');
    });
  });

  describe('audit trail', () => {
    it('should record audit steps for all operations', async () => {
      const invoice = createTestInvoice('audit-vendor', [
        { name: 'TestField', value: 'TestValue', confidence: 0.8 }
      ]);

      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [],
        humanCorrections: []
      };

      await engine.recognizePatterns(context);
      await engine.isolateVendorMemories('audit-vendor');

      const auditSteps = engine.getAuditSteps();
      expect(auditSteps.length).toBeGreaterThan(0);
      
      // Should have steps for pattern recognition and memory isolation
      expect(auditSteps.some(step => step.description.includes('pattern recognition'))).toBe(true);
      expect(auditSteps.some(step => step.description.includes('memory isolation'))).toBe(true);
    });

    it('should include timing information in audit steps', async () => {
      const invoice = createTestInvoice('timing-vendor', []);
      const context: VendorLearningContext = {
        invoice,
        historicalInvoices: [],
        humanCorrections: []
      };

      await engine.recognizePatterns(context);

      const auditSteps = engine.getAuditSteps();
      expect(auditSteps.length).toBeGreaterThan(0);
      expect(auditSteps[0]!.duration).toBeGreaterThanOrEqual(0);
    });
  });
});

// Helper functions for creating test data

function createTestVendorMemory(vendorId: string, memoryId: string): VendorMemory {
  const memoryContext: MemoryContext = {
    vendorId,
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

  const memoryPattern: MemoryPattern = {
    patternType: PatternType.FIELD_MAPPING,
    patternData: { vendorId },
    threshold: 0.6
  };

  const vatBehavior: VATBehavior = {
    vatIncludedInPrices: false,
    vatInclusionIndicators: [],
    vatExclusionIndicators: []
  };

  return MemoryFactory.createVendorMemory(
    memoryId,
    memoryPattern,
    0.8,
    memoryContext,
    vendorId,
    vatBehavior,
    [],
    [],
    []
  );
}

function createTestInvoice(vendorId: string, extractedFields: ExtractedField[]): RawInvoice {
  return {
    id: `invoice-${Date.now()}`,
    vendorId,
    invoiceNumber: 'TEST-001',
    rawText: 'Test invoice text',
    extractedFields,
    metadata: {
      sourceSystem: 'test',
      receivedAt: new Date(),
      fileFormat: 'pdf',
      fileSize: 1024,
      detectedLanguage: 'en',
      extractionQuality: QualityLevel.GOOD,
      additionalMetadata: {}
    }
  };
}

function createTestInvoiceWithText(vendorId: string, rawText: string): RawInvoice {
  return {
    id: `invoice-${Date.now()}-${Math.random()}`,
    vendorId,
    invoiceNumber: 'TEST-001',
    rawText,
    extractedFields: [],
    metadata: {
      sourceSystem: 'test',
      receivedAt: new Date(),
      fileFormat: 'pdf',
      fileSize: 1024,
      detectedLanguage: 'en',
      extractionQuality: QualityLevel.GOOD,
      additionalMetadata: {}
    }
  };
}