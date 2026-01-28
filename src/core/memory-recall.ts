/**
 * Memory Recall Engine
 * 
 * Implements memory querying, ranking by relevance and confidence,
 * context matching algorithms for vendor and pattern recognition,
 * and memory conflict resolution logic.
 */

import {
  Memory,
  MemoryType,
  MemoryContext,
  InvoiceContext,
  RawInvoice,
  VendorMemory,
  CorrectionMemory,
  ResolutionMemory,
  PatternType,
  ComplexityLevel,
  QualityLevel,
  AuditStep,
  AuditOperation
} from '../types';
import { MemoryRepository } from '../database/memory-repository';

/**
 * Configuration for memory recall operations
 */
export interface MemoryRecallConfig {
  /** Maximum number of memories to return per query */
  maxMemoriesPerQuery: number;
  
  /** Minimum relevance score to include a memory */
  minRelevanceThreshold: number;
  
  /** Weight for confidence in ranking (0.0-1.0) */
  confidenceWeight: number;
  
  /** Weight for relevance in ranking (0.0-1.0) */
  relevanceWeight: number;
  
  /** Weight for recency in ranking (0.0-1.0) */
  recencyWeight: number;
  
  /** Enable vendor-specific memory prioritization */
  enableVendorPrioritization: boolean;
  
  /** Enable pattern-based memory filtering */
  enablePatternFiltering: boolean;
  
  /** Conflict resolution strategy */
  conflictResolutionStrategy: ConflictResolutionStrategy;
}

/**
 * Strategies for resolving memory conflicts
 */
export enum ConflictResolutionStrategy {
  /** Use the memory with highest confidence */
  HIGHEST_CONFIDENCE = 'highest_confidence',
  
  /** Use the most recently used memory */
  MOST_RECENT = 'most_recent',
  
  /** Use the memory with highest usage count */
  MOST_USED = 'most_used',
  
  /** Combine memories using weighted average */
  WEIGHTED_COMBINATION = 'weighted_combination',
  
  /** Use vendor-specific memory if available */
  VENDOR_PRIORITY = 'vendor_priority'
}

/**
 * Result of memory recall operation
 */
export interface MemoryRecallResult {
  /** Recalled memories ranked by relevance and confidence */
  memories: RankedMemory[];
  
  /** Total number of memories considered */
  totalConsidered: number;
  
  /** Number of memories filtered out */
  filteredOut: number;
  
  /** Conflicts detected and resolved */
  conflictsResolved: MemoryConflict[];
  
  /** Context matching statistics */
  contextMatchStats: ContextMatchStats;
  
  /** Reasoning for memory selection */
  reasoning: string;
}

/**
 * Memory with ranking information
 */
export interface RankedMemory {
  /** The memory object */
  memory: Memory;
  
  /** Overall ranking score (0.0-1.0) */
  rankingScore: number;
  
  /** Relevance score for the current context (0.0-1.0) */
  relevanceScore: number;
  
  /** Confidence score from the memory (0.0-1.0) */
  confidenceScore: number;
  
  /** Recency score based on last usage (0.0-1.0) */
  recencyScore: number;
  
  /** Context matching details */
  contextMatch: ContextMatchDetails;
  
  /** Reason this memory was selected */
  selectionReason: string;
}

/**
 * Details about how a memory matches the current context
 */
export interface ContextMatchDetails {
  /** Whether vendor ID matches */
  vendorMatch: boolean;
  
  /** Whether pattern type matches */
  patternMatch: boolean;
  
  /** Whether language matches */
  languageMatch: boolean;
  
  /** Whether complexity level is compatible */
  complexityMatch: boolean;
  
  /** Whether extraction quality is compatible */
  qualityMatch: boolean;
  
  /** Overall context similarity score (0.0-1.0) */
  similarityScore: number;
  
  /** Specific matching factors */
  matchingFactors: string[];
}

/**
 * Detected memory conflict
 */
export interface MemoryConflict {
  /** Type of conflict detected */
  conflictType: ConflictType;
  
