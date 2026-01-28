/**
 * Property-Based Tests for Duplicate Invoice Detection
 * 
 * **Feature: ai-agent-memory-system, Property 11: Duplicate Invoice Detection**
 * **Validates: Requirements 10.7**
 */

import * as fc from 'fast-check';
import { 
  DuplicateDetectionServiceImpl,
  createDuplicateDetectionService,
  DuplicateDetectionConfig
} from './duplicate-detection';
import { RawInvoice, NormalizedInvoice } from '../types';
import { DatabaseConnection } from '../database/connection';

// Mock database connection for property tests
const createMockDb = (): jest.Mocked<DatabaseConnection> => ({
  all: jest.fn(),
  run: jest.fn(),
  get: jest.fn(),
  close: jest.fn(),
  prepare: jest.fn()
});

// Generators for property-based testing
const invoiceNumberArb = fc.string({ minLength: 5, maxLength: 20 }).filter(s => s.trim().length > 0);
const vendorIdArb = fc.string({ minLength: 3, maxLength: 15 }).filter(s => s.trim().length > 0);
const dateArb = fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') });

const rawInvoiceArb = fc.record({
  id: fc.string({ minLength: 5, maxLength: 20 }),
  vendorId: vendorIdArb,
  invoiceNumber: invoiceNumberArb,
  rawText: fc.string({ minLength: 10, maxLength: 100 }),
  extractedFields: fc.constant([]),
  metadata: fc.constant({
    sourceSystem: 'test',
    receivedAt: new Date(),
    fileFormat: 'pdf',
    fileSize: 1024,
    detectedLanguage: 'en',
    extractionQuality: 'good' as any,
    additionalMetadata: {}
  })
});

const normalizedInvoiceArb = fc.record({
  id: fc.string({ minLength: 5, maxLength: 20 }),
  vendorId: vendorIdArb,
  invoiceNumber: invoiceNumberArb,
  invoiceDate: dateArb,
  totalAmount: fc.record({
    amount: fc.float({ min: 1, max: 10000 }),
    currency: fc.constantFrom('EUR', 'USD', 'GBP')
  }),
  currency: fc.constantFrom('EUR', 'USD', 'GBP'),
  lineItems: fc.constant([]),
  normalizedFields: fc.constant([])
});

