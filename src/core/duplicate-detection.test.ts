/**
 * Unit Tests for Duplicate Detection Service
 */

import { 
  DuplicateDetectionServiceImpl, 
  DuplicateDetectionConfig,
  DuplicateCriteriaType,
  createDuplicateDetectionService
} from './duplicate-detection';
import { 
  RawInvoice, 
  NormalizedInvoice, 
  IssueSeverity, 
  ValidationIssueType 
} from '../types';
import { DatabaseConnection } from '../database/connection';

// Mock database connection
const mockDb: jest.Mocked<DatabaseConnection> = {
  all: jest.fn(),
  run: jest.fn(),
  get: jest.fn(),
  close: jest.fn(),
  prepare: jest.fn()
};

describe('DuplicateDetectionService', () => {
  let service: DuplicateDetectionServiceImpl;
  let config: DuplicateDetectionConfig;

  beforeEach(() => {
    jest.clearAllMocks();
    
    config = {
      dateProximityDays: 7,
      enableFuzzyMatching: true,
      fuzzyMatchThreshold: 0.85,
      enableAmountComparison: true,
      amountTolerancePercent: 5
    };
    
    service = new DuplicateDetectionServiceImpl(mockDb, config);
  });

  describe('detectDuplicates', () => {
    const sampleInvoice: RawInvoice = {
      id: 'inv-001',
      vendorId: 'vendor-123',
      invoiceNumber: 'INV-2024-001',
      rawText: 'Sample invoice text',
      extractedFields: [],
      metadata: {
        sourceSystem: 'test',
        receivedAt: new Date(),
        fileFormat: 'pdf',
        fileSize: 1024,
        detectedLanguage: 'en',
        extractionQuality: 'good' as any,
        additionalMetadata: {}
      }
    };

    it('should detect no duplicates when no candidates exist', async () => {
      // Mock empty database result
      mockDb.all.mockResolvedValue([]);

      const result = await service.detectDuplicates(sampleInvoice);

      expect(result.duplicatesFound).toBe(false);
      expect(result.potentialDuplicates).toHaveLength(0);
      expect(result.validationIssues).toHaveLength(0);
      expect(result.confidence).toBeGreaterThan(0.8);
      expect(result.reasoning).toContain('No duplicate invoices detected');
    });

    it('should detect exact duplicate with same invoice number and vendor', async () => {
      // Mock database result with exact duplicate
      const duplicateRecord = {
        id: 'inv-002',
        vendor_id: 'vendor-123',
        invoice_number: 'INV-2024-001',
        invoice_date: '2024-01-15',
        confidence_score: 0.9,
        processing_timestamp: '2024-01-15T10:00:00Z',
        corrections_made: null
      };
      
      mockDb.all.mockResolvedValue([duplicateRecord]);

      const result = await service.detectDuplicates(sampleInvoice);

      expect(result.duplicatesFound).toBe(true);
      expect(result.potentialDuplicates).toHaveLength(1);
      
      const duplicate = result.potentialDuplicates[0];
      expect(duplicate.duplicateInvoiceId).toBe('inv-002');
      expect(duplicate.vendorId).toBe('vendor-123');
      expect(duplicate.invoiceNumber).toBe('INV-2024-001');
      expect(duplicate.similarityScore).toBeGreaterThan(0.9);
      
      // Check matching criteria
      const exactNumberMatch = duplicate.matchingCriteria.find(
        c => c.criteriaType === DuplicateCriteriaType.EXACT_INVOICE_NUMBER
      );
      expect(exactNumberMatch?.matched).toBe(true);
      expect(exactNumberMatch?.confidence).toBe(1.0);
      
      // Check validation issues
      expect(result.validationIssues).toHaveLength(1);
      expect(result.validationIssues[0].severity).toBe(IssueSeverity.WARNING);
      expect(result.validationIssues[0].issueType).toBe(ValidationIssueType.BUSINESS_RULE_VIOLATION);
      expect(result.validationIssues[0].description).toContain('Potential duplicate invoice detected');
    });

    it('should detect fuzzy duplicate with similar invoice number', async () => {
      // Mock database result with similar invoice number
      const duplicateRecord = {
        id: 'inv-003',
        vendor_id: 'vendor-123',
        invoice_number: 'INV-2024-001A', // Similar but not exact
        invoice_date: '2024-01-15',
        confidence_score: 0.9,
        processing_timestamp: '2024-01-15T10:00:00Z',
        corrections_made: null
      };
      
      mockDb.all.mockResolvedValue([duplicateRecord]);

      const result = await service.detectDuplicates(sampleInvoice);

      expect(result.duplicatesFound).toBe(true);
      expect(result.potentialDuplicates).toHaveLength(1);
      
      const duplicate = result.potentialDuplicates[0];
      expect(duplicate.similarityScore).toBeGreaterThan(0.8);
      
      // Check fuzzy matching criteria
      const fuzzyMatch = duplicate.matchingCriteria.find(
        c => c.criteriaType === DuplicateCriteriaType.FUZZY_INVOICE_NUMBER
      );
      expect(fuzzyMatch?.matched).toBe(true);
      expect(fuzzyMatch?.confidence).toBeGreaterThan(0.8);
    });

    it('should not detect duplicates from different vendors', async () => {
      // Mock database result with different vendor
      const nonDuplicateRecord = {
        id: 'inv-004',
        vendor_id: 'vendor-456', // Different vendor
        invoice_number: 'INV-2024-001',
        invoice_date: '2024-01-15',
        confidence_score: 0.9,
        processing_timestamp: '2024-01-15T10:00:00Z',
        corrections_made: null
      };
      
      mockDb.all.mockResolvedValue([nonDuplicateRecord]);

      const result = await service.detectDuplicates(sampleInvoice);

      expect(result.duplicatesFound).toBe(false);
      expect(result.potentialDuplicates).toHaveLength(0);
    });

    it('should handle database errors gracefully', async () => {
      // Mock database error
      mockDb.all.mockRejectedValue(new Error('Database connection failed'));

      const result = await service.detectDuplicates(sampleInvoice);

      expect(result.duplicatesFound).toBe(false);
      expect(result.potentialDuplicates).toHaveLength(0);
      expect(result.validationIssues).toHaveLength(1);
      expect(result.validationIssues[0].description).toContain('Duplicate detection failed');
      expect(result.confidence).toBe(0.1);
      expect(result.reasoning).toContain('error');
    });
  });
  describe('isDuplicate', () => {
    it('should return true when duplicates are found', async () => {
      // Mock database result with duplicate
      const duplicateRecord = {
        id: 'inv-002',
        vendor_id: 'vendor-123',
        invoice_number: 'INV-2024-001',
        invoice_date: '2024-01-15',
        confidence_score: 0.9,
        processing_timestamp: '2024-01-15T10:00:00Z',
        corrections_made: null
      };
      
      mockDb.all.mockResolvedValue([duplicateRecord]);

      const sampleInvoice: RawInvoice = {
        id: 'inv-001',
        vendorId: 'vendor-123',
        invoiceNumber: 'INV-2024-001',
        rawText: 'Sample invoice text',
        extractedFields: [],
        metadata: {
          sourceSystem: 'test',
          receivedAt: new Date(),
          fileFormat: 'pdf',
          fileSize: 1024,
          detectedLanguage: 'en',
          extractionQuality: 'good' as any,
          additionalMetadata: {}
        }
      };

      const isDuplicate = await service.isDuplicate(sampleInvoice);
      expect(isDuplicate).toBe(true);
    });

    it('should return false when no duplicates are found', async () => {
      mockDb.all.mockResolvedValue([]);

      const sampleInvoice: RawInvoice = {
        id: 'inv-001',
        vendorId: 'vendor-123',
        invoiceNumber: 'INV-2024-001',
        rawText: 'Sample invoice text',
        extractedFields: [],
        metadata: {
          sourceSystem: 'test',
          receivedAt: new Date(),
          fileFormat: 'pdf',
          fileSize: 1024,
          detectedLanguage: 'en',
          extractionQuality: 'good' as any,
          additionalMetadata: {}
        }
      };

      const isDuplicate = await service.isDuplicate(sampleInvoice);
      expect(isDuplicate).toBe(false);
    });
  });

  describe('string similarity calculation', () => {
    it('should calculate correct similarity for identical strings', () => {
      const service = new DuplicateDetectionServiceImpl(mockDb, config);
      // Access private method through type assertion for testing
      const similarity = (service as any).calculateStringSimilarity('INV-2024-001', 'INV-2024-001');
      expect(similarity).toBe(1.0);
    });

    it('should calculate correct similarity for similar strings', () => {
      const service = new DuplicateDetectionServiceImpl(mockDb, config);
      const similarity = (service as any).calculateStringSimilarity('INV-2024-001', 'INV-2024-001A');
      expect(similarity).toBeGreaterThan(0.8);
      expect(similarity).toBeLessThan(1.0);
    });

    it('should calculate correct similarity for different strings', () => {
      const service = new DuplicateDetectionServiceImpl(mockDb, config);
      const similarity = (service as any).calculateStringSimilarity('INV-2024-001', 'PO-2023-999');
      expect(similarity).toBeLessThan(0.5);
    });

    it('should handle empty strings', () => {
      const service = new DuplicateDetectionServiceImpl(mockDb, config);
      const similarity = (service as any).calculateStringSimilarity('', '');
      expect(similarity).toBe(1.0);
      
      const similarity2 = (service as any).calculateStringSimilarity('INV-001', '');
      expect(similarity2).toBe(0.0);
    });
  });

  describe('audit trail', () => {
    it('should record audit steps during duplicate detection', async () => {
      mockDb.all.mockResolvedValue([]);

      const sampleInvoice: RawInvoice = {
        id: 'inv-001',
        vendorId: 'vendor-123',
        invoiceNumber: 'INV-2024-001',
        rawText: 'Sample invoice text',
        extractedFields: [],
        metadata: {
          sourceSystem: 'test',
          receivedAt: new Date(),
          fileFormat: 'pdf',
          fileSize: 1024,
          detectedLanguage: 'en',
          extractionQuality: 'good' as any,
          additionalMetadata: {}
        }
      };

      await service.detectDuplicates(sampleInvoice);

      const auditSteps = service.getAuditSteps();
      expect(auditSteps).toHaveLength(1);
      expect(auditSteps[0].operation).toBe('validation');
      expect(auditSteps[0].description).toBe('Duplicate invoice detection');
      expect(auditSteps[0].input.invoiceId).toBe('inv-001');
      expect(auditSteps[0].output.duplicatesFound).toBe(false);
    });

    it('should clear audit steps', () => {
      service.clearAuditSteps();
      const auditSteps = service.getAuditSteps();
      expect(auditSteps).toHaveLength(0);
    });
  });

  describe('factory function', () => {
    it('should create duplicate detection service with default config', () => {
      const service = createDuplicateDetectionService(mockDb);
      expect(service).toBeInstanceOf(DuplicateDetectionServiceImpl);
    });

    it('should create duplicate detection service with custom config', () => {
      const customConfig = {
        dateProximityDays: 14,
        enableFuzzyMatching: false
      };
      
      const service = createDuplicateDetectionService(mockDb, customConfig);
      expect(service).toBeInstanceOf(DuplicateDetectionServiceImpl);
    });
  });

  describe('date proximity handling', () => {
    it('should consider invoices within date proximity as potential duplicates', async () => {
      const baseDate = new Date('2024-01-15');
      const proximityDate = new Date('2024-01-18'); // 3 days later, within 7-day proximity
      
      const duplicateRecord = {
        id: 'inv-002',
        vendor_id: 'vendor-123',
        invoice_number: 'INV-2024-001',
        invoice_date: proximityDate.toISOString().split('T')[0],
        confidence_score: 0.9,
        processing_timestamp: '2024-01-15T10:00:00Z',
        corrections_made: null
      };
      
      mockDb.all.mockResolvedValue([duplicateRecord]);

      const sampleInvoice: NormalizedInvoice = {
        id: 'inv-001',
        vendorId: 'vendor-123',
        invoiceNumber: 'INV-2024-001',
        invoiceDate: baseDate,
        totalAmount: { amount: 100, currency: 'EUR' },
        currency: 'EUR',
        lineItems: [],
        normalizedFields: []
      };

      const result = await service.detectDuplicates(sampleInvoice);

      expect(result.duplicatesFound).toBe(true);
      expect(result.potentialDuplicates[0].daysDifference).toBe(3);
      
      const dateProximityMatch = result.potentialDuplicates[0].matchingCriteria.find(
        c => c.criteriaType === DuplicateCriteriaType.DATE_PROXIMITY
      );
      expect(dateProximityMatch?.matched).toBe(true);
    });

    it('should not consider invoices outside date proximity as duplicates', async () => {
      const baseDate = new Date('2024-01-15');
      const farDate = new Date('2024-01-30'); // 15 days later, outside 7-day proximity
      
      const nonDuplicateRecord = {
        id: 'inv-002',
        vendor_id: 'vendor-123',
        invoice_number: 'INV-2024-001',
        invoice_date: farDate.toISOString().split('T')[0],
        confidence_score: 0.9,
        processing_timestamp: '2024-01-15T10:00:00Z',
        corrections_made: null
      };
      
      mockDb.all.mockResolvedValue([nonDuplicateRecord]);

      const sampleInvoice: NormalizedInvoice = {
        id: 'inv-001',
        vendorId: 'vendor-123',
        invoiceNumber: 'INV-2024-001',
        invoiceDate: baseDate,
        totalAmount: { amount: 100, currency: 'EUR' },
        currency: 'EUR',
        lineItems: [],
        normalizedFields: []
      };

      const result = await service.detectDuplicates(sampleInvoice);

      // Should still find the candidate but with low similarity due to date difference
      expect(result.duplicatesFound).toBe(false); // Below threshold due to date proximity
    });
  });
});