  /** Memories involved in the conflict */
  conflictingMemories: Memory[];
  
  /** Memory selected to resolve the conflict */
  resolvedMemory: Memory;
  
  /** Strategy used to resolve the conflict */
  resolutionStrategy: ConflictResolutionStrategy;
  
  /** Explanation of the resolution */
  resolutionReasoning: string;
}

/**
 * Types of memory conflicts
 */
export enum ConflictType {
  /** Multiple memories for the same field mapping */
  FIELD_MAPPING_CONFLICT = 'field_mapping_conflict',
  
  /** Conflicting correction actions */
  CORRECTION_CONFLICT = 'correction_conflict',
  
  /** Different resolution approaches for same discrepancy */
  RESOLUTION_CONFLICT = 'resolution_conflict',
  
  /** Overlapping pattern matches */
  PATTERN_OVERLAP = 'pattern_overlap',
  
  /** Vendor-specific vs generic memory conflict */
  VENDOR_GENERIC_CONFLICT = 'vendor_generic_conflict'
}

/**
 * Statistics about context matching
 */
export interface ContextMatchStats {
  /** Number of memories with exact vendor match */
  exactVendorMatches: number;
  
  /** Number of memories with pattern match */
  patternMatches: number;
  
  /** Number of memories with language match */
  languageMatches: number;
  
  /** Average context similarity score */
  averageSimilarity: number;
  
  /** Distribution of memory types recalled */
  memoryTypeDistribution: Record<MemoryType, number>;
}

/**
 * Query parameters for memory recall
 */
export interface MemoryQuery {
  /** Context for memory matching */
  context: MemoryContext;
  
  /** Specific memory types to include (optional) */
  memoryTypes?: MemoryType[];
  
  /** Specific pattern types to match (optional) */
  patternTypes?: PatternType[];
  
  /** Minimum confidence threshold (optional) */
  minConfidence?: number;
  
  /** Maximum age in days (optional) */
  maxAgeDays?: number;
  
  /** Include archived memories */
  includeArchived?: boolean;
}

/**
 * Interface for the memory recall engine
 */
export interface MemoryRecallEngine {
  /**
   * Recall relevant memories for a given invoice context
   * @param context Invoice processing context
   * @returns Ranked memories with conflict resolution
   */
  recallMemories(context: InvoiceContext): Promise<MemoryRecallResult>;

  /**
   * Query memories with specific criteria
   * @param query Memory query parameters
   * @returns Ranked memories matching the query
   */
  queryMemories(query: MemoryQuery): Promise<MemoryRecallResult>;

  /**
   * Resolve conflicts between multiple memories
   * @param memories Conflicting memories
   * @param context Current processing context
   * @returns Resolved memory conflicts
   */
  resolveConflicts(memories: Memory[], context: MemoryContext): MemoryConflict[];

  /**
   * Calculate context similarity between memory and current context
   * @param memory Memory to evaluate
   * @param context Current context
   * @returns Context matching details
   */
  calculateContextMatch(memory: Memory, context: MemoryContext): ContextMatchDetails;

  /**
   * Rank memories by relevance and confidence
   * @param memories Memories to rank
   * @param context Current context
   * @returns Ranked memories
   */
  rankMemories(memories: Memory[], context: MemoryContext): RankedMemory[];

  /**
   * Get audit steps for memory recall operations
   * @returns Array of audit steps
   */
  getAuditSteps(): AuditStep[];

  /**
   * Clear audit steps (for testing)
   */
  clearAuditSteps(): void;
}

/**
 * Implementation of the memory recall engine
 */
export class MemoryRecallEngineImpl implements MemoryRecallEngine {
  private repository: MemoryRepository;
  private config: MemoryRecallConfig;
  private auditSteps: AuditStep[] = [];

