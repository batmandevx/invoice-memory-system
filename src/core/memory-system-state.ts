/**
 * Memory System State Management
 * 
 * Provides functionality to capture, serialize, and restore the complete
 * state of the memory system for persistence and testing purposes.
 */

import { Memory, MemoryType } from '../types';
import { MemoryRepository } from '../database/memory-repository';
import { DatabaseConnection } from '../database/connection';

/**
 * Complete state of the memory system
 */
export interface MemorySystemState {
  /** All memories in the system */
  memories: Memory[];
  
  /** Timestamp when state was captured */
  capturedAt: Date;
  
  /** Version of the state format */
  version: string;
  
  /** Additional metadata */
  metadata: {
    totalMemories: number;
    memoryTypeBreakdown: Record<MemoryType, number>;
    averageConfidence: number;
  };
}

/**
 * Serializable representation of memory system state
 */
export interface SerializedMemorySystemState {
  memories: SerializedMemory[];
  capturedAt: string;
  version: string;
  metadata: {
    totalMemories: number;
    memoryTypeBreakdown: Record<MemoryType, number>;
    averageConfidence: number;
  };
}

/**
 * Serializable representation of a memory
 */
export interface SerializedMemory {
  id: string;
  type: MemoryType;
  confidence: number;
  createdAt: string;
  lastUsed: string;
  usageCount: number;
  successRate: number;
  pattern: {
    patternType: string;
    patternData: Record<string, unknown>;
    threshold: number;
  };
  context: Record<string, unknown>;
  
  // Type-specific data
  vendorData?: {
    vendorId: string;
    fieldMappings: unknown[];
    vatBehavior: unknown;
    currencyPatterns: unknown[];
    dateFormats: unknown[];
  };
  
  correctionData?: {
    correctionType: string;
    triggerConditions: unknown[];
    correctionAction: unknown;
    validationRules: unknown[];
  };
  
  resolutionData?: {
    discrepancyType: string;
    resolutionOutcome: unknown;
    humanDecision: unknown;
    contextFactors: unknown[];
  };
}

/**
 * Manager for memory system state operations
 */
export class MemorySystemStateManager {
  constructor(
    private repository: MemoryRepository,
    private db: DatabaseConnection
  ) {}

  /**
   * Capture the current state of the memory system
   */
  public async captureState(): Promise<MemorySystemState> {
    const memories = await this.repository.getAllMemories();
    const capturedAt = new Date();
    
    // Calculate metadata
    const memoryTypeBreakdown = memories.reduce((breakdown, memory) => {
      breakdown[memory.type] = (breakdown[memory.type] || 0) + 1;
      return breakdown;
    }, {} as Record<MemoryType, number>);
    
    const averageConfidence = memories.length > 0 
      ? memories.reduce((sum, memory) => sum + memory.confidence, 0) / memories.length
      : 0;

    return {
      memories,
      capturedAt,
      version: '1.0.0',
      metadata: {
        totalMemories: memories.length,
        memoryTypeBreakdown,
        averageConfidence
      }
    };
  }

  /**
   * Serialize memory system state to JSON-compatible format
   */
  public serializeState(state: MemorySystemState): SerializedMemorySystemState {
    return {
      memories: state.memories.map(memory => this.serializeMemory(memory)),
      capturedAt: state.capturedAt.toISOString(),
      version: state.version,
      metadata: state.metadata
    };
  }

  /**
   * Deserialize memory system state from JSON-compatible format
   */
  public async deserializeState(serialized: SerializedMemorySystemState): Promise<MemorySystemState> {
    const memories = await Promise.all(
      serialized.memories.map(serializedMemory => this.deserializeMemory(serializedMemory))
    );

    return {
      memories,
      capturedAt: new Date(serialized.capturedAt),
      version: serialized.version,
      metadata: serialized.metadata
    };
  }

  /**
   * Persist the current state to storage
   */
  public async persistState(): Promise<void> {
    const state = await this.captureState();
    
    // Clear existing memories
    await this.clearAllMemories();
    
    // Save all memories
    for (const memory of state.memories) {
      await this.repository.saveMemory(memory);
    }
  }

  /**
   * Restore state from storage
   */
  public async restoreState(state: MemorySystemState): Promise<void> {
    // Clear existing memories
    await this.clearAllMemories();
    
    // Restore all memories
    for (const memory of state.memories) {
      await this.repository.saveMemory(memory);
    }
  }

