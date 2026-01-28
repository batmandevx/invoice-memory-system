/**
 * Memory Repository Implementation
 * 
 * Provides persistence layer for memory system using SQLite database.
 * Handles serialization/deserialization of memory objects and provides
 * CRUD operations for all memory types.
 */

import { DatabaseConnection } from './connection';
import {
  Memory,
  MemoryType,
  VendorMemory,
  CorrectionMemory,
  ResolutionMemory,
  MemoryPattern,
  MemoryContext,
  FieldMapping,
  VATBehavior,
  CurrencyPattern,
  DateFormat,
  CorrectionType,
  Condition,
  CorrectionAction,
  ValidationRule,
  DiscrepancyType,
  ResolutionOutcome,
  HumanDecision,
  ContextFactor
} from '../types';
import {
  VendorMemoryImpl,
  CorrectionMemoryImpl,
  ResolutionMemoryImpl
} from '../core/memory-base';

/**
 * Repository interface for memory persistence operations
 */
export interface MemoryRepository {
  saveMemory(memory: Memory): Promise<void>;
  findMemoryById(id: string): Promise<Memory | null>;
  findMemoriesByVendor(vendorId: string): Promise<Memory[]>;
  findMemoriesByPattern(pattern: MemoryPattern): Promise<Memory[]>;
  findMemoriesByType(type: MemoryType): Promise<Memory[]>;
  updateConfidence(memoryId: string, confidence: number): Promise<void>;
  archiveMemory(memoryId: string): Promise<void>;
  deleteMemory(memoryId: string): Promise<void>;
  getAllMemories(): Promise<Memory[]>;
  getMemoryCount(): Promise<number>;
}

/**
 * SQLite-based implementation of MemoryRepository
 */
