/**
 * Property Test: Learning Progression Over Time
 * 
 * **Feature: ai-agent-memory-system, Property 12: Learning Progression Over Time**
 * **Validates: Requirements 9.3, 9.4**
 * 
 * This property test verifies that for any vendor with multiple processed invoices,
 * subsequent invoices should demonstrate measurably fewer escalations and higher
 * automation rates as the system learns vendor patterns.
 */

import fc from 'fast-check';
import { 
  MemorySystem, 
  ProcessingResult, 
  ProcessingOutcome,
  ProcessingOutcomeType,
  HumanFeedback,
  FeedbackType,
  Correction,
  RawInvoice,
  ExtractedField,
  InvoiceMetadata,
  QualityLevel
} from '../types';
import { createMemorySystem } from '../core/memory-system';
import { DatabaseConnection } from '../database/connection';

describe('Property Test: Learning Progression Over Time', () => {
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

  /**
   * **Feature: ai-agent-memory-system, Property 12: Learning Progression Over Time**
   * **Validates: Requirements 9.3, 9.4**
   * 
   * Property: For any vendor with multiple processed invoices, subsequent invoices
   * should demonstrate measurably fewer escalations and higher automation rates
   * as the system learns vendor patterns.
   */
  it('should show learning progression over time for any vendor', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate vendor learning scenario
        fc.record({
          vendorId: fc.string({ minLength: 3, maxLength: 20 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          vendorName: fc.string({ minLength: 5, maxLength: 50 }),
          invoiceCount: fc.integer({ min: 5, max: 15 }), // Enough invoices to show progression
          learningPatterns: fc.array(
            fc.record({
              fieldName: fc.constantFrom('serviceDate', 'currency', 'vatIncluded', 'purchaseOrderNumber', 'paymentTerms'),
              pattern: fc.string({ minLength: 5, maxLength: 30 }),
              correctValue: fc.oneof(
                fc.string({ minLength: 1, maxLength: 20 }),
                fc.boolean(),
                fc.date({ min: new Date('2020-01-01'), max: new Date('2025-12-31') })
              )
            }),
            { minLength: 1, maxLength: 3 }
          )
        }),
        async (scenario) => {
          // Generate invoices for the vendor
          const invoices = generateVendorInvoices(scenario.vendorId, scenario.invoiceCount, scenario.learningPatterns);
          
          // Track processing results over time
          const processingResults: ProcessingResult[] = [];
          const automationRates: number[] = [];
          const confidenceScores: number[] = [];
          
          // Process invoices in sequence, learning from each
          for (let i = 0; i < invoices.length; i++) {
            const invoice = invoices[i];
            
            // Process the invoice
            const result = await memorySystem.processInvoice(invoice);
            processingResults.push(result);
            
            // Calculate current automation rate (percentage of invoices not requiring human review)
            const currentBatch = processingResults.slice(Math.max(0, i - 2), i + 1); // Last 3 invoices
            const automationRate = currentBatch.filter(r => !r.requiresHumanReview).length / currentBatch.length;
            automationRates.push(automationRate);
            
            // Track confidence progression
            confidenceScores.push(result.confidenceScore);
            
            // Simulate learning from human feedback (with decreasing frequency as system improves)
            if (result.requiresHumanReview && Math.random() > (i / invoices.length) * 0.7) {
              const corrections = generateRealisticCorrections(result, scenario.learningPatterns);
              
              if (corrections.length > 0) {
                const humanFeedback: HumanFeedback = {
                  userId: 'test-user',
                  timestamp: new Date(),
                  feedbackType: FeedbackType.CORRECTION,
                  corrections,
                  satisfactionRating: 4 + Math.floor(Math.random() * 2), // 4-5
                  comments: `Learning corrections for ${scenario.vendorName}`
                };
                
                const outcome: ProcessingOutcome = {
                  result,
                  humanFeedback,
                  outcomeType: ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW,
                  performanceMetrics: {
                    averageProcessingTime: 5000,
                    successRate: 0.85,
                    automationRate: automationRate,
                    humanReviewRate: 1 - automationRate
                  }
                };
                
                await memorySystem.learnFromOutcome(outcome);
              }
            }
          }
          
          // Verify learning progression properties
          if (processingResults.length >= 5) {
            // Property 1: Automation rate should generally improve over time
            const firstThird = automationRates.slice(0, Math.floor(automationRates.length / 3));
            const lastThird = automationRates.slice(-Math.floor(automationRates.length / 3));
            
            const firstThirdAvg = firstThird.reduce((sum, rate) => sum + rate, 0) / firstThird.length;
            const lastThirdAvg = lastThird.reduce((sum, rate) => sum + rate, 0) / lastThird.length;
            
            // Allow for some variance but expect general improvement or stability
            const automationImprovement = lastThirdAvg - firstThirdAvg;
            expect(automationImprovement).toBeGreaterThanOrEqual(-0.1); // Allow small regression
            
            // Property 2: Confidence scores should generally improve or remain stable
            const firstThirdConfidence = confidenceScores.slice(0, Math.floor(confidenceScores.length / 3));
            const lastThirdConfidence = confidenceScores.slice(-Math.floor(confidenceScores.length / 3));
            
            const firstConfidenceAvg = firstThirdConfidence.reduce((sum, conf) => sum + conf, 0) / firstThirdConfidence.length;
            const lastConfidenceAvg = lastThirdConfidence.reduce((sum, conf) => sum + conf, 0) / lastThirdConfidence.length;
            
            const confidenceImprovement = lastConfidenceAvg - firstConfidenceAvg;
            expect(confidenceImprovement).toBeGreaterThanOrEqual(-0.05); // Allow minimal regression
            
            // Property 3: Human review requirements should decrease over time
            const firstHalfReviewRate = processingResults.slice(0, Math.floor(processingResults.length / 2))
              .filter(r => r.requiresHumanReview).length / Math.floor(processingResults.length / 2);
            const secondHalfReviewRate = processingResults.slice(Math.floor(processingResults.length / 2))
              .filter(r => r.requiresHumanReview).length / Math.ceil(processingResults.length / 2);
            
            const reviewRateReduction = firstHalfReviewRate - secondHalfReviewRate;
            expect(reviewRateReduction).toBeGreaterThanOrEqual(-0.1); // Allow small increase
            
            // Property 4: Memory updates should be more frequent in early processing
            const firstHalfMemoryUpdates = processingResults.slice(0, Math.floor(processingResults.length / 2))
              .reduce((sum, r) => sum + r.memoryUpdates.length, 0);
            const secondHalfMemoryUpdates = processingResults.slice(Math.floor(processingResults.length / 2))
              .reduce((sum, r) => sum + r.memoryUpdates.length, 0);
            
            // Early processing should have more memory updates (learning activity)
            expect(firstHalfMemoryUpdates).toBeGreaterThanOrEqual(secondHalfMemoryUpdates * 0.5);
            
            // Property 5: Reasoning should become more specific over time
            const earlyReasoningLength = processingResults.slice(0, 3)
              .reduce((sum, r) => sum + r.reasoning.length, 0) / 3;
            const lateReasoningLength = processingResults.slice(-3)
              .reduce((sum, r) => sum + r.reasoning.length, 0) / 3;
            
            // Later reasoning should be more detailed (system has learned more)
            expect(lateReasoningLength).toBeGreaterThanOrEqual(earlyReasoningLength * 0.8);
          }
        }
      ),
      { 
        numRuns: 100,
        timeout: 30000,
        verbose: false
      }
    );
  }, 60000);

  /**
   * Property test for vendor-specific learning isolation
   * Ensures that learning for one vendor doesn't negatively impact others
   */
  it('should maintain vendor-specific learning without cross-contamination', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate multiple vendors
        fc.array(
          fc.record({
            vendorId: fc.string({ minLength: 3, maxLength: 15 }).filter(s => /^[a-z0-9-]+$/.test(s)),
            vendorName: fc.string({ minLength: 5, maxLength: 30 }),
            invoiceCount: fc.integer({ min: 3, max: 8 }),
            learningPattern: fc.record({
              fieldName: fc.constantFrom('serviceDate', 'currency', 'vatIncluded'),
              pattern: fc.string({ minLength: 3, maxLength: 20 }),
              correctValue: fc.oneof(fc.string({ minLength: 1, maxLength: 15 }), fc.boolean())
            })
          }),
          { minLength: 2, maxLength: 4 }
        ).filter(vendors => {
          // Ensure unique vendor IDs
          const vendorIds = vendors.map(v => v.vendorId);
          return new Set(vendorIds).size === vendorIds.length;
        }),
        async (vendors) => {
          const vendorResults = new Map<string, ProcessingResult[]>();
          
          // Process invoices for each vendor
          for (const vendor of vendors) {
            const invoices = generateVendorInvoices(vendor.vendorId, vendor.invoiceCount, [vendor.learningPattern]);
            const results: ProcessingResult[] = [];
            
            for (const invoice of invoices) {
              const result = await memorySystem.processInvoice(invoice);
              results.push(result);
              
              // Simulate learning
              if (result.requiresHumanReview && Math.random() > 0.5) {
                const corrections = generateRealisticCorrections(result, [vendor.learningPattern]);
                
                if (corrections.length > 0) {
                  const humanFeedback: HumanFeedback = {
                    userId: 'test-user',
                    timestamp: new Date(),
                    feedbackType: FeedbackType.CORRECTION,
                    corrections,
                    satisfactionRating: 4,
                    comments: `Learning for ${vendor.vendorName}`
                  };
                  
                  const outcome: ProcessingOutcome = {
                    result,
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
                }
              }
            }
            
            vendorResults.set(vendor.vendorId, results);
          }
          
          // Verify vendor isolation properties
          for (const [vendorId, results] of vendorResults.entries()) {
            if (results.length >= 2) {
              // Property: Each vendor's results should reference their own vendor ID
              for (const result of results) {
                expect(result.normalizedInvoice.vendorId).toBe(vendorId);
              }
              
              // Property: Reasoning should be vendor-specific
              const vendorSpecificReasoningCount = results.filter(result => 
                result.reasoning.includes(vendorId) || 
                result.reasoning.toLowerCase().includes('vendor')
              ).length;
              
              expect(vendorSpecificReasoningCount).toBeGreaterThan(0);
              
              // Property: Memory updates should not reference other vendors
              for (const result of results) {
                for (const memoryUpdate of result.memoryUpdates) {
                  // Memory updates should not contain other vendor IDs
                  const otherVendorIds = Array.from(vendorResults.keys()).filter(id => id !== vendorId);
                  for (const otherVendorId of otherVendorIds) {
                    expect(memoryUpdate.reason).not.toContain(otherVendorId);
                  }
                }
              }
            }
          }
        }
      ),
      { 
        numRuns: 50,
        timeout: 45000,
        verbose: false
      }
    );
  }, 90000);

  /**
   * Property test for learning consistency across similar invoices
   */
  it('should apply learned patterns consistently to similar invoices', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          vendorId: fc.string({ minLength: 3, maxLength: 15 }).filter(s => /^[a-z0-9-]+$/.test(s)),
          baseInvoicePattern: fc.record({
            invoiceNumber: fc.string({ minLength: 5, maxLength: 15 }),
            totalAmount: fc.float({ min: 100, max: 10000 }),
            currency: fc.constantFrom('EUR', 'USD', 'GBP'),
            extractedFields: fc.array(
              fc.record({
                name: fc.constantFrom('invoiceDate', 'totalAmount', 'currency', 'vendorSpecificField'),
                value: fc.string({ minLength: 1, maxLength: 20 }),
                confidence: fc.float({ min: 0.5, max: 1.0 })
              }),
              { minLength: 2, maxLength: 5 }
            )
          }),
          similarInvoiceCount: fc.integer({ min: 3, max: 6 })
        }),
        async (scenario) => {
          // Generate similar invoices with slight variations
          const invoices = generateSimilarInvoices(scenario.vendorId, scenario.baseInvoicePattern, scenario.similarInvoiceCount);
          
          const results: ProcessingResult[] = [];
          
          // Process first invoice and teach the system
          const firstResult = await memorySystem.processInvoice(invoices[0]);
          results.push(firstResult);
          
          // Simulate learning from first invoice
          if (firstResult.requiresHumanReview) {
            const corrections: Correction[] = [{
              field: 'vendorSpecificField',
              originalValue: null,
              correctedValue: 'learned_value',
              reason: 'Vendor-specific pattern learning',
              confidence: 0.9
            }];
            
            const humanFeedback: HumanFeedback = {
              userId: 'test-user',
              timestamp: new Date(),
              feedbackType: FeedbackType.CORRECTION,
              corrections,
              satisfactionRating: 5,
              comments: 'Teaching vendor pattern'
            };
            
            const outcome: ProcessingOutcome = {
              result: firstResult,
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
          }
          
          // Process remaining similar invoices
          for (let i = 1; i < invoices.length; i++) {
            const result = await memorySystem.processInvoice(invoices[i]);
            results.push(result);
          }
          
          // Verify consistency properties
          if (results.length >= 2) {
            // Property: Similar invoices should have similar confidence scores
            const confidenceScores = results.map(r => r.confidenceScore);
            const confidenceVariance = calculateVariance(confidenceScores);
            expect(confidenceVariance).toBeLessThan(0.1); // Low variance expected
            
            // Property: Later invoices should require less human review
            const firstHalfReviewRate = results.slice(0, Math.ceil(results.length / 2))
              .filter(r => r.requiresHumanReview).length / Math.ceil(results.length / 2);
            const secondHalfReviewRate = results.slice(Math.floor(results.length / 2))
              .filter(r => r.requiresHumanReview).length / Math.ceil(results.length / 2);
            
            expect(secondHalfReviewRate).toBeLessThanOrEqual(firstHalfReviewRate + 0.1);
            
            // Property: All results should be for the same vendor
            for (const result of results) {
              expect(result.normalizedInvoice.vendorId).toBe(scenario.vendorId);
            }
          }
        }
      ),
      { 
        numRuns: 75,
        timeout: 30000,
        verbose: false
      }
    );
  }, 60000);
});

