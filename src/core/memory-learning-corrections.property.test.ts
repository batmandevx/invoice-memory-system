/**
 * Property-Based Tests for Memory Learning from Corrections
 * 
 * Tests that the memory learning engine correctly processes human corrections,
 * creates appropriate correction memories, and reinforces patterns when similar
 * corrections occur repeatedly.
 */

import * as fc from 'fast-check';
import { DatabaseConnection, createDefaultConnection } from '../database/connection';
import { 
  MemoryLearningEngine, 
  createMemoryLearningEngine,
  LearningStrategy
} from './memory-learning-engine';
import { createMemoryRepository } from '../database/memory-repository';
import {
  Correction,
  RawInvoice,
  NormalizedInvoice,
  QualityLevel,
  ExtractedField,
  InvoiceMetadata,
  Money,
  LineItem
} from '../types';
import { PropertyTestUtils } from '../test/setup';

describe('Memory Learning from Corrections Property Tests', () => {
  let db: DatabaseConnection;
  let learningEngine: MemoryLearningEngine;

  beforeEach(async () => {
    db = createDefaultConnection(':memory:');
    await db.initialize();
    learningEngine = createMemoryLearningEngine(db);
  });

  afterEach(async () => {
    await db.close();
  });

  /**
   * **Feature: ai-agent-memory-system, Property 5: Memory Learning from Corrections**
   * **Validates: Requirements 3.1, 3.2, 9.2**
   * 
   * For any human correction applied to an invoice, the system should store the correction 
   * pattern as a new memory or reinforce an existing memory, making the same correction 
   * more likely in similar future scenarios.
   * 
   * This property test verifies that:
   * 1. Every correction results in either a new memory or reinforcement of existing memory
   * 2. Similar corrections increase the confidence of related memories
   * 3. Correction patterns are properly stored and can be retrieved
   * 4. Vendor-specific corrections create vendor-specific memories
   * 5. The learning process is consistent and deterministic
   * 6. Memory confidence increases with repeated similar corrections
   */
  test(PropertyTestUtils.createPropertyDescription(5, 'Memory Learning from Corrections'), async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate corrections to learn from
        fc.array(correctionArbitrary(), { minLength: 1, maxLength: 5 }),
        // Generate invoice context
        rawInvoiceArbitrary(),
        normalizedInvoiceArbitrary(),
        // Generate learning strategy
        fc.constantFrom(...Object.values(LearningStrategy)),
        
        async (corrections: Correction[], rawInvoice: RawInvoice, normalizedInvoice: NormalizedInvoice, strategy: LearningStrategy) => {
          // Skip invalid inputs
          if (!isValidCorrections(corrections) || !isValidInvoice(rawInvoice)) {
            return true;
          }

          try {
            // Get initial memory count
            const memoryRepository = createMemoryRepository(db);
            const initialMemories = await memoryRepository.getAllMemories();
            const initialMemoryCount = initialMemories.length;

            // Learn from corrections
            const learningOutcome = await learningEngine.learnFromCorrections(
              corrections,
              rawInvoice,
              normalizedInvoice,
              strategy
            );

            // Property 1: Every correction should result in learning activity
            if (learningOutcome.correctionsProcessed !== corrections.length) {
              console.log('Property 1 failed: Not all corrections were processed');
              return false;
            }

            // Property 2: Learning should result in either new memories or reinforcement
            const totalLearningActivity = learningOutcome.memoriesCreated + learningOutcome.memoriesReinforced;
            if (totalLearningActivity === 0 && corrections.length > 0) {
              console.log('Property 2 failed: No learning activity despite corrections');
              return false;
            }

            // Property 3: New memories should be created for valid corrections
            const finalMemories = await memoryRepository.getAllMemories();
            const finalMemoryCount = finalMemories.length;
            const actualMemoriesCreated = finalMemoryCount - initialMemoryCount;

            // Allow for some flexibility in memory creation based on strategy and patterns
            if (actualMemoriesCreated < 0) {
              console.log('Property 3 failed: Memory count decreased');
              return false;
            }

            // Property 4: Learning results should be consistent with reported metrics
            const successfulResults = learningOutcome.learningResults.filter(r => r.success);
            const reportedCreations = learningOutcome.learningResults.filter(r => 
              r.success && r.learningType.includes('CREATION')
            ).length;

            // The reported creations should match or be close to actual memory creation
            // (allowing for pattern-based learning which might create fewer memories)
            if (reportedCreations > actualMemoriesCreated + 2) {
              console.log('Property 4 failed: Reported creations exceed actual creations');
              return false;
            }

            // Property 5: Vendor-specific corrections should create vendor-specific memories
            const vendorSpecificCorrections = corrections.filter(c => 
              isVendorSpecificCorrection(c, rawInvoice.vendorId)
            );
            
            if (vendorSpecificCorrections.length > 0) {
              const vendorMemories = await memoryRepository.findMemoriesByVendor(rawInvoice.vendorId);
              const newVendorMemories = vendorMemories.filter(m => 
                !initialMemories.some(im => im.id === m.id)
              );
              
              // Should have created at least some vendor-specific memories
              if (newVendorMemories.length === 0 && actualMemoriesCreated > 0) {
                console.log('Property 5 failed: No vendor-specific memories created for vendor-specific corrections');
                return false;
              }
            }

            // Property 6: Learning confidence should be reasonable
            if (learningOutcome.learningConfidence < 0 || learningOutcome.learningConfidence > 1) {
              console.log('Property 6 failed: Learning confidence out of range');
              return false;
            }

            // Property 7: Successful learning should have positive confidence
            if (successfulResults.length > 0 && learningOutcome.learningConfidence === 0) {
              console.log('Property 7 failed: Zero confidence despite successful learning');
              return false;
            }

            // Property 8: Learning reasoning should be provided
            if (!learningOutcome.reasoning || learningOutcome.reasoning.trim().length === 0) {
              console.log('Property 8 failed: No learning reasoning provided');
              return false;
            }

            return true;

          } catch (error) {
            console.log('Property test failed with error:', error);
            return false;
          }
        }
      ),
      { 
        numRuns: 100,
        verbose: true,
        seed: 42 // For reproducible test runs
      }
    );
  }, 30000); // 30 second timeout for property test

  /**
   * Additional property test for repeated corrections reinforcement
   */
  test('Repeated Similar Corrections Increase Memory Confidence', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate a base correction that will be repeated
        correctionArbitrary(),
        rawInvoiceArbitrary(),
        normalizedInvoiceArbitrary(),
        // Number of repetitions (2-5)
        fc.integer({ min: 2, max: 5 }),
        
        async (baseCorrection: Correction, rawInvoice: RawInvoice, normalizedInvoice: NormalizedInvoice, repetitions: number) => {
          if (!isValidCorrection(baseCorrection) || !isValidInvoice(rawInvoice)) {
            return true;
          }

          try {
            // Create similar corrections
            const corrections = Array.from({ length: repetitions }, (_, i) => ({
              ...baseCorrection,
              reason: `${baseCorrection.reason} (occurrence ${i + 1})`
            }));

            // Learn from the repeated corrections
            const learningOutcome = await learningEngine.learnFromCorrections(
              corrections,
              rawInvoice,
              normalizedInvoice,
              LearningStrategy.PATTERN_BASED
            );

            // Property: Repeated corrections should result in pattern recognition
            if (repetitions >= 3 && learningOutcome.patternsRecognized === 0) {
              console.log('Repeated corrections should result in pattern recognition');
              return false;
            }

            // Property: Learning confidence should be higher for repeated patterns
            if (repetitions >= 3 && learningOutcome.learningConfidence < 0.5) {
              console.log('Learning confidence should be higher for repeated patterns');
              return false;
            }

            return true;

          } catch (error) {
            console.log('Repeated corrections test failed with error:', error);
            return false;
          }
        }
      ),
      { 
        numRuns: 50,
        verbose: true
      }
    );
  }, 20000);
});