  constructor(
    repository: MemoryRepository,
    config?: Partial<MemoryRecallConfig>
  ) {
    this.repository = repository;
    this.config = {
      maxMemoriesPerQuery: 50,
      minRelevanceThreshold: 0.1,
      confidenceWeight: 0.4,
      relevanceWeight: 0.4,
      recencyWeight: 0.2,
      enableVendorPrioritization: true,
      enablePatternFiltering: true,
      conflictResolutionStrategy: ConflictResolutionStrategy.HIGHEST_CONFIDENCE,
      ...config
    };
  }

  /**
   * Recall relevant memories for a given invoice context
   */
  async recallMemories(context: InvoiceContext): Promise<MemoryRecallResult> {
    const startTime = Date.now();
    
    // Convert invoice context to memory context
    const memoryContext: MemoryContext = {
      vendorId: context.vendorInfo.id,
      invoiceCharacteristics: {
        complexity: this.assessInvoiceComplexity(context.invoice),
        language: context.vendorInfo.language,
        documentFormat: 'pdf', // Default, could be extracted from metadata
        extractionQuality: this.assessExtractionQuality(context.invoice)
      },
      historicalContext: context.history ? {
        recentResults: [],
        trendingPatterns: [],
        seasonalFactors: []
      } : {
        recentResults: [],
        trendingPatterns: [],
        seasonalFactors: []
      },
      environmentalFactors: []
    };

    // Create query from context
    const query: MemoryQuery = {
      context: memoryContext,
      includeArchived: false
    };

    const result = await this.queryMemories(query);

    // Record audit step
    this.recordAuditStep({
      id: `recall-${Date.now()}`,
      timestamp: new Date(),
      operation: AuditOperation.MEMORY_RECALL,
      description: 'Memory recall for invoice processing',
      input: {
        invoiceId: context.invoice.id,
        vendorId: context.vendorInfo.id,
        language: context.vendorInfo.language
      },
      output: {
        memoriesRecalled: result.memories.length,
        totalConsidered: result.totalConsidered,
        conflictsResolved: result.conflictsResolved.length
      },
      actor: 'MemoryRecallEngine',
      duration: Date.now() - startTime
    });

    return result;
  }

  /**
   * Query memories with specific criteria
   */
  async queryMemories(query: MemoryQuery): Promise<MemoryRecallResult> {
    const startTime = Date.now();
    
    // Step 1: Retrieve candidate memories from repository
    let candidateMemories: Memory[] = [];
    
    // Query by vendor first (most specific)
    if (query.context.vendorId && this.config.enableVendorPrioritization) {
      const vendorMemories = await this.repository.findMemoriesByVendor(query.context.vendorId);
      candidateMemories.push(...vendorMemories);
    }
    
    // Query by memory types if specified
    if (query.memoryTypes) {
      for (const memoryType of query.memoryTypes) {
        const typeMemories = await this.repository.findMemoriesByType(memoryType);
        candidateMemories.push(...typeMemories);
      }
    } else {
      // Get all memories if no specific types requested
      const allMemories = await this.repository.getAllMemories();
      candidateMemories.push(...allMemories);
    }
    
    // Remove duplicates
    const uniqueMemories = this.removeDuplicateMemories(candidateMemories);
    const totalConsidered = uniqueMemories.length;
    
    // Step 2: Filter memories based on criteria
    let filteredMemories = uniqueMemories;
    
    // Filter by confidence threshold
    if (query.minConfidence !== undefined) {
      filteredMemories = filteredMemories.filter(
        memory => memory.confidence >= query.minConfidence!
      );
    }
    
    // Filter by age
    if (query.maxAgeDays !== undefined) {
      const maxAge = Date.now() - (query.maxAgeDays * 24 * 60 * 60 * 1000);
      filteredMemories = filteredMemories.filter(
        memory => memory.lastUsed.getTime() >= maxAge
      );
    }
    
    // Filter by pattern types
    if (query.patternTypes && this.config.enablePatternFiltering) {
      filteredMemories = filteredMemories.filter(
        memory => query.patternTypes!.includes(memory.pattern.patternType)
      );
    }
    
    // Step 3: Calculate relevance and filter by minimum threshold
    const relevantMemories = filteredMemories.filter(memory => {
      const contextMatch = this.calculateContextMatch(memory, query.context);
      return contextMatch.similarityScore >= this.config.minRelevanceThreshold;
    });
    
    const filteredOut = totalConsidered - relevantMemories.length;
    
    // Step 4: Rank memories
    const rankedMemories = this.rankMemories(relevantMemories, query.context);
    
    // Step 5: Limit results
    const limitedMemories = rankedMemories.slice(0, this.config.maxMemoriesPerQuery);
    
    // Step 6: Resolve conflicts
    const memories = limitedMemories.map(rm => rm.memory);
    const conflicts = this.resolveConflicts(memories, query.context);
    
    // Step 7: Calculate context match statistics
    const contextMatchStats = this.calculateContextMatchStats(limitedMemories);
    
    // Step 8: Generate reasoning
    const reasoning = this.generateRecallReasoning(
      limitedMemories,
      totalConsidered,
      filteredOut,
      conflicts,
      query.context
    );

    // Record audit step
    this.recordAuditStep({
      id: `query-${Date.now()}`,
      timestamp: new Date(),
      operation: AuditOperation.MEMORY_RECALL,
      description: 'Memory query execution',
      input: {
        vendorId: query.context.vendorId,
        memoryTypes: query.memoryTypes,
        minConfidence: query.minConfidence,
        maxAgeDays: query.maxAgeDays
      },
      output: {
        totalConsidered,
        filteredOut,
        memoriesReturned: limitedMemories.length,
        conflictsResolved: conflicts.length
      },
      actor: 'MemoryRecallEngine',
      duration: Date.now() - startTime
    });

    return {
      memories: limitedMemories,
      totalConsidered,
      filteredOut,
      conflictsResolved: conflicts,
      contextMatchStats,
      reasoning
    };
  }

