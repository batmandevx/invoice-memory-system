/**
 * Property-Based Tests for Vendor Memory Isolation
 * 
 * **Feature: ai-agent-memory-system, Property 2: Vendor Memory Isolation**
 * **Validates: Requirements 2.5**
 * 
 * Property: For any set of vendors and their associated memories, memories from 
 * different vendors should never interfere with each other, and querying memories 
 * for a specific vendor should only return memories associated with that vendor.
 */

import * as fc from 'fast-check';
import {
  VendorPatternRecognitionEngineImpl,
  VendorPatternConfig
} from './vendor-pattern-recognition';
import { MemoryRepository } from '../database/memory-repository';
import { MemoryFactory } from './memory-base';
import {
  Memory,
  MemoryType,
  VendorMemory,
  MemoryPattern,
  PatternType,
  MemoryContext,
  ComplexityLevel,
  QualityLevel,
  VATBehavior
} from '../types';

// Mock repository for property testing
class PropertyTestMemoryRepository implements MemoryRepository {
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

describe('Vendor Memory Isolation Property Tests', () => {
  let repository: PropertyTestMemoryRepository;
  let engine: VendorPatternRecognitionEngineImpl;

  beforeEach(() => {
    repository = new PropertyTestMemoryRepository();
    const config: VendorPatternConfig = {
      minPatternConfidence: 0.6,
      minExamplesForPattern: 2,
      maxExampleAgeDays: 90,
      enableVATDetection: true,
      enableCurrencyLearning: true,
      enableDateFormatLearning: true,
      vendorSpecificBoost: 0.2
    };
    engine = new VendorPatternRecognitionEngineImpl(repository, config);
  });

  afterEach(() => {
    engine.clearAuditSteps();
  });

  /**
   * **Feature: ai-agent-memory-system, Property 2: Vendor Memory Isolation**
   * **Validates: Requirements 2.5**
   */
  it('**Feature: ai-agent-memory-system, Property 2: Vendor Memory Isolation**', async () => {
    await fc.assert(
      fc.asyncProperty(
        // Generate test data: multiple vendors with their memories
        fc.record({
          vendors: fc.array(
            fc.record({
              vendorId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0),
              memories: fc.array(
                fc.record({
                  memoryId: fc.string({ minLength: 1, maxLength: 30 }),
                  confidence: fc.float({ min: Math.fround(0.1), max: Math.fround(1.0) })
                }),
                { minLength: 1, maxLength: 5 }
              )
            }),
            { minLength: 2, maxLength: 10 }
          ).filter(vendors => {
            // Ensure all vendor IDs are unique
            const vendorIds = vendors.map(v => v.vendorId);
            return new Set(vendorIds).size === vendorIds.length;
          }),
          queryVendorId: fc.string({ minLength: 1, maxLength: 20 }).filter(s => s.trim().length > 0)
        }),
        async (testData) => {
          // Clear repository for each test
          repository.clear();
          engine.clearAuditSteps();

          // Create and store memories for each vendor
          const allMemories: Array<{ memory: VendorMemory; vendorId: string }> = [];
          
          for (const vendor of testData.vendors) {
            for (const memoryData of vendor.memories) {
              const memory = createTestVendorMemory(
                vendor.vendorId,
                `${vendor.vendorId}-${memoryData.memoryId}`,
                memoryData.confidence
              );
              
              repository.addMemory(memory);
              allMemories.push({ memory, vendorId: vendor.vendorId });
            }
          }

          // Test isolation for each vendor
          for (const vendor of testData.vendors) {
            const isolatedMemories = await engine.isolateVendorMemories(vendor.vendorId);
            
            // Property 1: All returned memories should belong to the queried vendor
            const allBelongToVendor = isolatedMemories.every(memory => 
              memory.vendorId === vendor.vendorId
            );
            
            if (!allBelongToVendor) {
              console.log('Failed vendor isolation test:');
              console.log('Queried vendor:', vendor.vendorId);
              console.log('Returned memories:', isolatedMemories.map(m => ({ id: m.id, vendorId: m.vendorId })));
              return false;
            }

            // Property 2: Should return all memories for this vendor
            const expectedCount = vendor.memories.length;
            const actualCount = isolatedMemories.length;
            
            if (actualCount !== expectedCount) {
              console.log('Memory count mismatch:');
              console.log('Vendor:', vendor.vendorId);
              console.log('Expected:', expectedCount);
              console.log('Actual:', actualCount);
              return false;
            }

            // Property 3: Should not return memories from other vendors
            const otherVendorMemories = allMemories.filter(m => m.vendorId !== vendor.vendorId);
            const hasOtherVendorMemories = isolatedMemories.some(isolatedMemory =>
              otherVendorMemories.some(otherMemory => 
                otherMemory.memory.id === isolatedMemory.id
              )
            );
            
            if (hasOtherVendorMemories) {
              console.log('Cross-vendor contamination detected:');
              console.log('Queried vendor:', vendor.vendorId);
              console.log('Other vendors:', otherVendorMemories.map(m => m.vendorId));
              console.log('Contaminated memories:', isolatedMemories.filter(isolatedMemory =>
                otherVendorMemories.some(otherMemory => 
                  otherMemory.memory.id === isolatedMemory.id
                )
              ).map(m => ({ id: m.id, vendorId: m.vendorId })));
              return false;
            }
          }

          // Test isolation for non-existent vendor
          const nonExistentMemories = await engine.isolateVendorMemories(testData.queryVendorId);
          const vendorExists = testData.vendors.some(v => v.vendorId === testData.queryVendorId);
          
          if (!vendorExists) {
            // Should return empty array for non-existent vendor
            if (nonExistentMemories.length !== 0) {
              console.log('Non-existent vendor returned memories:');
              console.log('Query vendor:', testData.queryVendorId);
              console.log('Returned memories:', nonExistentMemories.length);
              return false;
            }
          }

          // Property 4: Verify no cross-vendor interference in repository
          const allStoredMemories = repository.getMemories();
          for (const storedMemory of allStoredMemories) {
            if (storedMemory.type === MemoryType.VENDOR) {
              const vendorMemory = storedMemory as VendorMemory;
              
              // Memory's vendorId should match its context vendorId
              if (vendorMemory.vendorId !== vendorMemory.context.vendorId) {
                console.log('Vendor ID mismatch in stored memory:');
                console.log('Memory ID:', vendorMemory.id);
                console.log('Memory vendorId:', vendorMemory.vendorId);
                console.log('Context vendorId:', vendorMemory.context.vendorId);
                return false;
              }
            }
          }

          return true;
        }
      ),
      {
        numRuns: 100,
        timeout: 30000,
        verbose: false
      }
    );
  });

  /**
   * Test vendor memory isolation with concurrent access
   */
  it('should maintain isolation under concurrent access', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          vendors: fc.array(
            fc.record({
              vendorId: fc.string({ minLength: 1, maxLength: 15 }).filter(s => s.trim().length > 0),
              memoryCount: fc.integer({ min: 1, max: 3 })
            }),
            { minLength: 3, maxLength: 6 }
          ).filter(vendors => {
            // Ensure all vendor IDs are unique after trimming
            const trimmedIds = vendors.map(v => v.vendorId.trim());
            return new Set(trimmedIds).size === trimmedIds.length;
          })
        }),
        async (testData) => {
          repository.clear();
          engine.clearAuditSteps();

          // Create memories for each vendor
          const memoryPromises: Promise<void>[] = [];
          
          for (const vendor of testData.vendors) {
            for (let i = 0; i < vendor.memoryCount; i++) {
              const memory = createTestVendorMemory(
                vendor.vendorId,
                `${vendor.vendorId}-memory-${i}`,
                0.8
              );
              
              memoryPromises.push(repository.saveMemory(memory));
            }
          }

          // Wait for all memories to be saved
          await Promise.all(memoryPromises);

          // Perform concurrent isolation queries
          const isolationPromises = testData.vendors.map(vendor =>
            engine.isolateVendorMemories(vendor.vendorId)
          );

          const results = await Promise.all(isolationPromises);

          // Verify each result contains only memories for the correct vendor
          for (let i = 0; i < testData.vendors.length; i++) {
            const vendor = testData.vendors[i]!;
            const isolatedMemories = results[i]!;

            // All memories should belong to the correct vendor
            const allCorrectVendor = isolatedMemories.every(memory => 
              memory.vendorId === vendor.vendorId
            );

            if (!allCorrectVendor) {
              console.log('Concurrent access isolation failure:');
              console.log('Vendor:', vendor.vendorId);
              console.log('Incorrect memories:', isolatedMemories.filter(m => m.vendorId !== vendor.vendorId));
              return false;
            }

            // Should have the expected number of memories
            if (isolatedMemories.length !== vendor.memoryCount) {
              console.log('Concurrent access count mismatch:');
              console.log('Vendor:', vendor.vendorId);
              console.log('Expected:', vendor.memoryCount);
              console.log('Actual:', isolatedMemories.length);
              return false;
            }
          }

          return true;
        }
      ),
      {
        numRuns: 50,
        timeout: 20000
      }
    );
  });

  /**
   * Test vendor memory isolation with edge cases
   */
  it('should handle edge cases in vendor isolation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.record({
          vendorIds: fc.array(
            fc.oneof(
              fc.string({ minLength: 1, maxLength: 20 }),
              fc.constant(''), // Empty string
              fc.string({ minLength: 1, maxLength: 5 }).map(s => s.trim()), // Whitespace
              fc.string({ minLength: 1, maxLength: 10 }).map(s => s.toLowerCase()), // Case variations
              fc.string({ minLength: 1, maxLength: 10 }).map(s => s.toUpperCase())
            ),
            { minLength: 1, maxLength: 8 }
          ).filter(arr => arr.length > 0)
        }),
        async (testData) => {
          repository.clear();
          engine.clearAuditSteps();

          // Filter out empty vendor IDs for memory creation
          const validVendorIds = testData.vendorIds.filter(id => id && id.trim().length > 0);
          
          if (validVendorIds.length === 0) {
            return true; // Skip if no valid vendor IDs
          }

          // Create memories for valid vendors
          for (const vendorId of validVendorIds) {
            const memory = createTestVendorMemory(vendorId, `memory-${vendorId}`, 0.7);
            repository.addMemory(memory);
          }

          // Test isolation for each vendor ID (including invalid ones)
          for (const vendorId of testData.vendorIds) {
            try {
              const isolatedMemories = await engine.isolateVendorMemories(vendorId);
              
              if (vendorId && vendorId.trim().length > 0) {
                // Valid vendor ID should return its memories
                const expectedMemories = isolatedMemories.every(memory => 
                  memory.vendorId === vendorId
                );
                
                if (!expectedMemories) {
                  console.log('Edge case isolation failure:');
                  console.log('Vendor ID:', JSON.stringify(vendorId));
                  console.log('Invalid memories:', isolatedMemories.filter(m => m.vendorId !== vendorId));
                  return false;
                }
              } else {
                // Invalid vendor ID should return empty array
                if (isolatedMemories.length > 0) {
                  console.log('Invalid vendor ID returned memories:');
                  console.log('Vendor ID:', JSON.stringify(vendorId));
                  console.log('Memories count:', isolatedMemories.length);
                  return false;
                }
              }
            } catch (error) {
              // Should not throw errors for any vendor ID
              console.log('Unexpected error in vendor isolation:');
              console.log('Vendor ID:', JSON.stringify(vendorId));
              console.log('Error:', error);
              return false;
            }
          }

          return true;
        }
      ),
      {
        numRuns: 75,
        timeout: 25000
      }
    );
  });
});

// Helper function to create test vendor memory
function createTestVendorMemory(vendorId: string, memoryId: string, confidence: number): VendorMemory {
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
    confidence,
    memoryContext,
    vendorId,
    vatBehavior,
    [],
    [],
    []
  );
}