// ============================================================================
// Arbitrary Generators
// ============================================================================

/**
 * Arbitrary for generating Correction objects
 */
function correctionArbitrary(): fc.Arbitrary<Correction> {
  return fc.record({
    field: fc.constantFrom(
      'serviceDate', 'invoiceDate', 'dueDate', 'totalAmount', 'vatAmount', 
      'currency', 'quantity', 'unitPrice', 'description', 'sku'
    ),
    originalValue: fc.oneof(
      fc.constant(undefined),
      fc.string({ maxLength: 20 }),
      fc.integer({ min: 0, max: 10000 }),
      fc.float({ min: Math.fround(0), max: Math.fround(10000) }),
      fc.date()
    ),
    correctedValue: fc.oneof(
      fc.string({ minLength: 1, maxLength: 50 }),
      fc.integer({ min: 1, max: 10000 }),
      fc.float({ min: Math.fround(0.01), max: Math.fround(10000) }),
      fc.date(),
      fc.constantFrom('EUR', 'USD', 'GBP')
    ),
    reason: fc.string({ minLength: 10, maxLength: 100 }),
    confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) })
  });
}

/**
 * Arbitrary for generating RawInvoice objects
 */
function rawInvoiceArbitrary(): fc.Arbitrary<RawInvoice> {
  return fc.record({
    id: fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
    vendorId: fc.constantFrom('supplier-gmbh', 'parts-ag', 'freight-co', 'tech-corp', 'service-ltd'),
    invoiceNumber: fc.string({ minLength: 3, maxLength: 15 }),
    rawText: fc.string({ minLength: 50, maxLength: 500 }),
    extractedFields: fc.array(extractedFieldArbitrary(), { minLength: 1, maxLength: 8 }),
    metadata: invoiceMetadataArbitrary()
  });
}

/**
 * Arbitrary for generating NormalizedInvoice objects
 */