  /**
   * Resolve conflicts between multiple memories
   */
  resolveConflicts(memories: Memory[], context: MemoryContext): MemoryConflict[] {
    const conflicts: MemoryConflict[] = [];
    
    // Group memories by potential conflict areas
    const vendorMemories = memories.filter(m => m.type === MemoryType.VENDOR) as VendorMemory[];
    const correctionMemories = memories.filter(m => m.type === MemoryType.CORRECTION) as CorrectionMemory[];
    const resolutionMemories = memories.filter(m => m.type === MemoryType.RESOLUTION) as ResolutionMemory[];
    
    // Detect field mapping conflicts in vendor memories
    conflicts.push(...this.detectFieldMappingConflicts(vendorMemories, context));
    
    // Detect correction conflicts
    conflicts.push(...this.detectCorrectionConflicts(correctionMemories, context));
    
    // Detect resolution conflicts
    conflicts.push(...this.detectResolutionConflicts(resolutionMemories, context));
    
    // Detect vendor vs generic conflicts
    conflicts.push(...this.detectVendorGenericConflicts(memories, context));
    
    return conflicts;
  }

  /**
   * Calculate context similarity between memory and current context
   */
  calculateContextMatch(memory: Memory, context: MemoryContext): ContextMatchDetails {
    const matchingFactors: string[] = [];
    let similarityScore = 0;
    let factorCount = 0;
    
    // Vendor match (highest weight)
    const vendorMatch = memory.context.vendorId === context.vendorId;
    if (vendorMatch) {
      similarityScore += 0.4;
      matchingFactors.push('vendor ID match');
    }
    factorCount++;
    
    // Pattern type match
    const patternMatch = this.isPatternTypeCompatible(memory.pattern.patternType, context);
    if (patternMatch) {
      similarityScore += 0.2;
      matchingFactors.push('pattern type compatibility');
    }
    factorCount++;
    
    // Language match
    const languageMatch = memory.context.invoiceCharacteristics.language === context.invoiceCharacteristics.language;
    if (languageMatch) {
      similarityScore += 0.15;
      matchingFactors.push('language match');
    }
    factorCount++;
    
    // Complexity compatibility
    const complexityMatch = this.isComplexityCompatible(
      memory.context.invoiceCharacteristics.complexity,
      context.invoiceCharacteristics.complexity
    );
    if (complexityMatch) {
      similarityScore += 0.15;
      matchingFactors.push('complexity compatibility');
    }
    factorCount++;
    
    // Quality compatibility
    const qualityMatch = this.isQualityCompatible(
      memory.context.invoiceCharacteristics.extractionQuality,
      context.invoiceCharacteristics.extractionQuality
    );
    if (qualityMatch) {
      similarityScore += 0.1;
      matchingFactors.push('extraction quality compatibility');
    }
    factorCount++;
    
    // Normalize similarity score
    similarityScore = Math.min(1.0, similarityScore);
    
    return {
      vendorMatch,
      patternMatch,
      languageMatch,
      complexityMatch,
      qualityMatch,
      similarityScore,
      matchingFactors
    };
  }

