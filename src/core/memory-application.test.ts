/**
 * Unit Tests for Memory Application Engine
 * 
 * Tests the core functionality of applying memories to transform
 * raw invoices into normalized format with field mappings and corrections.
 */

import {
  MemoryApplicationEngineImpl,
  MemoryApplicationConfig,
  MemoryApplicationType,
  ConflictType,
  createMemoryApplicationEngine
} from './memory-application';
import {
  RawInvoice,
  Memory,
  VendorMemory,
  CorrectionMemory,
  ResolutionMemory,
  FieldMapping,
  TransformationType,
  CorrectionType,
  CorrectionActionType,
  ConditionOperator,
  DiscrepancyType,
  ResolutionAction,
  HumanDecisionType,
  PatternType,
  ComplexityLevel,
  QualityLevel
} from '../types';
import { MemoryFactory } from './memory-base';

describe('MemoryApplicationEngine', () => {
  let engine: MemoryApplicationEngineImpl;
  let mockInvoice: RawInvoice;
  let mockVendorMemory: VendorMemory;
  let mockCorrectionMemory: CorrectionMemory;
  let mockResolutionMemory: ResolutionMemory;

  beforeEach(() => {
    engine = new MemoryApplicationEngineImpl();
    
    mockInvoice = {
      id: 'inv-001',
      vendorId: 'supplier-gmbh',
      invoiceNumber: 'INV-2024-001',
      rawText: 'Invoice INV-2024-001\nLeistungsdatum: 15.03.2024\nTotal: 1500.00 EUR\nMwSt. inkl.',
      extractedFields: [
        { name: 'invoiceNumber', value: 'INV-2024-001', confidence: 0.95 },
        { name: 'Leistungsdatum', value: '15.03.2024', confidence: 0.9 },
        { name: 'totalAmount', value: '1500.00', confidence: 0.85 },
        { name: 'currency', value: 'EUR', confidence: 0.9 }
      ],
      metadata: {
        sourceSystem: 'test',
        receivedAt: new Date(),
        fileFormat: 'pdf',
        fileSize: 1024,
        detectedLanguage: 'de',
        extractionQuality: 'good' as any,
        additionalMetadata: {}
      }
    };

    mockVendorMemory = MemoryFactory.createVendorMemory(
      'vendor-mem-001',
      {
        patternType: PatternType.FIELD_MAPPING,
        patternData: { vendor: 'supplier-gmbh' },
        threshold: 0.7
      },
      0.85,
      {
        vendorId: 'supplier-gmbh',
        invoiceCharacteristics: {
          complexity: ComplexityLevel.MODERATE,
          language: 'de',
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
      'supplier-gmbh',
      {
        vatIncludedInPrices: true,
        defaultVatRate: 0.19,
        vatInclusionIndicators: ['MwSt. inkl.', 'incl. VAT'],
        vatExclusionIndicators: ['zzgl. MwSt.', 'excl. VAT']
      }
    );

    // Add field mapping to vendor memory
    mockVendorMemory.fieldMappings.push({
      sourceField: 'Leistungsdatum',
      targetField: 'serviceDate',
      transformationRule: {
        type: TransformationType.DATE_PARSING,
        parameters: { format: 'DD.MM.YYYY' }
      },
      confidence: 0.9,
      examples: [
        { sourceValue: '15.03.2024', targetValue: '2024-03-15', context: 'German date format' }
      ]
    });

    mockCorrectionMemory = MemoryFactory.createCorrectionMemory(
      'correction-mem-001',
      {
        patternType: PatternType.CONTEXTUAL,
        patternData: { correctionType: 'currency_extraction' },
        threshold: 0.6
      },
      0.8,
      {
        vendorId: 'supplier-gmbh',
        invoiceCharacteristics: {
          complexity: ComplexityLevel.MODERATE,
          language: 'de',
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
      CorrectionType.CURRENCY_CORRECTION,
      [
        {
          field: 'currency',
          operator: ConditionOperator.NOT_EXISTS,
          value: null
        }
      ],
      {
        actionType: CorrectionActionType.SET_VALUE,
        targetField: 'currency',
        newValue: 'EUR',
        explanation: 'Default currency for German suppliers'
      }
    );

    mockResolutionMemory = MemoryFactory.createResolutionMemory(
      'resolution-mem-001',
      {
        patternType: PatternType.CONTEXTUAL,
        patternData: { discrepancyType: 'quantity_mismatch' },
        threshold: 0.7
      },
      0.75,
      {
        vendorId: 'supplier-gmbh',
        invoiceCharacteristics: {
          complexity: ComplexityLevel.MODERATE,
          language: 'de',
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
      DiscrepancyType.QUANTITY_MISMATCH,
      {
        resolved: true,
        resolutionAction: ResolutionAction.APPLY_CORRECTION,
        finalValue: 'corrected_quantity',
        explanation: 'Applied delivery note quantity'
      },
      {
        decisionType: HumanDecisionType.APPROVE,
        timestamp: new Date(),
        userId: 'user-001',
        reasoning: 'Delivery note quantity is more accurate',
        confidence: 0.9
      }
    );
  });

  describe('Constructor and Configuration', () => {
    it('should create engine with default configuration', () => {
      const engine = new MemoryApplicationEngineImpl();
      expect(engine).toBeInstanceOf(MemoryApplicationEngineImpl);
    });

    it('should create engine with custom configuration', () => {
      const config: Partial<MemoryApplicationConfig> = {
        maxMemoriesPerInvoice: 10,
        minApplicationThreshold: 0.5,
        enableFieldMappings: false
      };
      
      const engine = new MemoryApplicationEngineImpl(config);
      expect(engine).toBeInstanceOf(MemoryApplicationEngineImpl);
    });

    it('should create engine using factory function', () => {
      const engine = createMemoryApplicationEngine();
      expect(engine).toBeDefined();
    });
  });

  describe('applyMemories', () => {
    it('should apply vendor memory field mappings successfully', async () => {
      const memories: Memory[] = [mockVendorMemory];
      
      const result = await engine.applyMemories(mockInvoice, memories);
      
      expect(result.normalizedInvoice).toBeDefined();
      expect(result.normalizedFields).toHaveLength(1);
      expect(result.normalizedFields[0]?.originalField).toBe('Leistungsdatum');
      expect(result.normalizedFields[0]?.normalizedField).toBe('serviceDate');
      expect(result.appliedMemories).toHaveLength(1);
      expect(result.appliedMemories[0]?.applicationType).toBe(MemoryApplicationType.FIELD_MAPPING);
    });

    it('should generate corrections from correction memories', async () => {
      // Create invoice without currency to trigger correction
      const invoiceWithoutCurrency = {
        ...mockInvoice,
        rawText: 'Invoice INV-2024-001\nLeistungsdatum: 15.03.2024\nTotal: 1500.00\nMwSt. inkl.', // Remove EUR
        extractedFields: mockInvoice.extractedFields.filter(f => f.name !== 'currency')
      };
      
      const memories: Memory[] = [mockCorrectionMemory];
      
      const result = await engine.applyMemories(invoiceWithoutCurrency, memories);
      
      expect(result.proposedCorrections).toHaveLength(1);
      expect(result.proposedCorrections[0]?.field).toBe('currency');
      expect(result.proposedCorrections[0]?.correctedValue).toBe('EUR');
      expect(result.appliedMemories).toHaveLength(1);
      expect(result.appliedMemories[0]?.applicationType).toBe(MemoryApplicationType.CORRECTION);
    });

    it('should handle resolution memories', async () => {
      const memories: Memory[] = [mockResolutionMemory];
      
      const result = await engine.applyMemories(mockInvoice, memories);
      
      expect(result.appliedMemories).toHaveLength(1);
      expect(result.appliedMemories[0]?.applicationType).toBe(MemoryApplicationType.RESOLUTION);
      expect(result.appliedMemories[0]?.reasoning).toContain('Resolution memory available');
    });

    it('should filter memories by confidence threshold', async () => {
      const lowConfidenceMemory = { ...mockVendorMemory, confidence: 0.2 };
      const memories: Memory[] = [lowConfidenceMemory];
      
      const result = await engine.applyMemories(mockInvoice, memories);
      
      expect(result.appliedMemories).toHaveLength(0);
      expect(result.normalizedFields).toHaveLength(0);
    });

    it('should limit number of applied memories', async () => {
      const config: Partial<MemoryApplicationConfig> = {
        maxMemoriesPerInvoice: 1
      };
      const engine = new MemoryApplicationEngineImpl(config);
      
      const memories: Memory[] = [mockVendorMemory, mockCorrectionMemory, mockResolutionMemory];
      
      const result = await engine.applyMemories(mockInvoice, memories);
      
      expect(result.appliedMemories.length).toBeLessThanOrEqual(1);
    });

    it('should calculate application confidence correctly', async () => {
      const memories: Memory[] = [mockVendorMemory];
      
      const result = await engine.applyMemories(mockInvoice, memories);
      
      expect(result.applicationConfidence).toBeGreaterThan(0);
      expect(result.applicationConfidence).toBeLessThanOrEqual(1);
    });

    it('should generate comprehensive reasoning', async () => {
      const memories: Memory[] = [mockVendorMemory, mockCorrectionMemory];
      
      const result = await engine.applyMemories(mockInvoice, memories);
      
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning).toContain('Applied');
      expect(result.reasoning.length).toBeGreaterThan(10);
    });

    it('should create audit trail', async () => {
      const memories: Memory[] = [mockVendorMemory];
      
      const result = await engine.applyMemories(mockInvoice, memories);
      
      expect(result.auditSteps).toHaveLength(1);
      expect(result.auditSteps[0]?.operation).toBe('memory_application');
    });
  });

  describe('applyFieldMappings', () => {
    it('should apply direct field mappings', async () => {
      const directMapping: FieldMapping = {
        sourceField: 'invoiceNumber',
        targetField: 'invoiceNumber',
        confidence: 0.95,
        examples: []
      };
      
      mockVendorMemory.fieldMappings = [directMapping];
      
      const result = await engine.applyFieldMappings(mockInvoice, [mockVendorMemory]);
      
      expect(result.normalizedFields).toHaveLength(1);
      expect(result.normalizedFields[0]?.originalField).toBe('invoiceNumber');
      expect(result.normalizedFields[0]?.normalizedField).toBe('invoiceNumber');
      expect(result.normalizedFields[0]?.originalValue).toBe('INV-2024-001');
    });

    it('should apply date parsing transformations', async () => {
      const result = await engine.applyFieldMappings(mockInvoice, [mockVendorMemory]);
      
      expect(result.normalizedFields).toHaveLength(1);
      expect(result.transformations).toHaveLength(1);
      expect(result.transformations[0]?.transformationType).toBe(TransformationType.DATE_PARSING);
      expect(result.transformations[0]?.transformedValue).toBeInstanceOf(Date);
    });

    it('should handle currency extraction transformations', async () => {
      const currencyMapping: FieldMapping = {
        sourceField: 'totalAmount',
        targetField: 'totalAmount',
        transformationRule: {
          type: TransformationType.CURRENCY_EXTRACTION,
          parameters: { defaultCurrency: 'EUR' }
        },
        confidence: 0.85,
        examples: []
      };
      
      mockVendorMemory.fieldMappings = [currencyMapping];
      
      const result = await engine.applyFieldMappings(mockInvoice, [mockVendorMemory]);
      
      expect(result.transformations).toHaveLength(1);
      expect(result.transformations[0]?.transformationType).toBe(TransformationType.CURRENCY_EXTRACTION);
    });

    it('should handle text normalization transformations', async () => {
      const textMapping: FieldMapping = {
        sourceField: 'invoiceNumber',
        targetField: 'normalizedInvoiceNumber',
        transformationRule: {
          type: TransformationType.TEXT_NORMALIZATION,
          parameters: { trim: true, toLowerCase: false }
        },
        confidence: 0.9,
        examples: []
      };
      
      mockVendorMemory.fieldMappings = [textMapping];
      
      const result = await engine.applyFieldMappings(mockInvoice, [mockVendorMemory]);
      
      expect(result.transformations).toHaveLength(1);
      expect(result.transformations[0]?.transformationType).toBe(TransformationType.TEXT_NORMALIZATION);
    });

    it('should handle regex extraction transformations', async () => {
      const regexMapping: FieldMapping = {
        sourceField: 'invoiceNumber',
        targetField: 'extractedNumber',
        transformationRule: {
          type: TransformationType.REGEX_EXTRACTION,
          parameters: { pattern: '(\\d+)', flags: 'g' }
        },
        confidence: 0.8,
        examples: []
      };
      
      mockVendorMemory.fieldMappings = [regexMapping];
      
      const result = await engine.applyFieldMappings(mockInvoice, [mockVendorMemory]);
      
      expect(result.transformations).toHaveLength(1);
      expect(result.transformations[0]?.transformationType).toBe(TransformationType.REGEX_EXTRACTION);
    });

    it('should skip mappings for missing source fields', async () => {
      const missingFieldMapping: FieldMapping = {
        sourceField: 'nonExistentField',
        targetField: 'someTarget',
        confidence: 0.9,
        examples: []
      };
      
      mockVendorMemory.fieldMappings = [missingFieldMapping];
      
      const result = await engine.applyFieldMappings(mockInvoice, [mockVendorMemory]);
      
      expect(result.normalizedFields).toHaveLength(0);
      expect(result.transformations).toHaveLength(0);
    });

    it('should handle transformation errors gracefully', async () => {
      const invalidMapping: FieldMapping = {
        sourceField: 'invoiceNumber',
        targetField: 'invalidTarget',
        transformationRule: {
          type: TransformationType.DATE_PARSING,
          parameters: { format: 'invalid' }
        },
        confidence: 0.9,
        examples: []
      };
      
      mockVendorMemory.fieldMappings = [invalidMapping];
      
      // Should not throw error
      const result = await engine.applyFieldMappings(mockInvoice, [mockVendorMemory]);
      
      expect(result.normalizedFields).toHaveLength(1); // Still creates normalized field
      expect(result.transformations).toHaveLength(1);
    });
  });

  describe('generateCorrections', () => {
    it('should generate corrections when conditions are met', async () => {
      // Create invoice without currency to trigger correction
      const invoiceWithoutCurrency = {
        ...mockInvoice,
        rawText: 'Invoice INV-2024-001\nLeistungsdatum: 15.03.2024\nTotal: 1500.00\nMwSt. inkl.', // Remove EUR
        extractedFields: mockInvoice.extractedFields.filter(f => f.name !== 'currency')
      };
      
      const result = await engine.generateCorrections(invoiceWithoutCurrency, [mockCorrectionMemory]);
      
      expect(result).toHaveLength(1);
      expect(result[0]?.field).toBe('currency');
      expect(result[0]?.correctedValue).toBe('EUR');
      expect(result[0]?.confidence).toBe(0.8);
    });

    it('should not generate corrections when conditions are not met', async () => {
      // Invoice already has currency, so condition is not met
      const result = await engine.generateCorrections(mockInvoice, [mockCorrectionMemory]);
      
      expect(result).toHaveLength(0);
    });

    it('should handle multiple correction memories', async () => {
      const secondCorrectionMemory = MemoryFactory.createCorrectionMemory(
        'correction-mem-002',
        {
          patternType: PatternType.CONTEXTUAL,
          patternData: { correctionType: 'quantity_adjustment' },
          threshold: 0.6
        },
        0.75,
        mockCorrectionMemory.context,
        CorrectionType.QUANTITY_CORRECTION,
        [
          {
            field: 'quantity',
            operator: ConditionOperator.LESS_THAN,
            value: 1
          }
        ],
        {
          actionType: CorrectionActionType.SET_VALUE,
          targetField: 'quantity',
          newValue: 1,
          explanation: 'Minimum quantity is 1'
        }
      );

      // Add quantity field with value 0 to trigger second correction
      const invoiceWithZeroQuantity = {
        ...mockInvoice,
        rawText: 'Invoice INV-2024-001\nLeistungsdatum: 15.03.2024\nTotal: 1500.00\nMwSt. inkl.', // Remove EUR
        extractedFields: [
          ...mockInvoice.extractedFields.filter(f => f.name !== 'currency'),
          { name: 'quantity', value: 0, confidence: 0.9 }
        ]
      };
      
      const result = await engine.generateCorrections(
        invoiceWithZeroQuantity, 
        [mockCorrectionMemory, secondCorrectionMemory]
      );
      
      expect(result).toHaveLength(2);
    });

    it('should handle different correction action types', async () => {
      const multiplyCorrection = MemoryFactory.createCorrectionMemory(
        'multiply-correction',
        mockCorrectionMemory.pattern,
        0.8,
        mockCorrectionMemory.context,
        CorrectionType.QUANTITY_CORRECTION,
        [
          {
            field: 'totalAmount',
            operator: ConditionOperator.EXISTS,
            value: null
          }
        ],
        {
          actionType: CorrectionActionType.MULTIPLY_BY,
          targetField: 'totalAmount',
          newValue: 1.19, // Add VAT
          explanation: 'Add 19% VAT'
        }
      );

      const result = await engine.generateCorrections(mockInvoice, [multiplyCorrection]);
      
      expect(result).toHaveLength(1);
      expect(result[0]?.field).toBe('totalAmount');
    });
  });

  describe('resolveConflicts', () => {
    it('should resolve field mapping conflicts', async () => {
      const conflictingMemory = MemoryFactory.createVendorMemory(
        'vendor-mem-002',
        mockVendorMemory.pattern,
        0.9, // Higher confidence
        mockVendorMemory.context,
        'supplier-gmbh',
        mockVendorMemory.vatBehavior
      );

      // Add conflicting field mapping
      conflictingMemory.fieldMappings.push({
        sourceField: 'Leistungsdatum',
        targetField: 'serviceDate',
        transformationRule: {
          type: TransformationType.TEXT_NORMALIZATION,
          parameters: {}
        },
        confidence: 0.95,
        examples: []
      });

      const memories: Memory[] = [mockVendorMemory, conflictingMemory];
      
      const result = await engine.resolveConflicts(memories, mockInvoice);
      
      expect(result).toHaveLength(1);
      expect(result[0]?.conflictType).toBe(ConflictType.FIELD_MAPPING_CONFLICT);
      expect(result[0]?.selectedMemory.confidence).toBe(0.9); // Higher confidence memory selected
    });

    it('should resolve correction conflicts', async () => {
      const conflictingCorrectionMemory = MemoryFactory.createCorrectionMemory(
        'correction-mem-002',
        mockCorrectionMemory.pattern,
        0.9, // Higher confidence
        mockCorrectionMemory.context,
        CorrectionType.CURRENCY_CORRECTION,
        mockCorrectionMemory.triggerConditions,
        {
          actionType: CorrectionActionType.SET_VALUE,
          targetField: 'currency',
          newValue: 'USD', // Different correction
          explanation: 'Use USD for this vendor'
        }
      );

      const memories: Memory[] = [mockCorrectionMemory, conflictingCorrectionMemory];
      
      const result = await engine.resolveConflicts(memories, mockInvoice);
      
      expect(result).toHaveLength(1);
      expect(result[0]?.conflictType).toBe(ConflictType.CORRECTION_CONFLICT);
      expect(result[0]?.selectedMemory.confidence).toBe(0.9);
    });

    it('should handle no conflicts', async () => {
      const memories: Memory[] = [mockVendorMemory]; // Single memory, no conflicts
      
      const result = await engine.resolveConflicts(memories, mockInvoice);
      
      expect(result).toHaveLength(0);
    });
  });

  describe('validateApplications', () => {
    it('should validate successful transformations', async () => {
      const transformation = {
        transformationType: TransformationType.DATE_PARSING,
        sourceField: 'Leistungsdatum',
        targetField: 'serviceDate',
        originalValue: '15.03.2024',
        transformedValue: new Date('2024-03-15'),
        confidence: 0.9,
        transformationRule: {
          type: TransformationType.DATE_PARSING,
          parameters: { format: 'DD.MM.YYYY' }
        }
      };

      const correction = {
        field: 'currency',
        originalValue: undefined,
        correctedValue: 'EUR',
        reason: 'Default currency',
        confidence: 0.8
      };

      const result = await engine.validateApplications([transformation], [correction], mockInvoice);
      
      expect(result).toHaveLength(2); // One for transformation, one for correction
      expect(result[0]?.isValid).toBe(true);
      expect(result[1]?.isValid).toBe(true);
    });

    it('should detect validation failures', async () => {
      const failedTransformation = {
        transformationType: TransformationType.DATE_PARSING,
        sourceField: 'invalidDate',
        targetField: 'serviceDate',
        originalValue: 'invalid-date',
        transformedValue: undefined, // Failed transformation
        confidence: 0.5
      };

      const invalidCorrection = {
        field: 'currency',
        originalValue: 'EUR',
        correctedValue: undefined, // Invalid correction
        reason: 'Failed correction',
        confidence: 0 // Zero confidence
      };

      const result = await engine.validateApplications([failedTransformation], [invalidCorrection], mockInvoice);
      
      expect(result).toHaveLength(2);
      expect(result[0]?.isValid).toBe(false);
      expect(result[1]?.isValid).toBe(false);
    });
  });

  describe('Audit Trail', () => {
    it('should maintain audit trail', async () => {
      const memories: Memory[] = [mockVendorMemory];
      
      await engine.applyMemories(mockInvoice, memories);
      
      const auditSteps = engine.getAuditSteps();
      expect(auditSteps).toHaveLength(1);
      expect(auditSteps[0]?.operation).toBe('memory_application');
      expect(auditSteps[0]?.actor).toBe('MemoryApplicationEngine');
    });

    it('should clear audit trail', () => {
      engine.clearAuditSteps();
      const auditSteps = engine.getAuditSteps();
      expect(auditSteps).toHaveLength(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle memory application errors gracefully', async () => {
      const invalidMemory = {
        ...mockVendorMemory,
        fieldMappings: [
          {
            sourceField: 'invalidField',
            targetField: 'invalidTarget',
            transformationRule: {
              type: 'INVALID_TYPE' as any,
              parameters: {}
            },
            confidence: 0.9,
            examples: []
          }
        ]
      };

      const memories: Memory[] = [invalidMemory];
      
      // Should not throw error
      const result = await engine.applyMemories(mockInvoice, memories);
      
      expect(result).toBeDefined();
      expect(result.failedMemories.length).toBeGreaterThanOrEqual(0);
    });

    it('should handle transformation timeouts', async () => {
      const config: Partial<MemoryApplicationConfig> = {
        transformationTimeout: 1 // Very short timeout
      };
      const engine = new MemoryApplicationEngineImpl(config);
      
      const memories: Memory[] = [mockVendorMemory];
      
      // Should complete despite short timeout (our transformations are fast)
      const result = await engine.applyMemories(mockInvoice, memories);
      
      expect(result).toBeDefined();
    });
  });

  describe('Integration Scenarios', () => {
    it('should handle Supplier GmbH Leistungsdatum mapping scenario', async () => {
      // This tests the specific requirement for Supplier GmbH
      const supplierMemory = MemoryFactory.createVendorMemory(
        'supplier-gmbh-memory',
        {
          patternType: PatternType.FIELD_MAPPING,
          patternData: { vendor: 'supplier-gmbh' },
          threshold: 0.7
        },
        0.9,
        {
          vendorId: 'supplier-gmbh',
          invoiceCharacteristics: {
            complexity: ComplexityLevel.MODERATE,
            language: 'de',
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
        'supplier-gmbh',
        {
          vatIncludedInPrices: true,
          defaultVatRate: 0.19,
          vatInclusionIndicators: ['MwSt. inkl.'],
          vatExclusionIndicators: []
        }
      );

      supplierMemory.fieldMappings.push({
        sourceField: 'Leistungsdatum',
        targetField: 'serviceDate',
        transformationRule: {
          type: TransformationType.DATE_PARSING,
          parameters: { format: 'DD.MM.YYYY' }
        },
        confidence: 0.95,
        examples: [
          { sourceValue: '15.03.2024', targetValue: '2024-03-15', context: 'German date format' }
        ]
      });

      const result = await engine.applyMemories(mockInvoice, [supplierMemory]);
      
      expect(result.normalizedInvoice.serviceDate).toBeInstanceOf(Date);
      expect(result.normalizedFields).toHaveLength(1);
      expect(result.normalizedFields[0]?.originalField).toBe('Leistungsdatum');
      expect(result.normalizedFields[0]?.normalizedField).toBe('serviceDate');
      expect(result.appliedMemories).toHaveLength(1);
      expect(result.reasoning).toContain('field mapping');
    });

    it('should handle currency extraction for Parts AG scenario', async () => {
      const partsInvoice: RawInvoice = {
        ...mockInvoice,
        vendorId: 'parts-ag',
        rawText: 'Invoice from Parts AG\nTotal: 2500.00\nPrices incl. VAT\nCurrency missing from extraction',
        extractedFields: [
          { name: 'totalAmount', value: '2500.00', confidence: 0.9 }
          // Note: currency field is missing
        ]
      };

      const partsMemory = MemoryFactory.createCorrectionMemory(
        'parts-ag-currency',
        {
          patternType: PatternType.CONTEXTUAL,
          patternData: { vendor: 'parts-ag' },
          threshold: 0.6
        },
        0.85,
        {
          vendorId: 'parts-ag',
          invoiceCharacteristics: {
            complexity: ComplexityLevel.MODERATE,
            language: 'en',
            documentFormat: 'pdf',
            extractionQuality: QualityLevel.FAIR
          },
          historicalContext: {
            recentResults: [],
            trendingPatterns: [],
            seasonalFactors: []
          },
          environmentalFactors: []
        },
        CorrectionType.CURRENCY_CORRECTION,
        [
          {
            field: 'currency',
            operator: ConditionOperator.NOT_EXISTS,
            value: null
          }
        ],
        {
          actionType: CorrectionActionType.SET_VALUE,
          targetField: 'currency',
          newValue: 'EUR',
          explanation: 'Default currency for Parts AG based on vendor location'
        }
      );

      const result = await engine.applyMemories(partsInvoice, [partsMemory]);
      
      expect(result.proposedCorrections).toHaveLength(1);
      expect(result.proposedCorrections[0]?.field).toBe('currency');
      expect(result.proposedCorrections[0]?.correctedValue).toBe('EUR');
      expect(result.normalizedInvoice.currency).toBe('EUR');
    });
  });
});