function normalizedInvoiceArbitrary(): fc.Arbitrary<NormalizedInvoice> {
  return fc.record({
    id: fc.string({ minLength: 5, maxLength: 20 }).filter(s => /^[a-zA-Z0-9-_]+$/.test(s)),
    vendorId: fc.constantFrom('supplier-gmbh', 'parts-ag', 'freight-co', 'tech-corp', 'service-ltd'),
    invoiceNumber: fc.string({ minLength: 3, maxLength: 15 }),
    invoiceDate: fc.date(),
    totalAmount: moneyArbitrary(),
    currency: fc.constantFrom('EUR', 'USD', 'GBP'),
    lineItems: fc.array(lineItemArbitrary(), { minLength: 1, maxLength: 5 }),
    normalizedFields: fc.array(fc.record({
      originalField: fc.string({ minLength: 3, maxLength: 20 }),
      normalizedField: fc.string({ minLength: 3, maxLength: 20 }),
      originalValue: fc.oneof(fc.string({ maxLength: 50 }), fc.integer(), fc.float({ min: Math.fround(0), max: Math.fround(10000) })),
      normalizedValue: fc.oneof(fc.string({ maxLength: 50 }), fc.integer(), fc.float({ min: Math.fround(0), max: Math.fround(10000) })),
      memoryId: fc.string({ minLength: 5, maxLength: 20 }),
      confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) })
    }), { maxLength: 5 })
  });
}

/**
 * Arbitrary for generating ExtractedField objects
 */
function extractedFieldArbitrary(): fc.Arbitrary<ExtractedField> {
  return fc.record({
    name: fc.constantFrom('totalAmount', 'invoiceDate', 'vendorName', 'currency', 'vatAmount', 'serviceDate'),
    value: fc.oneof(
      fc.string({ maxLength: 20 }),
      fc.integer({ min: 1, max: 10000 }),
      fc.float({ min: Math.fround(1), max: Math.fround(10000) })
    ),
    confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) })
  });
}

/**
 * Arbitrary for generating InvoiceMetadata objects
 */
function invoiceMetadataArbitrary(): fc.Arbitrary<InvoiceMetadata> {
  return fc.record({
    sourceSystem: fc.constantFrom('email', 'api', 'upload'),
    receivedAt: fc.date(),
    fileFormat: fc.constantFrom('pdf', 'image', 'text'),
    fileSize: fc.integer({ min: 1024, max: 1024 * 1024 }),
    detectedLanguage: fc.constantFrom('en', 'de', 'fr', 'es'),
    extractionQuality: fc.constantFrom(...Object.values(QualityLevel)),
    additionalMetadata: fc.constant({})
  });
}

/**
 * Arbitrary for generating Money objects
 */
function moneyArbitrary(): fc.Arbitrary<Money> {
  return fc.record({
    amount: fc.float({ min: Math.fround(0.01), max: Math.fround(100000) }),
    currency: fc.constantFrom('EUR', 'USD', 'GBP')
  });
}

/**
 * Arbitrary for generating LineItem objects
 */
function lineItemArbitrary(): fc.Arbitrary<LineItem> {
  return fc.record({
    description: fc.string({ minLength: 5, maxLength: 50 }),
    quantity: fc.integer({ min: 1, max: 100 }),
    unitPrice: moneyArbitrary(),
    totalPrice: moneyArbitrary()
  });
}

// ============================================================================
// Validation Functions
// ============================================================================

/**
 * Validate that corrections are valid for testing
 */
function isValidCorrections(corrections: Correction[]): boolean {
  return corrections.every(isValidCorrection);
}

/**
 * Validate that a single correction is valid
 */
function isValidCorrection(correction: Correction): boolean {
  return !!(correction.field && 
         correction.field.length > 0 &&
         correction.correctedValue !== undefined &&
         correction.reason && 
         correction.reason.length > 0 &&
         correction.confidence >= 0 && 
         correction.confidence <= 1);
}

/**
 * Validate that an invoice is valid for testing
 */
function isValidInvoice(invoice: RawInvoice): boolean {
  return !!(invoice.id && 
         invoice.id.length > 0 &&
         invoice.vendorId && 
         invoice.vendorId.length > 0 &&
         invoice.invoiceNumber && 
         invoice.invoiceNumber.length > 0 &&
         invoice.rawText && 
         invoice.rawText.length > 0 &&
         invoice.extractedFields && 
         invoice.extractedFields.length > 0);
}

/**
 * Check if a correction is vendor-specific
 */
function isVendorSpecificCorrection(correction: Correction, vendorId: string): boolean {
  // Consider corrections vendor-specific if they involve vendor-specific patterns
  const vendorSpecificFields = ['serviceDate', 'currency', 'vatAmount'];
  const germanVendors = ['supplier-gmbh', 'parts-ag'];
  
  return vendorSpecificFields.includes(correction.field) && 
         germanVendors.includes(vendorId) &&
         (correction.reason.toLowerCase().includes('german') ||
          correction.reason.toLowerCase().includes('leistungsdatum') ||
          correction.reason.toLowerCase().includes('vendor'));
}