  /**
   * Rank memories by relevance and confidence
   */
  rankMemories(memories: Memory[], context: MemoryContext): RankedMemory[] {
    return memories.map(memory => {
      const contextMatch = this.calculateContextMatch(memory, context);
      const relevanceScore = contextMatch.similarityScore;
      const confidenceScore = memory.confidence;
      const recencyScore = this.calculateRecencyScore(memory);
      
      // Calculate overall ranking score
      const rankingScore = 
        (relevanceScore * this.config.relevanceWeight) +
        (confidenceScore * this.config.confidenceWeight) +
        (recencyScore * this.config.recencyWeight);
      
      // Generate selection reason
      const selectionReason = this.generateSelectionReason(
        memory,
        contextMatch,
        relevanceScore,
        confidenceScore,
        recencyScore
      );
      
      return {
        memory,
        rankingScore,
        relevanceScore,
        confidenceScore,
        recencyScore,
        contextMatch,
        selectionReason
      };
    }).sort((a, b) => b.rankingScore - a.rankingScore); // Sort by ranking score descending
  }

  /**
   * Get audit steps for memory recall operations
   */
  getAuditSteps(): AuditStep[] {
    return [...this.auditSteps];
  }

  /**
   * Clear audit steps (for testing)
   */
  clearAuditSteps(): void {
    this.auditSteps = [];
  }

  // Private helper methods

  private removeDuplicateMemories(memories: Memory[]): Memory[] {
    const seen = new Set<string>();
    return memories.filter(memory => {
      if (seen.has(memory.id)) {
        return false;
      }
      seen.add(memory.id);
      return true;
    });
  }

  private assessInvoiceComplexity(invoice: RawInvoice): ComplexityLevel {
    // Simple heuristic based on extracted fields and text length
    const fieldCount = invoice.extractedFields.length;
    const textLength = invoice.rawText.length;
    
    if (fieldCount < 5 && textLength < 1000) {
      return ComplexityLevel.SIMPLE;
    } else if (fieldCount < 15 && textLength < 5000) {
      return ComplexityLevel.MODERATE;
    } else if (fieldCount < 25 && textLength < 10000) {
      return ComplexityLevel.COMPLEX;
    } else {
      return ComplexityLevel.VERY_COMPLEX;
    }
  }

  private assessExtractionQuality(invoice: RawInvoice): QualityLevel {
    // Simple heuristic based on field confidence scores
    if (invoice.extractedFields.length === 0) {
      return QualityLevel.POOR;
    }
    
    const avgConfidence = invoice.extractedFields.reduce(
      (sum, field) => sum + field.confidence, 0
    ) / invoice.extractedFields.length;
    
    if (avgConfidence >= 0.9) return QualityLevel.EXCELLENT;
    if (avgConfidence >= 0.7) return QualityLevel.GOOD;
    if (avgConfidence >= 0.5) return QualityLevel.FAIR;
    return QualityLevel.POOR;
  }

