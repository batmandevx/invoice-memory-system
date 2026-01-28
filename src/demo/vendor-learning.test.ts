/**
 * Unit Tests for Specific Vendor Learning Examples
 * 
 * These tests validate the memory system's ability to learn specific patterns
 * from different vendors as outlined in the requirements.
 */

import { 
  MemorySystem, 
  ProcessingResult, 
  ProcessingOutcome,
  ProcessingOutcomeType,
  HumanFeedback,
  FeedbackType,
  Correction,
  VendorMemory,
  MemoryType
} from '../types';
import { createMemorySystem } from '../core/memory-system';
import { DatabaseConnection } from '../database/connection';
import { 
  supplierGmbHInvoices, 
  partsAGInvoices, 
  freightCoInvoices,
  createSampleInvoiceContext 
} from './sample-data';

describe('Vendor Learning Examples', () => {
  let memorySystem: MemorySystem;
  let dbConnection: DatabaseConnection;

  beforeEach(async () => {
    dbConnection = new DatabaseConnection(':memory:');
    await dbConnection.connect();
    memorySystem = createMemorySystem(dbConnection);
  });

  afterEach(async () => {
    await memorySystem.close();
  });

  describe('Supplier GmbH Learning', () => {
    /**
     * Test Supplier GmbH "Leistungsdatum" → serviceDate mapping
     * Requirements: 10.1
     */
    it('should learn to map "Leistungsdatum" to serviceDate field', async () => {
      const invoice = supplierGmbHInvoices[0];
      
      // Initial processing - should not recognize Leistungsdatum
      const initialResult = await memorySystem.processInvoice(invoice);
      expect(initialResult.normalizedInvoice.serviceDate).toBeUndefined();
      expect(initialResult.requiresHumanReview).toBe(true);
      
      // Human correction teaches the system
      const humanFeedback: HumanFeedback = {
        userId: 'test-user',
        timestamp: new Date(),
        feedbackType: FeedbackType.CORRECTION,
        corrections: [{
          field: 'serviceDate',
          originalValue: null,
          correctedValue: new Date('2024-03-10'),
          reason: 'Map "Leistungsdatum" field to serviceDate for German invoices',
          confidence: 0.95
        }],
        satisfactionRating: 5,
        comments: 'German invoices use "Leistungsdatum" to indicate service date'
      };

      const outcome: ProcessingOutcome = {
        result: initialResult,
        humanFeedback,
        outcomeType: ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW,
        performanceMetrics: {
          averageProcessingTime: 5000,
          successRate: 0.85,
          automationRate: 0.60,
          humanReviewRate: 0.40
        }
      };

      await memorySystem.learnFromOutcome(outcome);

      // Process second invoice - should now recognize Leistungsdatum
      const secondInvoice = supplierGmbHInvoices[1];
      const learnedResult = await memorySystem.processInvoice(secondInvoice);
      
      expect(learnedResult.normalizedInvoice.serviceDate).toBeDefined();
      expect(learnedResult.normalizedInvoice.serviceDate).toEqual(new Date('2024-03-20'));
      expect(learnedResult.confidenceScore).toBeGreaterThan(initialResult.confidenceScore);
      expect(learnedResult.reasoning).toContain('Leistungsdatum');
    });

    /**
     * Test Supplier GmbH PO matching patterns
     * Requirements: 10.2
     */
    it('should learn PO matching patterns after observing corrections', async () => {
      const invoice = supplierGmbHInvoices[0];
      
      // Initial processing
      const initialResult = await memorySystem.processInvoice(invoice);
      
      // Human correction for PO number extraction
      const humanFeedback: HumanFeedback = {
        userId: 'test-user',
        timestamp: new Date(),
        feedbackType: FeedbackType.CORRECTION,
        corrections: [{
          field: 'purchaseOrderNumber',
          originalValue: null,
          correctedValue: 'PO-2024-456',
          reason: 'Extract PO number from "Bestellnummer" field in German invoices',
          confidence: 0.92
        }],
        satisfactionRating: 4,
        comments: 'PO numbers are labeled as "Bestellnummer" in German invoices'
      };

      const outcome: ProcessingOutcome = {
        result: initialResult,
        humanFeedback,
        outcomeType: ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW,
        performanceMetrics: {
          averageProcessingTime: 4500,
          successRate: 0.87,
          automationRate: 0.65,
          humanReviewRate: 0.35
        }
      };

      await memorySystem.learnFromOutcome(outcome);

      // Process second invoice
      const secondInvoice = supplierGmbHInvoices[1];
      const learnedResult = await memorySystem.processInvoice(secondInvoice);
      
      expect(learnedResult.normalizedInvoice.purchaseOrderNumber).toBe('PO-2024-789');
      expect(learnedResult.confidenceScore).toBeGreaterThan(0.8);
      expect(learnedResult.reasoning).toContain('Bestellnummer');
    });

    /**
     * Test German date format recognition
     */
    it('should learn German date format (DD.MM.YYYY) patterns', async () => {
      const invoice = supplierGmbHInvoices[0];
      
      const result = await memorySystem.processInvoice(invoice);
      
      // Should correctly parse German date format
      expect(result.normalizedInvoice.invoiceDate).toEqual(new Date('2024-03-15'));
      
      // Should recognize the date format pattern
      const dateField = result.normalizedInvoice.normalizedFields.find(
        field => field.originalField === 'invoiceDate'
      );
      expect(dateField).toBeDefined();
      expect(dateField?.originalValue).toBe('15.03.2024');
    });
  });

  describe('Parts AG VAT Learning', () => {
    /**
     * Test Parts AG VAT handling with "MwSt. inkl." and "Prices incl. VAT"
     * Requirements: 10.3
     */
    it('should handle "MwSt. inkl." and "Prices incl. VAT" with appropriate correction strategies', async () => {
      const invoice = partsAGInvoices[0];
      
      // Initial processing
      const initialResult = await memorySystem.processInvoice(invoice);
      
      // Human correction teaches VAT inclusion recognition
      const humanFeedback: HumanFeedback = {
        userId: 'test-user',
        timestamp: new Date(),
        feedbackType: FeedbackType.CORRECTION,
        corrections: [
          {
            field: 'vatIncluded',
            originalValue: false,
            correctedValue: true,
            reason: 'Recognize "MwSt. inkl." as VAT included indicator',
            confidence: 0.92
          },
          {
            field: 'vatAmount',
            originalValue: null,
            correctedValue: 167.23, // Calculated from 1050.00 with 19% VAT
            reason: 'Calculate VAT amount from VAT-inclusive total',
            confidence: 0.88
          }
        ],
        satisfactionRating: 4,
        comments: 'Parts AG includes VAT in prices, need to extract net amounts'
      };

      const outcome: ProcessingOutcome = {
        result: initialResult,
        humanFeedback,
        outcomeType: ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW,
        performanceMetrics: {
          averageProcessingTime: 5200,
          successRate: 0.83,
          automationRate: 0.58,
          humanReviewRate: 0.42
        }
      };

      await memorySystem.learnFromOutcome(outcome);

      // Process second invoice with different VAT indicator
      const secondInvoice = partsAGInvoices[1];
      const learnedResult = await memorySystem.processInvoice(secondInvoice);
      
      // Should recognize "Prices incl. VAT" as similar pattern
      expect(learnedResult.proposedCorrections).toContainEqual(
        expect.objectContaining({
          field: 'vatIncluded',
          correctedValue: true,
          reason: expect.stringContaining('VAT')
        })
      );
      
      expect(learnedResult.confidenceScore).toBeGreaterThan(initialResult.confidenceScore);
      expect(learnedResult.reasoning).toContain('VAT');
    });

    /**
     * Test Parts AG currency extraction from rawText
     * Requirements: 10.4
     */
    it('should recover missing currency information from rawText with vendor-specific confidence', async () => {
      const invoice = partsAGInvoices[1]; // This one has explicit EUR
      
      // Create modified invoice without currency in extracted fields
      const modifiedInvoice = {
        ...invoice,
        extractedFields: invoice.extractedFields.filter(field => field.name !== 'currency')
      };
      
      const result = await memorySystem.processInvoice(modifiedInvoice);
      
      // Should extract EUR from raw text
      expect(result.normalizedInvoice.currency).toBe('EUR');
      
      // Should have high confidence for Parts AG currency extraction
      const currencyField = result.normalizedInvoice.normalizedFields.find(
        field => field.normalizedField === 'currency'
      );
      expect(currencyField?.confidence).toBeGreaterThan(0.8);
      
      expect(result.reasoning).toContain('currency');
    });

    /**
     * Test customer number pattern recognition
     */
    it('should learn customer number patterns from Parts AG invoices', async () => {
      const invoice = partsAGInvoices[0];
      
      const result = await memorySystem.processInvoice(invoice);
      
      // Should extract customer number
      const customerField = result.normalizedInvoice.normalizedFields.find(
        field => field.originalField === 'customerNumber'
      );
      expect(customerField).toBeDefined();
      expect(customerField?.normalizedValue).toBe('K-12345');
    });
  });

  describe('Freight & Co Skonto Learning', () => {
    /**
     * Test Freight & Co Skonto terms detection and structuring
     * Requirements: 10.5
     */
    it('should detect and structure Skonto payment terms', async () => {
      const invoice = freightCoInvoices[0];
      
      // Initial processing
      const initialResult = await memorySystem.processInvoice(invoice);
      
      // Human correction teaches Skonto term extraction
      const humanFeedback: HumanFeedback = {
        userId: 'test-user',
        timestamp: new Date(),
        feedbackType: FeedbackType.CORRECTION,
        corrections: [{
          field: 'paymentTerms.discountTerms',
          originalValue: null,
          correctedValue: {
            discountPercentage: 2,
            discountDays: 10,
            description: '2% Skonto bei Zahlung innerhalb 10 Tage'
          },
          reason: 'Extract Skonto terms from German payment conditions',
          confidence: 0.85
        }],
        satisfactionRating: 4,
        comments: 'Freight & Co uses German Skonto terms that need structured extraction'
      };

      const outcome: ProcessingOutcome = {
        result: initialResult,
        humanFeedback,
        outcomeType: ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW,
        performanceMetrics: {
          averageProcessingTime: 4800,
          successRate: 0.86,
          automationRate: 0.62,
          humanReviewRate: 0.38
        }
      };

      await memorySystem.learnFromOutcome(outcome);

      // Process second invoice with different Skonto terms
      const secondInvoice = freightCoInvoices[1];
      const learnedResult = await memorySystem.processInvoice(secondInvoice);
      
      // Should recognize and extract different Skonto terms
      expect(learnedResult.proposedCorrections).toContainEqual(
        expect.objectContaining({
          field: 'paymentTerms.discountTerms',
          correctedValue: expect.objectContaining({
            discountPercentage: 3,
            discountDays: 7
          })
        })
      );
      
      expect(learnedResult.confidenceScore).toBeGreaterThan(0.8);
      expect(learnedResult.reasoning).toContain('Skonto');
    });

    /**
     * Test Freight & Co SKU mapping for shipping descriptions
     * Requirements: 10.6
     */
    it('should map shipping descriptions like "Seefracht/Shipping" to SKU FREIGHT', async () => {
      const invoice = freightCoInvoices[0];
      
      // Initial processing
      const initialResult = await memorySystem.processInvoice(invoice);
      
      // Human correction teaches SKU mapping
      const humanFeedback: HumanFeedback = {
        userId: 'test-user',
        timestamp: new Date(),
        feedbackType: FeedbackType.CORRECTION,
        corrections: [{
          field: 'lineItems[0].sku',
          originalValue: null,
          correctedValue: 'FREIGHT',
          reason: 'Map "Seefracht/Shipping" to standard SKU FREIGHT',
          confidence: 0.90
        }],
        satisfactionRating: 5,
        comments: 'Freight & Co uses multilingual descriptions that need SKU mapping'
      };

      const outcome: ProcessingOutcome = {
        result: initialResult,
        humanFeedback,
        outcomeType: ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW,
        performanceMetrics: {
          averageProcessingTime: 4600,
          successRate: 0.88,
          automationRate: 0.64,
          humanReviewRate: 0.36
        }
      };

      await memorySystem.learnFromOutcome(outcome);

      // Process second invoice with different shipping service
      const secondInvoice = freightCoInvoices[1];
      const learnedResult = await memorySystem.processInvoice(secondInvoice);
      
      // Should map "Luftfracht/Air Freight" to FREIGHT SKU
      expect(learnedResult.proposedCorrections).toContainEqual(
        expect.objectContaining({
          field: expect.stringMatching(/lineItems\[\d+\]\.sku/),
          correctedValue: 'FREIGHT',
          reason: expect.stringContaining('FREIGHT')
        })
      );
      
      expect(learnedResult.confidenceScore).toBeGreaterThan(initialResult.confidenceScore);
    });

    /**
     * Test multilingual service description recognition
     */
    it('should recognize multilingual service descriptions', async () => {
      const invoice = freightCoInvoices[0];
      
      const result = await memorySystem.processInvoice(invoice);
      
      // Should handle mixed German/English descriptions
      expect(result.normalizedInvoice.lineItems.length).toBeGreaterThan(0);
      
      const shippingItem = result.normalizedInvoice.lineItems.find(
        item => item.description.includes('Seefracht') || item.description.includes('Shipping')
      );
      expect(shippingItem).toBeDefined();
    });

    /**
     * Test payment terms extraction
     */
    it('should extract complex payment terms with multiple options', async () => {
      const invoice = freightCoInvoices[0];
      
      const result = await memorySystem.processInvoice(invoice);
      
      // Should extract payment terms
      expect(result.normalizedInvoice.paymentTerms).toBeDefined();
      
      // Should recognize both Skonto and net payment terms
      const paymentTermsField = result.normalizedInvoice.normalizedFields.find(
        field => field.normalizedField === 'paymentTerms'
      );
      expect(paymentTermsField).toBeDefined();
    });
  });

  describe('Cross-Vendor Learning', () => {
    /**
     * Test that vendor-specific memories don't interfere with each other
     */
    it('should maintain vendor-specific learning without cross-contamination', async () => {
      // Process invoices from different vendors
      const supplierInvoice = supplierGmbHInvoices[0];
      const partsInvoice = partsAGInvoices[0];
      const freightInvoice = freightCoInvoices[0];
      
      const supplierResult = await memorySystem.processInvoice(supplierInvoice);
      const partsResult = await memorySystem.processInvoice(partsInvoice);
      const freightResult = await memorySystem.processInvoice(freightInvoice);
      
      // Each should have different processing characteristics
      expect(supplierResult.reasoning).not.toBe(partsResult.reasoning);
      expect(partsResult.reasoning).not.toBe(freightResult.reasoning);
      
      // Vendor-specific patterns should not apply to other vendors
      expect(supplierResult.reasoning).toContain('supplier-gmbh');
      expect(partsResult.reasoning).toContain('parts-ag');
      expect(freightResult.reasoning).toContain('freight-co');
    });

    /**
     * Test learning progression across multiple invoices
     */
    it('should show measurable learning progression across multiple invoices', async () => {
      const allInvoices = [
        ...supplierGmbHInvoices,
        ...partsAGInvoices,
        ...freightCoInvoices
      ];
      
      const results: ProcessingResult[] = [];
      
      // Process all invoices and track confidence progression
      for (const invoice of allInvoices) {
        const result = await memorySystem.processInvoice(invoice);
        results.push(result);
        
        // Simulate learning from each processing
        if (result.requiresHumanReview) {
          const mockFeedback: HumanFeedback = {
            userId: 'test-user',
            timestamp: new Date(),
            feedbackType: FeedbackType.APPROVAL,
            corrections: [],
            satisfactionRating: 4,
            comments: 'Approved processing'
          };
          
          const outcome: ProcessingOutcome = {
            result,
            humanFeedback: mockFeedback,
            outcomeType: ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW,
            performanceMetrics: {
              averageProcessingTime: 5000,
              successRate: 0.85,
              automationRate: 0.60,
              humanReviewRate: 0.40
            }
          };
          
          await memorySystem.learnFromOutcome(outcome);
        }
      }
      
      // Confidence should generally improve over time
      const firstHalf = results.slice(0, Math.floor(results.length / 2));
      const secondHalf = results.slice(Math.floor(results.length / 2));
      
      const firstHalfAvgConfidence = firstHalf.reduce((sum, r) => sum + r.confidenceScore, 0) / firstHalf.length;
      const secondHalfAvgConfidence = secondHalf.reduce((sum, r) => sum + r.confidenceScore, 0) / secondHalf.length;
      
      expect(secondHalfAvgConfidence).toBeGreaterThanOrEqual(firstHalfAvgConfidence);
    });
  });

  describe('Memory Persistence', () => {
    /**
     * Test that learned patterns persist across system restarts
     */
    it('should persist learned vendor patterns across system restarts', async () => {
      const invoice = supplierGmbHInvoices[0];
      
      // Process and learn
      const initialResult = await memorySystem.processInvoice(invoice);
      
      const humanFeedback: HumanFeedback = {
        userId: 'test-user',
        timestamp: new Date(),
        feedbackType: FeedbackType.CORRECTION,
        corrections: [{
          field: 'serviceDate',
          originalValue: null,
          correctedValue: new Date('2024-03-10'),
          reason: 'Map "Leistungsdatum" field to serviceDate',
          confidence: 0.95
        }],
        satisfactionRating: 5
      };

      const outcome: ProcessingOutcome = {
        result: initialResult,
        humanFeedback,
        outcomeType: ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW,
        performanceMetrics: {
          averageProcessingTime: 5000,
          successRate: 0.85,
          automationRate: 0.60,
          humanReviewRate: 0.40
        }
      };

      await memorySystem.learnFromOutcome(outcome);
      
      // Close and recreate memory system (simulating restart)
      await memorySystem.close();
      memorySystem = createMemorySystem(dbConnection);
      
      // Process same type of invoice
      const secondInvoice = supplierGmbHInvoices[1];
      const persistedResult = await memorySystem.processInvoice(secondInvoice);
      
      // Should still remember the learned pattern
      expect(persistedResult.normalizedInvoice.serviceDate).toBeDefined();
      expect(persistedResult.confidenceScore).toBeGreaterThan(0.7);
    });
  });
});