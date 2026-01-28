/**
 * Memory Repository Tests
 * 
 * Comprehensive tests for SQLite-based memory repository implementation
 * Tests CRUD operations, error handling, and database integration
 */

import { SQLiteMemoryRepository, createMemoryRepository } from './memory-repository';
import { DatabaseConnection } from './connection';
import { MemoryFactory } from '../core/memory-base';
import {
  MemoryType,
  PatternType,
  ComplexityLevel,
  QualityLevel,
  CorrectionType,
  DiscrepancyType,
  ResolutionAction,
  HumanDecisionType,
  ConditionOperator,
  CorrectionActionType,
  MemoryPattern,
  MemoryContext,
  VATBehavior,
  Condition,
  CorrectionAction,
  ResolutionOutcome,
  HumanDecision,
  FieldMapping,
  CurrencyPattern,
  DateFormat
} from '../types';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('SQLiteMemoryRepository', () => {
  const testDbPath = join(process.cwd(), `test_memory_repository_${Date.now()}.db`);
  let connection: DatabaseConnection;
  let repository: SQLiteMemoryRepository;

  // Test data setup
  const mockPattern: MemoryPattern = {
    patternType: PatternType.FIELD_MAPPING,
    patternData: { sourceField: 'Leistungsdatum', targetField: 'serviceDate' },
    threshold: 0.7
  };

  const mockContext: MemoryContext = {
    vendorId: 'test-vendor-123',
    invoiceCharacteristics: {
      complexity: ComplexityLevel.SIMPLE,
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
  };

  const mockVATBehavior: VATBehavior = {
    vatIncludedInPrices: true,
    defaultVatRate: 19,
    vatInclusionIndicators: ['incl. MwSt.', 'inkl. VAT'],
    vatExclusionIndicators: ['zzgl. MwSt.', 'excl. VAT']
  };

  beforeEach(async () => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    
    connection = new DatabaseConnection({
      filename: testDbPath,
      verbose: false,
      create: true
    });
    
    await connection.initialize();
    repository = new SQLiteMemoryRepository(connection);
  });

  afterEach(async () => {
    if (connection) {
      await connection.close();
    }
    
    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('Vendor Memory Operations', () => {
    it('should save and retrieve vendor memory correctly', async () => {
      const fieldMappings: FieldMapping[] = [
        {
          sourceField: 'Leistungsdatum',
          targetField: 'serviceDate',
          confidence: 0.9,
          examples: [
            { sourceValue: '15.03.2024', targetValue: '2024-03-15', context: 'German date format' }
          ]
        }
      ];

      const currencyPatterns: CurrencyPattern[] = [
        {
          pattern: /EUR\s*(\d+[,.]?\d*)/,
          currencyCode: 'EUR',
          confidence: 0.95,
          context: 'European currency format'
        }
      ];

      const dateFormats: DateFormat[] = [
        {
          format: 'DD.MM.YYYY',
          pattern: /(\d{2})\.(\d{2})\.(\d{4})/,
          confidence: 0.9,
          examples: ['15.03.2024', '01.12.2023']
        }
      ];

      const vendorMemory = MemoryFactory.createVendorMemory(
        'vendor-memory-1',
        mockPattern,
        0.85,
        mockContext,
        'supplier-gmbh',
        mockVATBehavior,
        fieldMappings,
        currencyPatterns,
        dateFormats
      );

      // Save the memory
      await repository.saveMemory(vendorMemory);

      // Retrieve by ID
      const retrieved = await repository.findMemoryById('vendor-memory-1');
      expect(retrieved).toBeTruthy();
      expect(retrieved!.id).toBe('vendor-memory-1');
      expect(retrieved!.type).toBe(MemoryType.VENDOR);
      expect(retrieved!.confidence).toBe(0.85);

      // Check vendor-specific properties
      const retrievedVendor = retrieved as any;
      expect(retrievedVendor.vendorId).toBe('supplier-gmbh');
      expect(retrievedVendor.fieldMappings).toHaveLength(1);
      expect(retrievedVendor.fieldMappings[0].sourceField).toBe('Leistungsdatum');
      expect(retrievedVendor.currencyPatterns).toHaveLength(1);
      expect(retrievedVendor.dateFormats).toHaveLength(1);
    });

    it('should find memories by vendor ID', async () => {
      const vendorMemory1 = MemoryFactory.createVendorMemory(
        'vendor-memory-1',
        mockPattern,
        0.8,
        mockContext,
        'supplier-gmbh',
        mockVATBehavior
      );

      const vendorMemory2 = MemoryFactory.createVendorMemory(
        'vendor-memory-2',
        mockPattern,
        0.7,
        { ...mockContext, vendorId: 'parts-ag' },
        'parts-ag',
        mockVATBehavior
      );

      await repository.saveMemory(vendorMemory1);
      await repository.saveMemory(vendorMemory2);

      // Find memories for supplier-gmbh
      const supplierMemories = await repository.findMemoriesByVendor('supplier-gmbh');
      expect(supplierMemories).toHaveLength(1);
      expect((supplierMemories[0] as any).vendorId).toBe('supplier-gmbh');

      // Find memories for parts-ag
      const partsMemories = await repository.findMemoriesByVendor('parts-ag');
      expect(partsMemories).toHaveLength(1);
      expect((partsMemories[0] as any).vendorId).toBe('parts-ag');

      // Find memories for non-existent vendor
      const noMemories = await repository.findMemoriesByVendor('non-existent');
      expect(noMemories).toHaveLength(0);
    });
  });

  describe('Correction Memory Operations', () => {
    it('should save and retrieve correction memory correctly', async () => {
      const conditions: Condition[] = [
        {
          field: 'quantity',
          operator: ConditionOperator.GREATER_THAN,
          value: 0,
          context: 'Ensure positive quantity'
        }
      ];

      const correctionAction: CorrectionAction = {
        actionType: CorrectionActionType.MULTIPLY_BY,
        targetField: 'quantity',
        newValue: 2,
        explanation: 'Double quantity based on delivery note pattern'
      };

      const correctionMemory = MemoryFactory.createCorrectionMemory(
        'correction-memory-1',
        mockPattern,
        0.75,
        mockContext,
        CorrectionType.QUANTITY_CORRECTION,
        conditions,
        correctionAction
      );

      // Save the memory
      await repository.saveMemory(correctionMemory);

      // Retrieve by ID
      const retrieved = await repository.findMemoryById('correction-memory-1');
      expect(retrieved).toBeTruthy();
      expect(retrieved!.type).toBe(MemoryType.CORRECTION);

      // Check correction-specific properties
      const retrievedCorrection = retrieved as any;
      expect(retrievedCorrection.correctionType).toBe(CorrectionType.QUANTITY_CORRECTION);
      expect(retrievedCorrection.triggerConditions).toHaveLength(1);
      expect(retrievedCorrection.triggerConditions[0].field).toBe('quantity');
      expect(retrievedCorrection.correctionAction.actionType).toBe(CorrectionActionType.MULTIPLY_BY);
    });

    it('should find memories by type', async () => {
      const correctionMemory = MemoryFactory.createCorrectionMemory(
        'correction-memory-1',
        mockPattern,
        0.75,
        mockContext,
        CorrectionType.QUANTITY_CORRECTION,
        [],
        {
          actionType: CorrectionActionType.SET_VALUE,
          targetField: 'test',
          newValue: 'test'
        }
      );

      const vendorMemory = MemoryFactory.createVendorMemory(
        'vendor-memory-1',
        mockPattern,
        0.8,
        mockContext,
        'test-vendor',
        mockVATBehavior
      );

      await repository.saveMemory(correctionMemory);
      await repository.saveMemory(vendorMemory);

      // Find correction memories
      const correctionMemories = await repository.findMemoriesByType(MemoryType.CORRECTION);
      expect(correctionMemories).toHaveLength(1);
      expect(correctionMemories[0]!.type).toBe(MemoryType.CORRECTION);

      // Find vendor memories
      const vendorMemories = await repository.findMemoriesByType(MemoryType.VENDOR);
      expect(vendorMemories).toHaveLength(1);
      expect(vendorMemories[0]!.type).toBe(MemoryType.VENDOR);
    });
  });

  describe('Resolution Memory Operations', () => {
    it('should save and retrieve resolution memory correctly', async () => {
      const resolutionOutcome: ResolutionOutcome = {
        resolved: true,
        resolutionAction: ResolutionAction.APPROVE_AS_IS,
        finalValue: 'approved',
        explanation: 'Invoice approved after human review'
      };

      const humanDecision: HumanDecision = {
        decisionType: HumanDecisionType.APPROVE,
        timestamp: new Date('2024-03-15T10:30:00Z'),
        userId: 'user-123',
        reasoning: 'Invoice appears correct based on vendor history',
        confidence: 0.9
      };

      const resolutionMemory = MemoryFactory.createResolutionMemory(
        'resolution-memory-1',
        mockPattern,
        0.8,
        mockContext,
        DiscrepancyType.QUANTITY_MISMATCH,
        resolutionOutcome,
        humanDecision
      );

      // Save the memory
      await repository.saveMemory(resolutionMemory);

      // Retrieve by ID
      const retrieved = await repository.findMemoryById('resolution-memory-1');
      expect(retrieved).toBeTruthy();
      expect(retrieved!.type).toBe(MemoryType.RESOLUTION);

      // Check resolution-specific properties
      const retrievedResolution = retrieved as any;
      expect(retrievedResolution.discrepancyType).toBe(DiscrepancyType.QUANTITY_MISMATCH);
      expect(retrievedResolution.resolutionOutcome.resolved).toBe(true);
      expect(retrievedResolution.humanDecision.userId).toBe('user-123');
    });
  });

  describe('Memory Pattern Queries', () => {
    it('should find memories by pattern type', async () => {
      const fieldMappingPattern: MemoryPattern = {
        patternType: PatternType.FIELD_MAPPING,
        patternData: { sourceField: 'test', targetField: 'test' },
        threshold: 0.7
      };

      const regexPattern: MemoryPattern = {
        patternType: PatternType.REGEX,
        patternData: { pattern: '\\d+' },
        threshold: 0.8
      };

      const memory1 = MemoryFactory.createVendorMemory(
        'memory-1',
        fieldMappingPattern,
        0.8,
        mockContext,
        'vendor-1',
        mockVATBehavior
      );

      const memory2 = MemoryFactory.createVendorMemory(
        'memory-2',
        regexPattern,
        0.7,
        mockContext,
        'vendor-2',
        mockVATBehavior
      );

      await repository.saveMemory(memory1);
      await repository.saveMemory(memory2);

      // Find by field mapping pattern
      const fieldMappingMemories = await repository.findMemoriesByPattern(fieldMappingPattern);
      expect(fieldMappingMemories).toHaveLength(1);
      expect(fieldMappingMemories[0]!.pattern.patternType).toBe(PatternType.FIELD_MAPPING);

      // Find by regex pattern
      const regexMemories = await repository.findMemoriesByPattern(regexPattern);
      expect(regexMemories).toHaveLength(1);
      expect(regexMemories[0]!.pattern.patternType).toBe(PatternType.REGEX);
    });
  });

  describe('Memory Management Operations', () => {
    it('should update memory confidence', async () => {
      const memory = MemoryFactory.createVendorMemory(
        'memory-1',
        mockPattern,
        0.8,
        mockContext,
        'test-vendor',
        mockVATBehavior
      );

      await repository.saveMemory(memory);

      // Update confidence
      await repository.updateConfidence('memory-1', 0.9);

      // Retrieve and verify
      const retrieved = await repository.findMemoryById('memory-1');
      expect(retrieved!.confidence).toBe(0.9);
    });

    it('should clamp confidence values to valid range', async () => {
      const memory = MemoryFactory.createVendorMemory(
        'memory-1',
        mockPattern,
        0.8,
        mockContext,
        'test-vendor',
        mockVATBehavior
      );

      await repository.saveMemory(memory);

      // Test upper bound clamping
      await repository.updateConfidence('memory-1', 1.5);
      let retrieved = await repository.findMemoryById('memory-1');
      expect(retrieved!.confidence).toBe(1.0);

      // Test lower bound clamping
      await repository.updateConfidence('memory-1', -0.5);
      retrieved = await repository.findMemoryById('memory-1');
      expect(retrieved!.confidence).toBe(0.0);
    });

    it('should archive memories (soft delete)', async () => {
      const memory = MemoryFactory.createVendorMemory(
        'memory-1',
        mockPattern,
        0.8,
        mockContext,
        'test-vendor',
        mockVATBehavior
      );

      await repository.saveMemory(memory);

      // Verify memory exists
      let retrieved = await repository.findMemoryById('memory-1');
      expect(retrieved).toBeTruthy();

      // Archive the memory
      await repository.archiveMemory('memory-1');

      // Verify memory is no longer retrievable
      retrieved = await repository.findMemoryById('memory-1');
      expect(retrieved).toBeNull();

      // Verify memory still exists in database but is archived
      const archivedMemory = await connection.queryOne(
        'SELECT * FROM memories WHERE id = ? AND archived = TRUE',
        ['memory-1']
      );
      expect(archivedMemory).toBeTruthy();
    });

    it('should permanently delete memories', async () => {
      const memory = MemoryFactory.createVendorMemory(
        'memory-1',
        mockPattern,
        0.8,
        mockContext,
        'test-vendor',
        mockVATBehavior
      );

      await repository.saveMemory(memory);

      // Verify memory exists
      let retrieved = await repository.findMemoryById('memory-1');
      expect(retrieved).toBeTruthy();

      // Delete the memory
      await repository.deleteMemory('memory-1');

      // Verify memory is completely gone
      retrieved = await repository.findMemoryById('memory-1');
      expect(retrieved).toBeNull();

      const deletedMemory = await connection.queryOne(
        'SELECT * FROM memories WHERE id = ?',
        ['memory-1']
      );
      expect(deletedMemory).toBeNull();
    });
  });

  describe('Bulk Operations', () => {
    it('should retrieve all active memories', async () => {
      const memory1 = MemoryFactory.createVendorMemory(
        'memory-1',
        mockPattern,
        0.8,
        mockContext,
        'vendor-1',
        mockVATBehavior
      );

      const memory2 = MemoryFactory.createVendorMemory(
        'memory-2',
        mockPattern,
        0.7,
        mockContext,
        'vendor-2',
        mockVATBehavior
      );

      const memory3 = MemoryFactory.createVendorMemory(
        'memory-3',
        mockPattern,
        0.6,
        mockContext,
        'vendor-3',
        mockVATBehavior
      );

      await repository.saveMemory(memory1);
      await repository.saveMemory(memory2);
      await repository.saveMemory(memory3);

      // Archive one memory
      await repository.archiveMemory('memory-3');

      // Get all active memories
      const allMemories = await repository.getAllMemories();
      expect(allMemories).toHaveLength(2);

      // Should be sorted by confidence descending
      expect(allMemories[0]!.confidence).toBeGreaterThanOrEqual(allMemories[1]!.confidence);
    });

    it('should count active memories correctly', async () => {
      expect(await repository.getMemoryCount()).toBe(0);

      const memory1 = MemoryFactory.createVendorMemory(
        'memory-1',
        mockPattern,
        0.8,
        mockContext,
        'vendor-1',
        mockVATBehavior
      );

      const memory2 = MemoryFactory.createVendorMemory(
        'memory-2',
        mockPattern,
        0.7,
        mockContext,
        'vendor-2',
        mockVATBehavior
      );

      await repository.saveMemory(memory1);
      expect(await repository.getMemoryCount()).toBe(1);

      await repository.saveMemory(memory2);
      expect(await repository.getMemoryCount()).toBe(2);

      await repository.archiveMemory('memory-1');
      expect(await repository.getMemoryCount()).toBe(1);
    });
  });

  describe('Error Handling', () => {
    it('should handle non-existent memory retrieval gracefully', async () => {
      const retrieved = await repository.findMemoryById('non-existent');
      expect(retrieved).toBeNull();
    });

    it('should handle updates to non-existent memories gracefully', async () => {
      // These operations should not throw errors
      await expect(repository.updateConfidence('non-existent', 0.5)).resolves.not.toThrow();
      await expect(repository.archiveMemory('non-existent')).resolves.not.toThrow();
      await expect(repository.deleteMemory('non-existent')).resolves.not.toThrow();
    });

    it('should handle database connection errors gracefully', async () => {
      // Close the connection to simulate error
      await connection.close();

      // Operations should throw appropriate errors
      const memory = MemoryFactory.createVendorMemory(
        'memory-1',
        mockPattern,
        0.8,
        mockContext,
        'test-vendor',
        mockVATBehavior
      );

      await expect(repository.saveMemory(memory)).rejects.toThrow();
      await expect(repository.findMemoryById('memory-1')).rejects.toThrow();
    });
  });

  describe('Memory Replacement and Updates', () => {
    it('should replace existing memory when saving with same ID', async () => {
      const originalMemory = MemoryFactory.createVendorMemory(
        'memory-1',
        mockPattern,
        0.8,
        mockContext,
        'original-vendor',
        mockVATBehavior
      );

      await repository.saveMemory(originalMemory);

      // Verify original memory
      let retrieved = await repository.findMemoryById('memory-1');
      expect((retrieved as any).vendorId).toBe('original-vendor');

      // Save updated memory with same ID
      const updatedMemory = MemoryFactory.createVendorMemory(
        'memory-1',
        mockPattern,
        0.9,
        mockContext,
        'updated-vendor',
        mockVATBehavior
      );

      await repository.saveMemory(updatedMemory);

      // Verify memory was replaced
      retrieved = await repository.findMemoryById('memory-1');
      expect((retrieved as any).vendorId).toBe('updated-vendor');
      expect(retrieved!.confidence).toBe(0.9);

      // Should still have only one memory
      expect(await repository.getMemoryCount()).toBe(1);
    });
  });

  describe('Factory Function', () => {
    it('should create repository instance correctly', () => {
      const repo = createMemoryRepository(connection);
      expect(repo).toBeInstanceOf(SQLiteMemoryRepository);
    });
  });
});