  private isPatternTypeCompatible(_memoryPatternType: PatternType, _context: MemoryContext): boolean {
    // For now, we'll use a simple approach - all patterns are potentially compatible
    // In a real implementation, this would be more sophisticated
    return true;
  }

  private isComplexityCompatible(memoryComplexity: ComplexityLevel, contextComplexity: ComplexityLevel): boolean {
    // Define compatibility rules - memories can be applied to same or higher complexity
    const complexityOrder = [
      ComplexityLevel.SIMPLE,
      ComplexityLevel.MODERATE,
      ComplexityLevel.COMPLEX,
      ComplexityLevel.VERY_COMPLEX
    ];
    
    const memoryIndex = complexityOrder.indexOf(memoryComplexity);
    const contextIndex = complexityOrder.indexOf(contextComplexity);
    
    // Memory can be applied to same or higher complexity invoices
    return memoryIndex <= contextIndex;
  }

  private isQualityCompatible(memoryQuality: QualityLevel, contextQuality: QualityLevel): boolean {
    // Define compatibility rules - memories from higher quality can be applied to lower quality
    const qualityOrder = [
      QualityLevel.POOR,
      QualityLevel.FAIR,
      QualityLevel.GOOD,
      QualityLevel.EXCELLENT
    ];
    
    const memoryIndex = qualityOrder.indexOf(memoryQuality);
    const contextIndex = qualityOrder.indexOf(contextQuality);
    
    // Memory from higher or equal quality can be applied
    return memoryIndex >= contextIndex;
  }