  /**
   * Compare two memory system states for equality
   */
  public compareStates(state1: MemorySystemState, state2: MemorySystemState): boolean {
    // Compare metadata
    if (state1.memories.length !== state2.memories.length) {
      return false;
    }

    if (state1.metadata.totalMemories !== state2.metadata.totalMemories) {
      return false;
    }

    if (Math.abs(state1.metadata.averageConfidence - state2.metadata.averageConfidence) > 0.001) {
      return false;
    }

    // Compare memories (order-independent)
    const memories1 = [...state1.memories].sort((a, b) => a.id.localeCompare(b.id));
    const memories2 = [...state2.memories].sort((a, b) => a.id.localeCompare(b.id));

    for (let i = 0; i < memories1.length; i++) {
      if (!this.compareMemories(memories1[i]!, memories2[i]!)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Serialize a single memory
   */
  private serializeMemory(memory: Memory): SerializedMemory {
    const base: SerializedMemory = {
      id: memory.id,
      type: memory.type,
      confidence: memory.confidence,
      createdAt: memory.createdAt.toISOString(),
      lastUsed: memory.lastUsed.toISOString(),
      usageCount: memory.usageCount,
      successRate: memory.successRate,
      pattern: {
        patternType: memory.pattern.patternType,
        patternData: memory.pattern.patternData,
        threshold: memory.pattern.threshold
      },
      context: memory.context as unknown as Record<string, unknown>
    };

    // Add type-specific data
    switch (memory.type) {
      case MemoryType.VENDOR:
        const vendorMemory = memory as any;
        base.vendorData = {
          vendorId: vendorMemory.vendorId,
          fieldMappings: vendorMemory.fieldMappings,
          vatBehavior: vendorMemory.vatBehavior,
          currencyPatterns: vendorMemory.currencyPatterns,
          dateFormats: vendorMemory.dateFormats
        };
        break;
        
      case MemoryType.CORRECTION:
        const correctionMemory = memory as any;
        base.correctionData = {
          correctionType: correctionMemory.correctionType,
          triggerConditions: correctionMemory.triggerConditions,
          correctionAction: correctionMemory.correctionAction,
          validationRules: correctionMemory.validationRules
        };
        break;
        
      case MemoryType.RESOLUTION:
        const resolutionMemory = memory as any;
        base.resolutionData = {
          discrepancyType: resolutionMemory.discrepancyType,
          resolutionOutcome: resolutionMemory.resolutionOutcome,
          humanDecision: resolutionMemory.humanDecision,
          contextFactors: resolutionMemory.contextFactors
        };
        break;
    }

    return base;
  }

  /**
   * Deserialize a single memory
   */
  private async deserializeMemory(serialized: SerializedMemory): Promise<Memory> {
    // Import the factory to properly reconstruct memories
    const { MemoryFactory } = await import('./memory-base');
    
    const basePattern = {
      patternType: serialized.pattern.patternType as any,
      patternData: serialized.pattern.patternData,
      threshold: serialized.pattern.threshold
    };
    
    const baseContext = serialized.context as any;
    
    let memory: Memory;
    
    switch (serialized.type) {
      case MemoryType.VENDOR:
        if (!serialized.vendorData) {
          throw new Error('Vendor data missing for vendor memory');
        }
        memory = MemoryFactory.createVendorMemory(
          serialized.id,
          basePattern,
          serialized.confidence,
          baseContext,
          serialized.vendorData.vendorId,
          serialized.vendorData.vatBehavior as any,
          serialized.vendorData.fieldMappings as any,
          serialized.vendorData.currencyPatterns as any,
          serialized.vendorData.dateFormats as any
        );
        break;
        
      case MemoryType.CORRECTION:
        if (!serialized.correctionData) {
          throw new Error('Correction data missing for correction memory');
        }
        memory = MemoryFactory.createCorrectionMemory(
          serialized.id,
          basePattern,
          serialized.confidence,
          baseContext,
          serialized.correctionData.correctionType as any,
          serialized.correctionData.triggerConditions as any,
          serialized.correctionData.correctionAction as any,
          serialized.correctionData.validationRules as any
        );
        break;
        
      case MemoryType.RESOLUTION:
        if (!serialized.resolutionData) {
          throw new Error('Resolution data missing for resolution memory');
        }
        memory = MemoryFactory.createResolutionMemory(
          serialized.id,
          basePattern,
          serialized.confidence,
          baseContext,
          serialized.resolutionData.discrepancyType as any,
          serialized.resolutionData.resolutionOutcome as any,
          serialized.resolutionData.humanDecision as any,
          serialized.resolutionData.contextFactors as any
        );
        break;
        
      default:
        throw new Error(`Unknown memory type: ${serialized.type}`);
    }
    
    // Restore runtime properties
    (memory as any).createdAt = new Date(serialized.createdAt);
    (memory as any).lastUsed = new Date(serialized.lastUsed);
    (memory as any).usageCount = serialized.usageCount;
    (memory as any).successRate = serialized.successRate;
    
    return memory;
  }

  /**
   * Compare two memories for equality
   */
  private compareMemories(memory1: Memory, memory2: Memory): boolean {
    // Compare basic properties
    if (memory1.id !== memory2.id) return false;
    if (memory1.type !== memory2.type) return false;
    if (Math.abs(memory1.confidence - memory2.confidence) > 0.001) return false;
    if (memory1.usageCount !== memory2.usageCount) return false;
    if (Math.abs(memory1.successRate - memory2.successRate) > 0.001) return false;
    
    // Compare timestamps (allow small differences due to serialization)
    if (Math.abs(memory1.createdAt.getTime() - memory2.createdAt.getTime()) > 1000) return false;
    if (Math.abs(memory1.lastUsed.getTime() - memory2.lastUsed.getTime()) > 1000) return false;
    
    // Compare pattern and context (deep comparison)
    if (JSON.stringify(memory1.pattern) !== JSON.stringify(memory2.pattern)) return false;
    if (JSON.stringify(memory1.context) !== JSON.stringify(memory2.context)) return false;
    
    return true;
  }

  /**
   * Clear all memories from the database
   */
  private async clearAllMemories(): Promise<void> {
    await this.db.execute('DELETE FROM vendor_memories');
    await this.db.execute('DELETE FROM correction_memories');
    await this.db.execute('DELETE FROM resolution_memories');
    await this.db.execute('DELETE FROM memories');
  }
}