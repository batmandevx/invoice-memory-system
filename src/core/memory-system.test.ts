/**
 * Tests for the main MemorySystem class
 * 
 * Focuses on core functionality and integration testing
 * to ensure the main orchestrator works correctly.
 */

import { MemorySystemImpl } from './memory-system';
import { DatabaseConnection } from '../database/connection';
import { RawInvoice, QualityLevel } from '../types';

describe('MemorySystem', () => {
  let memorySystem: MemorySystemImpl;
  let dbConnection: DatabaseConnection;

  beforeEach(async () => {
    dbConnection = new DatabaseConnection({
      filename: ':memory:',
      verbose: false
    });
    await dbConnection.initialize();
    memorySystem = new MemorySystemImpl(dbConnection);
  });

  afterEach(async () => {
    await memorySystem.close();
  });

  describe('processInvoice', () => {
    it('should process a basic invoice successfully', async () => {
      // Arrange
      const rawInvoice: RawInvoice = {
        id: 'test-invoice-1',
        vendorId: 'vendor-123',
        invoiceNumber: 'INV-001',
        rawText: 'Invoice from Test Vendor\nTotal: €100.00',
        extractedFields: [
          {
            name: 'totalAmount',
            value: '100.00',
            confidence: 0.9
          }
        ],
        metadata: {
          sourceSystem: 'test-system',
          receivedAt: new Date(),
          fileFormat: 'pdf',
          fileSize: 1024,
          detectedLanguage: 'en',
          extractionQuality: QualityLevel.GOOD,
          additionalMetadata: {}
        }
      };

      // Act
      const result = await memorySystem.processInvoice(rawInvoice);

      // Assert
      expect(result).toBeDefined();
      expect(result.normalizedInvoice).toBeDefined();
      expect(result.normalizedInvoice.id).toBe('test-invoice-1');
      expect(result.normalizedInvoice.vendorId).toBe('vendor-123');
      expect(result.normalizedInvoice.invoiceNumber).toBe('INV-001');
      expect(result.proposedCorrections).toBeInstanceOf(Array);
      expect(typeof result.requiresHumanReview).toBe('boolean');
      expect(typeof result.reasoning).toBe('string');
      expect(typeof result.confidenceScore).toBe('number');
      expect(result.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(result.confidenceScore).toBeLessThanOrEqual(1);
      expect(result.memoryUpdates).toBeInstanceOf(Array);
      expect(result.auditTrail).toBeInstanceOf(Array);
      expect(result.auditTrail.length).toBeGreaterThan(0);
    });
  });
});