  private calculateRecencyScore(memory: Memory): number {
    const daysSinceLastUse = (Date.now() - memory.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
    
    // Exponential decay over 30 days
    return Math.exp(-daysSinceLastUse / 30);
  }

  private detectFieldMappingConflicts(vendorMemories: VendorMemory[], context: MemoryContext): MemoryConflict[] {
    const conflicts: MemoryConflict[] = [];
    
    // Group by source field to detect conflicts
    const fieldMappingGroups: Record<string, VendorMemory[]> = {};
    
    vendorMemories.forEach(memory => {
      memory.fieldMappings.forEach(mapping => {
        const key = `${mapping.sourceField}->${mapping.targetField}`;
        if (!fieldMappingGroups[key]) {
          fieldMappingGroups[key] = [];
        }
        fieldMappingGroups[key]!.push(memory);
      });
    });
    
    // Detect conflicts where multiple memories have different mappings for same field
    Object.entries(fieldMappingGroups).forEach(([key, memories]) => {
      if (memories.length > 1) {
        const resolvedMemory = this.resolveConflictByStrategy(memories, context);
        
        conflicts.push({
          conflictType: ConflictType.FIELD_MAPPING_CONFLICT,
          conflictingMemories: memories,
          resolvedMemory,
          resolutionStrategy: this.config.conflictResolutionStrategy,
          resolutionReasoning: `Multiple field mappings for ${key}, resolved using ${this.config.conflictResolutionStrategy} strategy`
        });
      }
    });
    
    return conflicts;
  }

  private detectCorrectionConflicts(correctionMemories: CorrectionMemory[], context: MemoryContext): MemoryConflict[] {
    const conflicts: MemoryConflict[] = [];
    
    // Group by target field to detect conflicts using Map to avoid prototype pollution
    const correctionGroups = new Map<string, CorrectionMemory[]>();
    
    correctionMemories.forEach(memory => {
      const targetField = memory.correctionAction.targetField;
      if (!correctionGroups.has(targetField)) {
        correctionGroups.set(targetField, []);
      }
      correctionGroups.get(targetField)!.push(memory);
    });
    
    // Detect conflicts where multiple corrections target the same field
    correctionGroups.forEach((memories, field) => {
      if (memories.length > 1) {
        const resolvedMemory = this.resolveConflictByStrategy(memories, context);
        
        conflicts.push({
          conflictType: ConflictType.CORRECTION_CONFLICT,
          conflictingMemories: memories,
          resolvedMemory,
          resolutionStrategy: this.config.conflictResolutionStrategy,
          resolutionReasoning: `Multiple corrections for field ${field}, resolved using ${this.config.conflictResolutionStrategy} strategy`
        });
      }
    });
    
    return conflicts;
  }

  private detectResolutionConflicts(resolutionMemories: ResolutionMemory[], context: MemoryContext): MemoryConflict[] {
    const conflicts: MemoryConflict[] = [];
    
    // Group by discrepancy type to detect conflicts
    const resolutionGroups: Record<string, ResolutionMemory[]> = {};
    
    resolutionMemories.forEach(memory => {
      const discrepancyType = memory.discrepancyType;
      if (!resolutionGroups[discrepancyType]) {
        resolutionGroups[discrepancyType] = [];
      }
      resolutionGroups[discrepancyType]!.push(memory);
    });
    
    // Detect conflicts where multiple resolutions exist for same discrepancy type
    Object.entries(resolutionGroups).forEach(([discrepancyType, memories]) => {
      if (memories.length > 1) {
        // Check if resolutions are actually conflicting (different actions)
        const uniqueActions = new Set(memories.map(m => m.resolutionOutcome.resolutionAction));
        
        if (uniqueActions.size > 1) {
          const resolvedMemory = this.resolveConflictByStrategy(memories, context);
          
          conflicts.push({
            conflictType: ConflictType.RESOLUTION_CONFLICT,
            conflictingMemories: memories,
            resolvedMemory,
            resolutionStrategy: this.config.conflictResolutionStrategy,
            resolutionReasoning: `Conflicting resolutions for ${discrepancyType}, resolved using ${this.config.conflictResolutionStrategy} strategy`
          });
        }
      }
    });
    
    return conflicts;
  }

  private detectVendorGenericConflicts(memories: Memory[], context: MemoryContext): MemoryConflict[] {
    const conflicts: MemoryConflict[] = [];
    
    // Group memories by vendor-specific vs generic
    const vendorSpecific = memories.filter(m => m.context.vendorId === context.vendorId);
    const generic = memories.filter(m => !m.context.vendorId || m.context.vendorId !== context.vendorId);
    
    // If we have both vendor-specific and generic memories, prefer vendor-specific
    if (vendorSpecific.length > 0 && generic.length > 0) {
      // Check for overlapping functionality
      const overlapping = this.findOverlappingMemories(vendorSpecific, generic);
      
      if (overlapping.length > 0) {
        const resolvedMemory = this.resolveConflictByStrategy(vendorSpecific, context);
        
        conflicts.push({
          conflictType: ConflictType.VENDOR_GENERIC_CONFLICT,
          conflictingMemories: [...vendorSpecific, ...generic],
          resolvedMemory,
          resolutionStrategy: ConflictResolutionStrategy.VENDOR_PRIORITY,
          resolutionReasoning: 'Vendor-specific memories take priority over generic memories'
        });
      }
    }
    
    return conflicts;
  }

  private findOverlappingMemories(vendorMemories: Memory[], genericMemories: Memory[]): Memory[] {
    // Simple overlap detection - in a real implementation this would be more sophisticated
    const overlapping: Memory[] = [];
    
    vendorMemories.forEach(vendorMemory => {
      genericMemories.forEach(genericMemory => {
        if (vendorMemory.type === genericMemory.type &&
            vendorMemory.pattern.patternType === genericMemory.pattern.patternType) {
          overlapping.push(genericMemory);
        }
      });
    });
    
    return overlapping;
  }

  private resolveConflictByStrategy(memories: Memory[], context: MemoryContext): Memory {
    switch (this.config.conflictResolutionStrategy) {
      case ConflictResolutionStrategy.HIGHEST_CONFIDENCE:
        return memories.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        
      case ConflictResolutionStrategy.MOST_RECENT:
        return memories.reduce((best, current) => 
          current.lastUsed > best.lastUsed ? current : best
        );
        
      case ConflictResolutionStrategy.MOST_USED:
        return memories.reduce((best, current) => 
          current.usageCount > best.usageCount ? current : best
        );
        
      case ConflictResolutionStrategy.VENDOR_PRIORITY:
        const vendorMemory = memories.find(m => m.context.vendorId === context.vendorId);
        return vendorMemory || memories[0]!;
        
      case ConflictResolutionStrategy.WEIGHTED_COMBINATION:
        // For now, return highest confidence - combination would be more complex
        return memories.reduce((best, current) => 
          current.confidence > best.confidence ? current : best
        );
        
      default:
        return memories[0]!;
    }
  }

  private calculateContextMatchStats(rankedMemories: RankedMemory[]): ContextMatchStats {
    const stats: ContextMatchStats = {
      exactVendorMatches: 0,
      patternMatches: 0,
      languageMatches: 0,
      averageSimilarity: 0,
      memoryTypeDistribution: {
        [MemoryType.VENDOR]: 0,
        [MemoryType.CORRECTION]: 0,
        [MemoryType.RESOLUTION]: 0
      }
    };
    
    if (rankedMemories.length === 0) {
      return stats;
    }
    
    let totalSimilarity = 0;
    
    rankedMemories.forEach(rankedMemory => {
      const { contextMatch, memory } = rankedMemory;
      
      if (contextMatch.vendorMatch) stats.exactVendorMatches++;
      if (contextMatch.patternMatch) stats.patternMatches++;
      if (contextMatch.languageMatch) stats.languageMatches++;
      
      totalSimilarity += contextMatch.similarityScore;
      stats.memoryTypeDistribution[memory.type]++;
    });
    
    stats.averageSimilarity = totalSimilarity / rankedMemories.length;
    
    return stats;
  }

  private generateSelectionReason(
    _memory: Memory,
    contextMatch: ContextMatchDetails,
    relevanceScore: number,
    confidenceScore: number,
    recencyScore: number
  ): string {
    const reasons: string[] = [];
    
    if (contextMatch.vendorMatch) {
      reasons.push('exact vendor match');
    }
    
    if (confidenceScore > 0.8) {
      reasons.push('high confidence');
    }
    
    if (relevanceScore > 0.7) {
      reasons.push('high relevance');
    }
    
    if (recencyScore > 0.8) {
      reasons.push('recently used');
    }
    
    if (contextMatch.matchingFactors.length > 2) {
      reasons.push(`${contextMatch.matchingFactors.length} context factors match`);
    }
    
    return reasons.length > 0 
      ? `Selected due to: ${reasons.join(', ')}`
      : 'Selected based on overall ranking score';
  }

  private generateRecallReasoning(
    memories: RankedMemory[],
    totalConsidered: number,
    filteredOut: number,
    conflicts: MemoryConflict[],
    context: MemoryContext
  ): string {
    const parts: string[] = [];
    
    parts.push(`Considered ${totalConsidered} memories, filtered out ${filteredOut}`);
    parts.push(`Returned ${memories.length} relevant memories`);
    
    if (context.vendorId) {
      const vendorMatches = memories.filter(m => m.contextMatch.vendorMatch).length;
      parts.push(`${vendorMatches} exact vendor matches for ${context.vendorId}`);
    }
    
    if (conflicts.length > 0) {
      parts.push(`Resolved ${conflicts.length} memory conflicts`);
    }
    
    if (memories.length > 0) {
      const avgRanking = memories.reduce((sum, m) => sum + m.rankingScore, 0) / memories.length;
      parts.push(`Average ranking score: ${avgRanking.toFixed(3)}`);
    }
    
    return parts.join('. ') + '.';
  }

  private recordAuditStep(step: AuditStep): void {
    this.auditSteps.push(step);
  }
}

/**
 * Create a memory recall engine instance
 */
export function createMemoryRecallEngine(
  repository: MemoryRepository,
  config?: Partial<MemoryRecallConfig>
): MemoryRecallEngine {
  return new MemoryRecallEngineImpl(repository, config);
}