describe('Property-Based Tests: Duplicate Invoice Detection', () => {
  let mockDb: jest.Mocked<DatabaseConnection>;
  let service: DuplicateDetectionServiceImpl;

  beforeEach(() => {
    mockDb = createMockDb();
    service = new DuplicateDetectionServiceImpl(mockDb, {
      dateProximityDays: 7,
      enableFuzzyMatching: true,
      fuzzyMatchThreshold: 0.85,
      enableAmountComparison: true,
      amountTolerancePercent: 5
    });
  });

  /**
   * **Property 11: Duplicate Invoice Detection**
   * *For any* pair of invoices from the same vendor with identical invoice numbers 
   * and dates within a proximity threshold, the system should flag them as potential duplicates.
   * **Validates: Requirements 10.7**
   */
  it('Property 11: should detect duplicates for same vendor, invoice number, and date proximity', async () => {
    await fc.assert(
      fc.asyncProperty(
        normalizedInvoiceArb,
        fc.integer({ min: 0, max: 6 }), // Days difference within proximity threshold
        async (baseInvoice, daysDifference) => {
          // Create a potential duplicate with same vendor and invoice number
          const duplicateDate = new Date(baseInvoice.invoiceDate);
          duplicateDate.setDate(duplicateDate.getDate() + daysDifference);
          
          const duplicateRecord = {
            id: `duplicate-${baseInvoice.id}`,
            vendor_id: baseInvoice.vendorId,
            invoice_number: baseInvoice.invoiceNumber,
            invoice_date: duplicateDate.toISOString().split('T')[0],
            confidence_score: 0.9,
            processing_timestamp: new Date().toISOString(),
            corrections_made: null
          };

          // Mock database to return the duplicate candidate
          mockDb.all.mockResolvedValue([duplicateRecord]);

          const result = await service.detectDuplicates(baseInvoice);

          // Property: Should detect duplicates when vendor, invoice number match and date is within proximity
          const shouldDetectDuplicate = 
            baseInvoice.vendorId === duplicateRecord.vendor_id &&
            baseInvoice.invoiceNumber === duplicateRecord.invoice_number &&
            daysDifference <= 7; // Within proximity threshold

          if (shouldDetectDuplicate) {
            // Should flag as duplicate
            expect(result.duplicatesFound).toBe(true);
            expect(result.potentialDuplicates.length).toBeGreaterThan(0);
            
            const duplicate = result.potentialDuplicates[0];
            expect(duplicate.vendorId).toBe(baseInvoice.vendorId);
            expect(duplicate.invoiceNumber).toBe(baseInvoice.invoiceNumber);
            expect(duplicate.daysDifference).toBeLessThanOrEqual(7);
            expect(duplicate.similarityScore).toBeGreaterThan(0.8);
            
            // Should have validation issues
            expect(result.validationIssues.length).toBeGreaterThan(0);
            expect(result.validationIssues[0].description).toContain('duplicate');
          }

          // Property: Confidence should be reasonable (between 0 and 1)
          expect(result.confidence).toBeGreaterThanOrEqual(0);
          expect(result.confidence).toBeLessThanOrEqual(1);

          // Property: Reasoning should be provided
          expect(result.reasoning).toBeDefined();
          expect(result.reasoning.length).toBeGreaterThan(0);

          return true;
        }
      ),
      { numRuns: 100 }
    );
  });

  it('Property: should not detect duplicates for different vendors', async () => {
    await fc.assert(
      fc.asyncProperty(
        normalizedInvoiceArb,
        vendorIdArb.filter(v => v !== 'test-vendor'), // Different vendor
        async (baseInvoice, differentVendorId) => {
          // Ensure different vendor
          fc.pre(differentVendorId !== baseInvoice.vendorId);

          const nonDuplicateRecord = {
            id: `different-vendor-${baseInvoice.id}`,
            vendor_id: differentVendorId,
            invoice_number: baseInvoice.invoiceNumber, // Same invoice number
            invoice_date: baseInvoice.invoiceDate.toISOString().split('T')[0], // Same date
            confidence_score: 0.9,
            processing_timestamp: new Date().toISOString(),
            corrections_made: null
          };

          mockDb.all.mockResolvedValue([nonDuplicateRecord]);

          const result = await service.detectDuplicates(baseInvoice);

          // Property: Different vendors should never be considered duplicates
          expect(result.duplicatesFound).toBe(false);
          expect(result.potentialDuplicates).toHaveLength(0);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property: should not detect duplicates when date is outside proximity threshold', async () => {
    await fc.assert(
      fc.asyncProperty(
        normalizedInvoiceArb,
        fc.integer({ min: 8, max: 30 }), // Days difference outside proximity threshold
        async (baseInvoice, daysDifference) => {
          const farDate = new Date(baseInvoice.invoiceDate);
          farDate.setDate(farDate.getDate() + daysDifference);
          
          const nonDuplicateRecord = {
            id: `far-date-${baseInvoice.id}`,
            vendor_id: baseInvoice.vendorId,
            invoice_number: baseInvoice.invoiceNumber,
            invoice_date: farDate.toISOString().split('T')[0],
            confidence_score: 0.9,
            processing_timestamp: new Date().toISOString(),
            corrections_made: null
          };

          mockDb.all.mockResolvedValue([nonDuplicateRecord]);

          const result = await service.detectDuplicates(baseInvoice);

          // Property: Invoices outside date proximity should not be flagged as duplicates
          // (even with same vendor and invoice number)
          expect(result.duplicatesFound).toBe(false);

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property: duplicate detection should be deterministic', async () => {
    await fc.assert(
      fc.asyncProperty(
        normalizedInvoiceArb,
        async (invoice) => {
          // Mock consistent database response
          const duplicateRecord = {
            id: `duplicate-${invoice.id}`,
            vendor_id: invoice.vendorId,
            invoice_number: invoice.invoiceNumber,
            invoice_date: invoice.invoiceDate.toISOString().split('T')[0],
            confidence_score: 0.9,
            processing_timestamp: new Date().toISOString(),
            corrections_made: null
          };

          mockDb.all.mockResolvedValue([duplicateRecord]);

          // Run detection multiple times
          const result1 = await service.detectDuplicates(invoice);
          const result2 = await service.detectDuplicates(invoice);

          // Property: Results should be deterministic
          expect(result1.duplicatesFound).toBe(result2.duplicatesFound);
          expect(result1.potentialDuplicates.length).toBe(result2.potentialDuplicates.length);
          expect(result1.confidence).toBeCloseTo(result2.confidence, 2);

          if (result1.potentialDuplicates.length > 0 && result2.potentialDuplicates.length > 0) {
            expect(result1.potentialDuplicates[0].similarityScore)
              .toBeCloseTo(result2.potentialDuplicates[0].similarityScore, 2);
          }

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });

  it('Property: should handle empty database results gracefully', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.oneof(rawInvoiceArb, normalizedInvoiceArb),
        async (invoice) => {
          // Mock empty database result
          mockDb.all.mockResolvedValue([]);

          const result = await service.detectDuplicates(invoice);

          // Property: Empty results should be handled gracefully
          expect(result.duplicatesFound).toBe(false);
          expect(result.potentialDuplicates).toHaveLength(0);
          expect(result.validationIssues).toHaveLength(0);
          expect(result.confidence).toBeGreaterThan(0.5); // High confidence no duplicates exist
          expect(result.reasoning).toContain('No duplicate');

          return true;
        }
      ),
      { numRuns: 50 }
    );
  });

  it('Property: should maintain audit trail consistency', async () => {
    await fc.assert(
      fc.asyncProperty(
        normalizedInvoiceArb,
        async (invoice) => {
          mockDb.all.mockResolvedValue([]);

          // Clear previous audit steps
          service.clearAuditSteps();

          await service.detectDuplicates(invoice);

          const auditSteps = service.getAuditSteps();

          // Property: Should always generate audit trail
          expect(auditSteps.length).toBeGreaterThan(0);
          
          const auditStep = auditSteps[0];
          expect(auditStep.operation).toBe('validation');
          expect(auditStep.description).toBe('Duplicate invoice detection');
          expect(auditStep.input.invoiceId).toBe(invoice.id);
          expect(auditStep.output).toBeDefined();
          expect(auditStep.timestamp).toBeInstanceOf(Date);
          expect(auditStep.duration).toBeGreaterThanOrEqual(0);

          return true;
        }
      ),
      { numRuns: 30 }
    );
  });
});