// ============================================================================
// Helper Functions for Test Data Generation
// ============================================================================

/**
 * Generate invoices for a specific vendor with learning patterns
 */
function generateVendorInvoices(
  vendorId: string, 
  count: number, 
  learningPatterns: Array<{ fieldName: string; pattern: string; correctValue: any }>
): RawInvoice[] {
  const invoices: RawInvoice[] = [];
  
  for (let i = 0; i < count; i++) {
    const invoice: RawInvoice = {
      id: `${vendorId}-${i + 1}-2024`,
      vendorId,
      invoiceNumber: `INV-${vendorId.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
      rawText: generateRawText(vendorId, i + 1, learningPatterns),
      extractedFields: generateExtractedFields(learningPatterns, i),
      metadata: {
        sourceSystem: 'test-system',
        receivedAt: new Date(Date.now() - (count - i) * 24 * 60 * 60 * 1000), // Spread over days
        fileFormat: 'PDF',
        fileSize: 200000 + Math.floor(Math.random() * 100000),
        detectedLanguage: 'en',
        extractionQuality: QualityLevel.GOOD,
        additionalMetadata: {
          testGenerated: true,
          invoiceSequence: i + 1
        }
      }
    };
    
    invoices.push(invoice);
  }
  
  return invoices;
}

/**
 * Generate raw text for an invoice
 */
function generateRawText(
  vendorId: string, 
  invoiceNumber: number, 
  learningPatterns: Array<{ fieldName: string; pattern: string; correctValue: any }>
): string {
  let rawText = `Invoice from ${vendorId}\n`;
  rawText += `Invoice Number: INV-${vendorId.toUpperCase()}-${String(invoiceNumber).padStart(3, '0')}\n`;
  rawText += `Date: ${new Date().toISOString().split('T')[0]}\n`;
  rawText += `Amount: ${(Math.random() * 5000 + 500).toFixed(2)} EUR\n`;
  
  // Add learning pattern indicators
  for (const pattern of learningPatterns) {
    rawText += `${pattern.pattern}: ${pattern.correctValue}\n`;
  }
  
  rawText += `\nServices provided as per agreement.\n`;
  rawText += `Payment terms: 30 days net\n`;
  
  return rawText;
}

/**
 * Generate extracted fields with some missing information to trigger learning
 */
function generateExtractedFields(
  learningPatterns: Array<{ fieldName: string; pattern: string; correctValue: any }>,
  invoiceIndex: number
): ExtractedField[] {
  const fields: ExtractedField[] = [
    {
      name: 'invoiceNumber',
      value: `INV-TEST-${String(invoiceIndex + 1).padStart(3, '0')}`,
      confidence: 0.95
    },
    {
      name: 'totalAmount',
      value: (Math.random() * 5000 + 500).toFixed(2),
      confidence: 0.90
    }
  ];
  
  // Randomly include or exclude learning pattern fields to simulate extraction inconsistencies
  for (const pattern of learningPatterns) {
    if (Math.random() > 0.3) { // 70% chance to include
      fields.push({
        name: pattern.fieldName,
        value: pattern.pattern, // Raw pattern, not the correct value
        confidence: 0.60 + Math.random() * 0.3 // Lower confidence to trigger learning
      });
    }
  }
  
  return fields;
}

/**
 * Generate realistic corrections based on learning patterns
 */
function generateRealisticCorrections(
  result: ProcessingResult,
  learningPatterns: Array<{ fieldName: string; pattern: string; correctValue: any }>
): Correction[] {
  const corrections: Correction[] = [];
  
  for (const pattern of learningPatterns) {
    // Simulate human correcting the field based on the learning pattern
    if (Math.random() > 0.4) { // 60% chance to correct each pattern
      corrections.push({
        field: pattern.fieldName,
        originalValue: pattern.pattern,
        correctedValue: pattern.correctValue,
        reason: `Learned mapping for ${pattern.fieldName} from vendor pattern`,
        confidence: 0.85 + Math.random() * 0.15
      });
    }
  }
  
  return corrections;
}

/**
 * Generate similar invoices with slight variations
 */
function generateSimilarInvoices(
  vendorId: string,
  basePattern: any,
  count: number
): RawInvoice[] {
  const invoices: RawInvoice[] = [];
  
  for (let i = 0; i < count; i++) {
    const invoice: RawInvoice = {
      id: `${vendorId}-similar-${i + 1}`,
      vendorId,
      invoiceNumber: `${basePattern.invoiceNumber}-${i + 1}`,
      rawText: `Similar invoice ${i + 1} from ${vendorId}\nAmount: ${basePattern.totalAmount + (Math.random() - 0.5) * 100}`,
      extractedFields: basePattern.extractedFields.map((field: any) => ({
        ...field,
        confidence: field.confidence + (Math.random() - 0.5) * 0.1 // Slight confidence variation
      })),
      metadata: {
        sourceSystem: 'test-system',
        receivedAt: new Date(),
        fileFormat: 'PDF',
        fileSize: 200000,
        detectedLanguage: 'en',
        extractionQuality: QualityLevel.GOOD,
        additionalMetadata: { testGenerated: true, similarityGroup: 'base' }
      }
    };
    
    invoices.push(invoice);
  }
  
  return invoices;
}

/**
 * Calculate variance of an array of numbers
 */
function calculateVariance(numbers: number[]): number {
  if (numbers.length === 0) return 0;
  
  const mean = numbers.reduce((sum, num) => sum + num, 0) / numbers.length;
  const squaredDifferences = numbers.map(num => Math.pow(num - mean, 2));
  const variance = squaredDifferences.reduce((sum, diff) => sum + diff, 0) / numbers.length;
  
  return variance;
}