export class SQLiteMemoryRepository implements MemoryRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Save a memory to the database
   */
  public async saveMemory(memory: Memory): Promise<void> {
    await this.db.withTransaction(async () => {
      // Insert into base memories table
      await this.db.execute(
        `INSERT OR REPLACE INTO memories (
          id, type, confidence, created_at, last_used, usage_count, 
          success_rate, pattern_type, pattern_data, context_data, archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          memory.id,
          memory.type,
          memory.confidence,
          memory.createdAt.toISOString(),
          memory.lastUsed.toISOString(),
          memory.usageCount,
          memory.successRate,
          memory.pattern.patternType,
          JSON.stringify({
            ...memory.pattern.patternData,
            threshold: memory.pattern.threshold
          }),
          JSON.stringify(memory.context),
          false
        ]
      );

      // Insert type-specific data
      switch (memory.type) {
        case MemoryType.VENDOR:
          await this.saveVendorMemory(memory as VendorMemory);
          break;
        case MemoryType.CORRECTION:
          await this.saveCorrectionMemory(memory as CorrectionMemory);
          break;
        case MemoryType.RESOLUTION:
          await this.saveResolutionMemory(memory as ResolutionMemory);
          break;
      }
    });
  }

  /**
   * Find a memory by its ID
   */
  public async findMemoryById(id: string): Promise<Memory | null> {
    const baseMemory = await this.db.queryOne<any>(
      'SELECT * FROM memories WHERE id = ? AND archived = FALSE',
      [id]
    );

    if (!baseMemory) {
      return null;
    }

    return this.hydrateMemory(baseMemory);
  }

  /**
   * Find memories by vendor ID
   */
  public async findMemoriesByVendor(vendorId: string): Promise<Memory[]> {
    const memories = await this.db.query<any>(
      `SELECT m.* FROM memories m
       LEFT JOIN vendor_memories vm ON m.id = vm.memory_id
       WHERE (vm.vendor_id = ? OR JSON_EXTRACT(m.context_data, '$.vendorId') = ?)
       AND m.archived = FALSE
       ORDER BY m.confidence DESC, m.last_used DESC`,
      [vendorId, vendorId]
    );

    return Promise.all(memories.map(memory => this.hydrateMemory(memory)));
  }

  /**
   * Find memories by pattern type
   */
  public async findMemoriesByPattern(pattern: MemoryPattern): Promise<Memory[]> {
    const memories = await this.db.query<any>(
      `SELECT * FROM memories 
       WHERE pattern_type = ? AND archived = FALSE
       ORDER BY confidence DESC`,
      [pattern.patternType]
    );

    return Promise.all(memories.map(memory => this.hydrateMemory(memory)));
  }

  /**
   * Find memories by type
   */
  public async findMemoriesByType(type: MemoryType): Promise<Memory[]> {
    const memories = await this.db.query<any>(
      'SELECT * FROM memories WHERE type = ? AND archived = FALSE ORDER BY confidence DESC',
      [type]
    );

    return Promise.all(memories.map(memory => this.hydrateMemory(memory)));
  }

  /**
   * Update memory confidence
   */
  public async updateConfidence(memoryId: string, confidence: number): Promise<void> {
    const clampedConfidence = Math.max(0, Math.min(1, confidence));
    
    await this.db.execute(
      'UPDATE memories SET confidence = ? WHERE id = ?',
      [clampedConfidence, memoryId]
    );
  }

  /**
   * Archive a memory (soft delete)
   */
  public async archiveMemory(memoryId: string): Promise<void> {
    await this.db.execute(
      'UPDATE memories SET archived = TRUE WHERE id = ?',
      [memoryId]
    );
  }

  /**
   * Delete a memory permanently
   */
  public async deleteMemory(memoryId: string): Promise<void> {
    await this.db.execute('DELETE FROM memories WHERE id = ?', [memoryId]);
  }

  /**
   * Get all active memories
   */
  public async getAllMemories(): Promise<Memory[]> {
    const memories = await this.db.query<any>(
      'SELECT * FROM memories WHERE archived = FALSE ORDER BY confidence DESC'
    );

    return Promise.all(memories.map(memory => this.hydrateMemory(memory)));
  }

  /**
   * Get count of active memories
   */
  public async getMemoryCount(): Promise<number> {
    const result = await this.db.queryOne<{ count: number }>(
      'SELECT COUNT(*) as count FROM memories WHERE archived = FALSE'
    );
    return result?.count || 0;
  }

  /**
   * Save vendor-specific memory data
   */
  private async saveVendorMemory(memory: VendorMemory): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO vendor_memories (
        memory_id, vendor_id, field_mappings, vat_behavior, 
        currency_patterns, date_formats
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        memory.id,
        memory.vendorId,
        JSON.stringify(memory.fieldMappings),
        JSON.stringify(memory.vatBehavior),
        JSON.stringify(memory.currencyPatterns),
        JSON.stringify(memory.dateFormats)
      ]
    );
  }

  /**
   * Save correction memory data
   */
  private async saveCorrectionMemory(memory: CorrectionMemory): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO correction_memories (
        memory_id, correction_type, trigger_conditions, 
        correction_action, validation_rules
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        memory.id,
        memory.correctionType,
        JSON.stringify(memory.triggerConditions),
        JSON.stringify(memory.correctionAction),
        JSON.stringify(memory.validationRules)
      ]
    );
  }

  /**
   * Save resolution memory data
   */
  private async saveResolutionMemory(memory: ResolutionMemory): Promise<void> {
    await this.db.execute(
      `INSERT OR REPLACE INTO resolution_memories (
        memory_id, discrepancy_type, resolution_outcome, 
        human_decision, context_factors
      ) VALUES (?, ?, ?, ?, ?)`,
      [
        memory.id,
        memory.discrepancyType,
        JSON.stringify(memory.resolutionOutcome),
        JSON.stringify(memory.humanDecision),
        JSON.stringify(memory.contextFactors)
      ]
    );
  }

  /**
   * Hydrate a memory object from database row
   */
  private async hydrateMemory(row: any): Promise<Memory> {
    const patternData = JSON.parse(row.pattern_data);
    const threshold = patternData.threshold || 0.7;
    
    // Remove threshold from pattern data if it exists there
    const { threshold: _, ...cleanPatternData } = patternData;
    
    const baseData = {
      id: row.id,
      type: row.type as MemoryType,
      pattern: {
        patternType: row.pattern_type,
        patternData: cleanPatternData,
        threshold: threshold
      } as MemoryPattern,
      confidence: row.confidence,
      createdAt: new Date(row.created_at),
      lastUsed: new Date(row.last_used),
      usageCount: row.usage_count,
      successRate: row.success_rate,
      context: JSON.parse(row.context_data) as MemoryContext
    };

    switch (row.type) {
      case MemoryType.VENDOR:
        return this.hydrateVendorMemory(baseData);
      case MemoryType.CORRECTION:
        return this.hydrateCorrectionMemory(baseData);
      case MemoryType.RESOLUTION:
        return this.hydrateResolutionMemory(baseData);
      default:
        throw new Error(`Unknown memory type: ${row.type}`);
    }
  }

  /**
   * Hydrate vendor memory from database
   */
  private async hydrateVendorMemory(baseData: any): Promise<VendorMemory> {
    const vendorData = await this.db.queryOne<any>(
      'SELECT * FROM vendor_memories WHERE memory_id = ?',
      [baseData.id]
    );

    if (!vendorData) {
      throw new Error(`Vendor memory data not found for memory ${baseData.id}`);
    }

    const memory = new VendorMemoryImpl(
      baseData.id,
      baseData.pattern,
      baseData.confidence,
      baseData.context,
      vendorData.vendor_id,
      JSON.parse(vendorData.field_mappings || '[]') as FieldMapping[],
      JSON.parse(vendorData.vat_behavior) as VATBehavior,
      JSON.parse(vendorData.currency_patterns || '[]') as CurrencyPattern[],
      JSON.parse(vendorData.date_formats || '[]') as DateFormat[]
    );

    // Restore runtime properties
    memory.lastUsed = baseData.lastUsed;
    memory.usageCount = baseData.usageCount;
    memory.successRate = baseData.successRate;

    return memory;
  }

  /**
   * Hydrate correction memory from database
   */
  private async hydrateCorrectionMemory(baseData: any): Promise<CorrectionMemory> {
    const correctionData = await this.db.queryOne<any>(
      'SELECT * FROM correction_memories WHERE memory_id = ?',
      [baseData.id]
    );

    if (!correctionData) {
      throw new Error(`Correction memory data not found for memory ${baseData.id}`);
    }

    const memory = new CorrectionMemoryImpl(
      baseData.id,
      baseData.pattern,
      baseData.confidence,
      baseData.context,
      correctionData.correction_type as CorrectionType,
      JSON.parse(correctionData.trigger_conditions) as Condition[],
      JSON.parse(correctionData.correction_action) as CorrectionAction,
      JSON.parse(correctionData.validation_rules || '[]') as ValidationRule[]
    );

    // Restore runtime properties
    memory.lastUsed = baseData.lastUsed;
    memory.usageCount = baseData.usageCount;
    memory.successRate = baseData.successRate;

    return memory;
  }

  /**
   * Hydrate resolution memory from database
   */
  private async hydrateResolutionMemory(baseData: any): Promise<ResolutionMemory> {
    const resolutionData = await this.db.queryOne<any>(
      'SELECT * FROM resolution_memories WHERE memory_id = ?',
      [baseData.id]
    );

    if (!resolutionData) {
      throw new Error(`Resolution memory data not found for memory ${baseData.id}`);
    }

    const memory = new ResolutionMemoryImpl(
      baseData.id,
      baseData.pattern,
      baseData.confidence,
      baseData.context,
      resolutionData.discrepancy_type as DiscrepancyType,
      JSON.parse(resolutionData.resolution_outcome) as ResolutionOutcome,
      JSON.parse(resolutionData.human_decision) as HumanDecision,
      JSON.parse(resolutionData.context_factors || '[]') as ContextFactor[]
    );

    // Restore runtime properties
    memory.lastUsed = baseData.lastUsed;
    memory.usageCount = baseData.usageCount;
    memory.successRate = baseData.successRate;

    return memory;
  }
}

/**
 * Create a memory repository instance
 */
export function createMemoryRepository(db: DatabaseConnection): MemoryRepository {
  return new SQLiteMemoryRepository(db);
}