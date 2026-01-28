/**
 * Memory Learning Engine
 * 
 * Implements learning from human corrections and approvals, pattern recognition
 * for repeated corrections, and memory reinforcement logic. This engine is the
 * core component that enables the memory system to improve over time.
 */

import {
  Memory,
  MemoryType,
  ProcessingOutcome,
  HumanFeedback,
  FeedbackType,
  Correction,
  CorrectionType,
  RawInvoice,
  NormalizedInvoice,
  MemoryContext,
  PatternType,
  CorrectionActionType,
  ConditionOperator,
  ComplexityLevel,
  QualityLevel,
  AuditStep,
  AuditOperation
} from '../types';
import { DatabaseConnection } from '../database/connection';
import { MemoryRepository, createMemoryRepository } from '../database/memory-repository';
import { ConfidenceManager, createConfidenceManager } from './confidence-manager';
import { MemoryFactory } from './memory-base';

/**
 * Configuration for the memory learning engine
 */
export interface MemoryLearningConfig {
  /** Minimum number of similar corrections before creating a pattern */
  minPatternOccurrences: number;
  
  /** Time window for pattern recognition (in days) */
  patternRecognitionWindow: number;
  
  /** Minimum confidence for new memories */
  minNewMemoryConfidence: number;
  
  /** Maximum number of memories to create per learning session */
  maxMemoriesPerSession: number;
  
  /** Enable vendor-specific learning */
  enableVendorSpecificLearning: boolean;
  
  /** Enable correction pattern learning */
  enableCorrectionPatternLearning: boolean;
  
  /** Enable resolution learning */
  enableResolutionLearning: boolean;
  
  /** Learning rate for reinforcement */
  learningRate: number;
  
  /** Threshold for considering corrections as similar */
  similarityThreshold: number;
}

/**
 * Learning strategy types
 */
export enum LearningStrategy {
  /** Learn immediately from each correction */
  IMMEDIATE = 'immediate',
  
  /** Batch learning from multiple corrections */
  BATCH = 'batch',
  
  /** Pattern-based learning from repeated corrections */
  PATTERN_BASED = 'pattern_based'
}

/**
 * Learning outcome tracking
 */
export interface LearningOutcome {
  /** Unique identifier for the learning session */
  sessionId: string;
  
  /** Timestamp of the learning session */
  timestamp: Date;
  
  /** Strategy used for learning */
  strategy: LearningStrategy;
  
  /** Number of corrections processed */
  correctionsProcessed: number;
  
  /** Number of new memories created */
  memoriesCreated: number;
  
  /** Number of existing memories reinforced */
  memoriesReinforced: number;
  
  /** Number of patterns recognized */
  patternsRecognized: number;
  
  /** Overall learning confidence */
  learningConfidence: number;
  
  /** Detailed learning results */
  learningResults: LearningResult[];
  
  /** Reasoning for learning decisions */
  reasoning: string;
}

/**
 * Individual learning result
 */
export interface LearningResult {
  /** Type of learning performed */
  learningType: LearningType;
  
  /** Memory that was created or updated */
  memoryId: string;
  
  /** Confidence in the learning */
  confidence: number;
  
  /** Source corrections that led to this learning */
  sourceCorrections: Correction[];
  
  /** Pattern that was recognized (if applicable) */
  recognizedPattern?: RecognizedPattern;
  
  /** Success of the learning operation */
  success: boolean;
  
  /** Error message if learning failed */
  errorMessage?: string;
}

/**
 * Types of learning operations
 */
export enum LearningType {
  /** Created new vendor memory */
  VENDOR_MEMORY_CREATION = 'vendor_memory_creation',
  
  /** Created new correction memory */
  CORRECTION_MEMORY_CREATION = 'correction_memory_creation',
  
  /** Created new resolution memory */
  RESOLUTION_MEMORY_CREATION = 'resolution_memory_creation',
  
  /** Reinforced existing memory */
  MEMORY_REINFORCEMENT = 'memory_reinforcement',
  
  /** Recognized and learned from pattern */
  PATTERN_LEARNING = 'pattern_learning'
}

/**
 * Recognized pattern in corrections
 */
export interface RecognizedPattern {
  /** Type of pattern */
  patternType: PatternType;
  
  /** Pattern data */
  patternData: Record<string, unknown>;
  
  /** Confidence in pattern recognition */
  confidence: number;
  
  /** Number of occurrences */
  occurrences: number;
  
  /** Vendor specificity */
  vendorSpecific: boolean;
  
  /** Time span of occurrences */
  timeSpan: number;
}

/**
 * Learning metrics for analysis
 */
export interface LearningMetrics {
  /** Total learning sessions */
  totalSessions: number;
  
  /** Total corrections processed */
  totalCorrections: number;
  
  /** Total memories created */
  totalMemoriesCreated: number;
  
  /** Total memories reinforced */
  totalMemoriesReinforced: number;
  
  /** Total patterns recognized */
  totalPatternsRecognized: number;
  
  /** Average learning confidence */
  averageLearningConfidence: number;
  
  /** Learning success rate */
  learningSuccessRate: number;
  
  /** Memory creation rate */
  memoryCreationRate: number;
  
  /** Pattern recognition rate */
  patternRecognitionRate: number;
  
  /** Vendor-specific learning breakdown */
  vendorLearningBreakdown: Record<string, VendorLearningMetrics>;
}

/**
 * Vendor-specific learning metrics
 */
export interface VendorLearningMetrics {
  /** Vendor identifier */
  vendorId: string;
  
  /** Number of corrections for this vendor */
  corrections: number;
  
  /** Number of memories created for this vendor */
  memoriesCreated: number;
  
  /** Number of patterns recognized for this vendor */
  patternsRecognized: number;
  
  /** Average learning confidence for this vendor */
  averageConfidence: number;
}

/**
 * Interface for the memory learning engine
 */
export interface MemoryLearningEngine {
  /**
   * Learn from a processing outcome with human feedback
   * @param outcome Processing outcome containing corrections and feedback
   * @param strategy Learning strategy to use
   * @returns Learning outcome with details of what was learned
   */
  learnFromOutcome(outcome: ProcessingOutcome, strategy?: LearningStrategy): Promise<LearningOutcome>;

  /**
   * Learn from human corrections specifically
   * @param corrections Array of corrections made by humans
   * @param invoice Original invoice that was corrected
   * @param normalizedInvoice Normalized invoice after corrections
   * @param strategy Learning strategy to use
   * @returns Learning outcome
   */
  learnFromCorrections(
    corrections: Correction[],
    invoice: RawInvoice,
    normalizedInvoice: NormalizedInvoice,
    strategy?: LearningStrategy
  ): Promise<LearningOutcome>;

  /**
   * Learn from human approvals (reinforcement)
   * @param appliedMemories Memories that were applied and approved
   * @param outcome Processing outcome
   * @returns Learning outcome
   */
  learnFromApprovals(appliedMemories: Memory[], outcome: ProcessingOutcome): Promise<LearningOutcome>;

  /**
   * Recognize patterns in corrections
   * @param corrections Array of corrections to analyze
   * @param vendorId Optional vendor ID for vendor-specific patterns
   * @returns Recognized patterns
   */
  recognizePatterns(corrections: Correction[], vendorId?: string): Promise<RecognizedPattern[]>;

  /**
   * Create memories from recognized patterns
   * @param patterns Recognized patterns
   * @param context Memory context
   * @returns Created memories
   */
  createMemoriesFromPatterns(patterns: RecognizedPattern[], context: MemoryContext): Promise<Memory[]>;

  /**
   * Get learning metrics
   * @param timeWindow Optional time window for metrics (in days)
   * @returns Learning metrics
   */
  getLearningMetrics(timeWindow?: number): Promise<LearningMetrics>;

  /**
   * Get learning outcomes for a specific time period
   * @param startDate Start date for outcomes
   * @param endDate End date for outcomes
   * @returns Array of learning outcomes
   */
  getLearningOutcomes(startDate: Date, endDate: Date): Promise<LearningOutcome[]>;

  /**
   * Get audit steps for learning operations
   * @returns Array of audit steps
   */
  getAuditSteps(): AuditStep[];

  /**
   * Clear audit steps (for testing)
   */
  clearAuditSteps(): void;
}

/**
 * Implementation of the memory learning engine
 */
export class MemoryLearningEngineImpl implements MemoryLearningEngine {
  private memoryRepository: MemoryRepository;
  private confidenceManager: ConfidenceManager;
  private config: MemoryLearningConfig;
  private auditSteps: AuditStep[] = [];

  constructor(
    db: DatabaseConnection,
    config?: Partial<MemoryLearningConfig>
  ) {
    this.memoryRepository = createMemoryRepository(db);
    this.confidenceManager = createConfidenceManager(db);
    this.config = {
      minPatternOccurrences: 3,
      patternRecognitionWindow: 30,
      minNewMemoryConfidence: 0.4,
      maxMemoriesPerSession: 10,
      enableVendorSpecificLearning: true,
      enableCorrectionPatternLearning: true,
      enableResolutionLearning: true,
      learningRate: 0.1,
      similarityThreshold: 0.6, // Lower threshold for better pattern recognition
      ...config
    };
  }

  /**
   * Learn from a processing outcome with human feedback
   */
  async learnFromOutcome(
    outcome: ProcessingOutcome,
    strategy: LearningStrategy = LearningStrategy.PATTERN_BASED
  ): Promise<LearningOutcome> {
    const startTime = Date.now();
    const sessionId = `learn-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const learningResults: LearningResult[] = [];
    let correctionsProcessed = 0;
    let memoriesCreated = 0;
    let memoriesReinforced = 0;
    let patternsRecognized = 0;

    try {
      // Learn from human feedback if available
      if (outcome.humanFeedback) {
        const feedbackResults = await this.learnFromHumanFeedback(
          outcome.humanFeedback,
          outcome.result,
          strategy
        );
        learningResults.push(...feedbackResults.learningResults);
        correctionsProcessed += feedbackResults.correctionsProcessed;
        memoriesCreated += feedbackResults.memoriesCreated;
        memoriesReinforced += feedbackResults.memoriesReinforced;
        patternsRecognized += feedbackResults.patternsRecognized;
      }

      // Learn from outcome type (reinforcement or penalty)
      if (outcome.result.memoryUpdates && outcome.result.memoryUpdates.length > 0) {
        const reinforcementResults = await this.learnFromMemoryUpdates(
          outcome.result.memoryUpdates,
          outcome
        );
        learningResults.push(...reinforcementResults);
        memoriesReinforced += reinforcementResults.filter(r => r.success).length;
      }

      // Calculate overall learning confidence
      const successfulResults = learningResults.filter(r => r.success);
      const learningConfidence = successfulResults.length > 0
        ? successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length
        : 0;

      // Generate reasoning
      const reasoning = this.generateLearningReasoning(
        strategy,
        correctionsProcessed,
        memoriesCreated,
        memoriesReinforced,
        patternsRecognized,
        learningResults
      );

      // Record audit step
      this.recordAuditStep({
        id: `learn-outcome-${Date.now()}`,
        timestamp: new Date(),
        operation: AuditOperation.MEMORY_LEARNING,
        description: 'Learned from processing outcome',
        input: {
          sessionId,
          strategy,
          outcomeType: outcome.outcomeType,
          hasFeedback: !!outcome.humanFeedback
        },
        output: {
          correctionsProcessed,
          memoriesCreated,
          memoriesReinforced,
          patternsRecognized,
          learningConfidence
        },
        actor: 'MemoryLearningEngine',
        duration: Date.now() - startTime
      });

      return {
        sessionId,
        timestamp: new Date(),
        strategy,
        correctionsProcessed,
        memoriesCreated,
        memoriesReinforced,
        patternsRecognized,
        learningConfidence,
        learningResults,
        reasoning
      };

    } catch (error) {
      // Record error in audit trail
      this.recordAuditStep({
        id: `learn-error-${Date.now()}`,
        timestamp: new Date(),
        operation: AuditOperation.ERROR_HANDLING,
        description: 'Learning from outcome failed',
        input: { sessionId, strategy, error: error instanceof Error ? error.message : 'Unknown error' },
        output: { success: false },
        actor: 'MemoryLearningEngine',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Learn from human corrections specifically
   */
  async learnFromCorrections(
    corrections: Correction[],
    invoice: RawInvoice,
    _normalizedInvoice: NormalizedInvoice,
    strategy: LearningStrategy = LearningStrategy.PATTERN_BASED
  ): Promise<LearningOutcome> {
    const startTime = Date.now();
    const sessionId = `correct-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const learningResults: LearningResult[] = [];
    let memoriesCreated = 0;
    let memoriesReinforced = 0;
    let patternsRecognized = 0;

    try {
      // Create memory context
      const context: MemoryContext = {
        vendorId: invoice.vendorId,
        invoiceCharacteristics: {
          complexity: this.estimateComplexity(invoice),
          language: invoice.metadata?.detectedLanguage || 'en',
          documentFormat: invoice.metadata?.fileFormat || 'unknown',
          extractionQuality: invoice.metadata?.extractionQuality || QualityLevel.GOOD
        },
        historicalContext: {
          recentResults: [],
          trendingPatterns: [],
          seasonalFactors: []
        },
        environmentalFactors: []
      };

      switch (strategy) {
        case LearningStrategy.IMMEDIATE:
          const immediateResults = await this.learnImmediately(corrections, context);
          learningResults.push(...immediateResults);
          break;

        case LearningStrategy.BATCH:
          const batchResults = await this.learnInBatch(corrections, context);
          learningResults.push(...batchResults);
          break;

        case LearningStrategy.PATTERN_BASED:
          // Recognize patterns first
          const patterns = await this.recognizePatterns(corrections, invoice.vendorId);
          patternsRecognized = patterns.length;

          // Create memories from patterns
          if (patterns.length > 0) {
            const patternMemories = await this.createMemoriesFromPatterns(patterns, context);
            for (const memory of patternMemories) {
              await this.memoryRepository.saveMemory(memory);
              const recognizedPattern = patterns.find(p => this.isPatternForMemory(p, memory));
              learningResults.push({
                learningType: this.getLearningTypeForMemory(memory),
                memoryId: memory.id,
                confidence: memory.confidence,
                sourceCorrections: corrections,
                ...(recognizedPattern && { recognizedPattern }),
                success: true
              });
              memoriesCreated++;
            }
          }

          // Also learn individual corrections that don't fit patterns
          const nonPatternCorrections = corrections.filter(c => 
            !patterns.some(p => this.isCorrectionInPattern(c, p))
          );
          if (nonPatternCorrections.length > 0) {
            const individualResults = await this.learnImmediately(nonPatternCorrections, context);
            learningResults.push(...individualResults);
            memoriesCreated += individualResults.filter(r => r.success).length;
          }
          
          // If no patterns were found, learn all corrections individually
          if (patterns.length === 0) {
            const allResults = await this.learnImmediately(corrections, context);
            learningResults.push(...allResults);
            memoriesCreated += allResults.filter(r => r.success).length;
          }
          break;
      }

      // Count successful operations
      memoriesCreated += learningResults.filter(r => 
        r.success && r.learningType.includes('CREATION')
      ).length;
      memoriesReinforced += learningResults.filter(r => 
        r.success && r.learningType === LearningType.MEMORY_REINFORCEMENT
      ).length;

      // Calculate learning confidence
      const successfulResults = learningResults.filter(r => r.success);
      const learningConfidence = successfulResults.length > 0
        ? successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length
        : 0;

      // Generate reasoning
      const reasoning = this.generateLearningReasoning(
        strategy,
        corrections.length,
        memoriesCreated,
        memoriesReinforced,
        patternsRecognized,
        learningResults
      );

      // Record audit step
      this.recordAuditStep({
        id: `learn-corrections-${Date.now()}`,
        timestamp: new Date(),
        operation: AuditOperation.MEMORY_LEARNING,
        description: 'Learned from human corrections',
        input: {
          sessionId,
          strategy,
          correctionsCount: corrections.length,
          vendorId: invoice.vendorId
        },
        output: {
          memoriesCreated,
          memoriesReinforced,
          patternsRecognized,
          learningConfidence
        },
        actor: 'MemoryLearningEngine',
        duration: Date.now() - startTime
      });

      return {
        sessionId,
        timestamp: new Date(),
        strategy,
        correctionsProcessed: corrections.length,
        memoriesCreated,
        memoriesReinforced,
        patternsRecognized,
        learningConfidence,
        learningResults,
        reasoning
      };

    } catch (error) {
      this.recordAuditStep({
        id: `learn-corrections-error-${Date.now()}`,
        timestamp: new Date(),
        operation: AuditOperation.ERROR_HANDLING,
        description: 'Learning from corrections failed',
        input: { sessionId, strategy, error: error instanceof Error ? error.message : 'Unknown error' },
        output: { success: false },
        actor: 'MemoryLearningEngine',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Learn from human approvals (reinforcement)
   */
  async learnFromApprovals(
    appliedMemories: Memory[],
    outcome: ProcessingOutcome
  ): Promise<LearningOutcome> {
    const startTime = Date.now();
    const sessionId = `approve-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    const learningResults: LearningResult[] = [];
    let memoriesReinforced = 0;

    try {
      for (const memory of appliedMemories) {
        try {
          // Reinforce the memory based on successful application
          const newConfidence = this.confidenceManager.reinforceMemory(memory, outcome);
          
          // Update memory confidence
          await this.memoryRepository.updateConfidence(memory.id, newConfidence);
          
          // Update memory usage statistics
          (memory as any).updateUsage(true);
          await this.memoryRepository.saveMemory(memory);

          learningResults.push({
            learningType: LearningType.MEMORY_REINFORCEMENT,
            memoryId: memory.id,
            confidence: newConfidence,
            sourceCorrections: [],
            success: true
          });

          memoriesReinforced++;

        } catch (error) {
          learningResults.push({
            learningType: LearningType.MEMORY_REINFORCEMENT,
            memoryId: memory.id,
            confidence: memory.confidence,
            sourceCorrections: [],
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }

      // Calculate learning confidence
      const successfulResults = learningResults.filter(r => r.success);
      const learningConfidence = successfulResults.length > 0
        ? successfulResults.reduce((sum, r) => sum + r.confidence, 0) / successfulResults.length
        : 0;

      const reasoning = `Reinforced ${memoriesReinforced} memories based on human approval. ` +
        `Success rate: ${(memoriesReinforced / appliedMemories.length * 100).toFixed(1)}%`;

      // Record audit step
      this.recordAuditStep({
        id: `learn-approvals-${Date.now()}`,
        timestamp: new Date(),
        operation: AuditOperation.MEMORY_LEARNING,
        description: 'Learned from human approvals',
        input: {
          sessionId,
          appliedMemoriesCount: appliedMemories.length,
          outcomeType: outcome.outcomeType
        },
        output: {
          memoriesReinforced,
          learningConfidence
        },
        actor: 'MemoryLearningEngine',
        duration: Date.now() - startTime
      });

      return {
        sessionId,
        timestamp: new Date(),
        strategy: LearningStrategy.IMMEDIATE,
        correctionsProcessed: 0,
        memoriesCreated: 0,
        memoriesReinforced,
        patternsRecognized: 0,
        learningConfidence,
        learningResults,
        reasoning
      };

    } catch (error) {
      this.recordAuditStep({
        id: `learn-approvals-error-${Date.now()}`,
        timestamp: new Date(),
        operation: AuditOperation.ERROR_HANDLING,
        description: 'Learning from approvals failed',
        input: { sessionId, error: error instanceof Error ? error.message : 'Unknown error' },
        output: { success: false },
        actor: 'MemoryLearningEngine',
        duration: Date.now() - startTime
      });

      throw error;
    }
  }

  /**
   * Recognize patterns in corrections
   */
  async recognizePatterns(corrections: Correction[], vendorId?: string): Promise<RecognizedPattern[]> {
    const patterns: RecognizedPattern[] = [];

    if (corrections.length < this.config.minPatternOccurrences) {
      return patterns;
    }

    // Group corrections by field and type
    const correctionGroups = this.groupCorrectionsByPattern(corrections);

    for (const [patternKey, groupedCorrections] of correctionGroups.entries()) {
      if (groupedCorrections.length >= this.config.minPatternOccurrences) {
        const pattern = await this.analyzePatternGroup(patternKey, groupedCorrections, vendorId);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    }

    return patterns;
  }

  /**
   * Create memories from recognized patterns
   */
  async createMemoriesFromPatterns(
    patterns: RecognizedPattern[],
    context: MemoryContext
  ): Promise<Memory[]> {
    const memories: Memory[] = [];

    for (const pattern of patterns) {
      try {
        const memory = await this.createMemoryFromPattern(pattern, context);
        if (memory) {
          memories.push(memory);
        }
      } catch (error) {
        console.warn(`Failed to create memory from pattern:`, error);
      }
    }

    return memories.slice(0, this.config.maxMemoriesPerSession);
  }

  /**
   * Get learning metrics
   */
  async getLearningMetrics(timeWindow?: number): Promise<LearningMetrics> {
    // This would query the database for learning outcomes and calculate metrics
    // For now, return a basic implementation
    const totalSessions = await this.getLearningSessionCount(timeWindow);
    
    return {
      totalSessions,
      totalCorrections: 0, // Would be calculated from database
      totalMemoriesCreated: 0,
      totalMemoriesReinforced: 0,
      totalPatternsRecognized: 0,
      averageLearningConfidence: 0,
      learningSuccessRate: 0,
      memoryCreationRate: 0,
      patternRecognitionRate: 0,
      vendorLearningBreakdown: {}
    };
  }

  /**
   * Get learning outcomes for a specific time period
   */
  async getLearningOutcomes(_startDate: Date, _endDate: Date): Promise<LearningOutcome[]> {
    // This would query stored learning outcomes from the database
    // For now, return empty array as this is a basic implementation
    return [];
  }

  /**
   * Get audit steps for learning operations
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

  private async learnFromHumanFeedback(
    feedback: HumanFeedback,
    _result: any,
    strategy: LearningStrategy
  ): Promise<LearningOutcome> {
    const learningResults: LearningResult[] = [];

    switch (feedback.feedbackType) {
      case FeedbackType.APPROVAL:
        // Reinforce memories that were applied successfully
        // This would require tracking which memories were applied
        break;

      case FeedbackType.CORRECTION:
        // Learn from the corrections made
        if (feedback.corrections && feedback.corrections.length > 0) {
          const correctionResults = await this.learnImmediately(
            feedback.corrections,
            this.createContextFromFeedback(feedback)
          );
          learningResults.push(...correctionResults);
        }
        break;

      case FeedbackType.REJECTION:
        // Penalize memories that led to rejection
        break;

      case FeedbackType.IMPROVEMENT_SUGGESTION:
        // Learn from suggestions
        break;
    }

    return {
      sessionId: `feedback-${Date.now()}`,
      timestamp: new Date(),
      strategy,
      correctionsProcessed: feedback.corrections?.length || 0,
      memoriesCreated: learningResults.filter(r => r.learningType.includes('CREATION')).length,
      memoriesReinforced: learningResults.filter(r => r.learningType === LearningType.MEMORY_REINFORCEMENT).length,
      patternsRecognized: 0,
      learningConfidence: learningResults.length > 0 
        ? learningResults.reduce((sum, r) => sum + r.confidence, 0) / learningResults.length 
        : 0,
      learningResults,
      reasoning: `Learned from human feedback: ${feedback.feedbackType}`
    };
  }

  private async learnFromMemoryUpdates(memoryUpdates: any[], outcome: ProcessingOutcome): Promise<LearningResult[]> {
    const results: LearningResult[] = [];

    for (const update of memoryUpdates) {
      try {
        const memory = await this.memoryRepository.findMemoryById(update.memoryId);
        if (memory) {
          const newConfidence = this.confidenceManager.reinforceMemory(memory, outcome);
          await this.memoryRepository.updateConfidence(memory.id, newConfidence);

          results.push({
            learningType: LearningType.MEMORY_REINFORCEMENT,
            memoryId: memory.id,
            confidence: newConfidence,
            sourceCorrections: [],
            success: true
          });
        }
      } catch (error) {
        results.push({
          learningType: LearningType.MEMORY_REINFORCEMENT,
          memoryId: update.memoryId,
          confidence: 0,
          sourceCorrections: [],
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  private async learnImmediately(corrections: Correction[], context: MemoryContext): Promise<LearningResult[]> {
    const results: LearningResult[] = [];

    for (const correction of corrections) {
      try {
        const memory = await this.createMemoryFromCorrection(correction, context);
        if (memory) {
          await this.memoryRepository.saveMemory(memory);
          results.push({
            learningType: this.getLearningTypeForMemory(memory),
            memoryId: memory.id,
            confidence: memory.confidence,
            sourceCorrections: [correction],
            success: true
          });
        } else {
          results.push({
            learningType: LearningType.CORRECTION_MEMORY_CREATION,
            memoryId: '',
            confidence: 0,
            sourceCorrections: [correction],
            success: false,
            errorMessage: 'Failed to create memory from correction'
          });
        }
      } catch (error) {
        results.push({
          learningType: LearningType.CORRECTION_MEMORY_CREATION,
          memoryId: '',
          confidence: 0,
          sourceCorrections: [correction],
          success: false,
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    return results;
  }

  private async learnInBatch(corrections: Correction[], context: MemoryContext): Promise<LearningResult[]> {
    // Group similar corrections and create memories for groups
    const groups = this.groupSimilarCorrections(corrections);
    const results: LearningResult[] = [];

    for (const group of groups) {
      if (group.length >= 2) { // Only create memories for groups with multiple corrections
        try {
          const memory = await this.createMemoryFromCorrectionGroup(group, context);
          if (memory) {
            await this.memoryRepository.saveMemory(memory);
            results.push({
              learningType: this.getLearningTypeForMemory(memory),
              memoryId: memory.id,
              confidence: memory.confidence,
              sourceCorrections: group,
              success: true
            });
          }
        } catch (error) {
          results.push({
            learningType: LearningType.CORRECTION_MEMORY_CREATION,
            memoryId: '',
            confidence: 0,
            sourceCorrections: group,
            success: false,
            errorMessage: error instanceof Error ? error.message : 'Unknown error'
          });
        }
      }
    }

    return results;
  }

  private groupCorrectionsByPattern(corrections: Correction[]): Map<string, Correction[]> {
    const groups = new Map<string, Correction[]>();

    for (const correction of corrections) {
      const patternKey = `${correction.field}-${this.getCorrectionType(correction)}`;
      if (!groups.has(patternKey)) {
        groups.set(patternKey, []);
      }
      groups.get(patternKey)!.push(correction);
    }

    return groups;
  }

  private async analyzePatternGroup(
    patternKey: string,
    corrections: Correction[],
    vendorId?: string
  ): Promise<RecognizedPattern | null> {
    const [field, correctionType] = patternKey.split('-');
    
    // For date fields, we care more about the pattern than the exact values
    if (field === 'serviceDate' || correctionType === 'date') {
      // All corrections for the same field type indicate a pattern
      return {
        patternType: PatternType.FIELD_MAPPING,
        patternData: {
          field,
          correctionType,
          commonValue: corrections[0]?.correctedValue, // Use first value as example
          consistency: 1.0 // High consistency for field mapping patterns
        },
        confidence: 0.8,
        occurrences: corrections.length,
        vendorSpecific: !!vendorId,
        timeSpan: this.calculateTimeSpan(corrections)
      };
    }
    
    // For other fields, check value consistency
    const values = corrections.map(c => String(c.correctedValue));
    const uniqueValues = new Set(values);
    const consistency = 1 - (uniqueValues.size - 1) / corrections.length;
    
    if (consistency >= this.config.similarityThreshold) {
      return {
        patternType: PatternType.FIELD_MAPPING,
        patternData: {
          field,
          correctionType,
          commonValue: this.getMostCommonValue(corrections.map(c => c.correctedValue)),
          consistency
        },
        confidence: Math.min(0.9, 0.5 + consistency * 0.4),
        occurrences: corrections.length,
        vendorSpecific: !!vendorId,
        timeSpan: this.calculateTimeSpan(corrections)
      };
    }

    return null;
  }

  private async createMemoryFromPattern(pattern: RecognizedPattern, context: MemoryContext): Promise<Memory | null> {
    const memoryId = `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    if (pattern.patternType === PatternType.FIELD_MAPPING) {
      const field = pattern.patternData['field'] as string;
      const commonValue = pattern.patternData['commonValue'];
      
      // Create a correction memory for this pattern
      const correctionMemory = MemoryFactory.createCorrectionMemory(
        memoryId,
        {
          patternType: pattern.patternType,
          patternData: pattern.patternData,
          threshold: pattern.confidence
        },
        Math.max(this.config.minNewMemoryConfidence, pattern.confidence),
        context,
        this.mapFieldToCorrectionType(field),
        [
          {
            field,
            operator: ConditionOperator.EXISTS,
            value: true
          }
        ],
        {
          actionType: CorrectionActionType.SET_VALUE,
          targetField: field,
          newValue: commonValue,
          explanation: `Pattern-based correction for ${field} based on ${pattern.occurrences} similar corrections`
        }
      );

      return correctionMemory;
    }

    return null;
  }

  private async createMemoryFromCorrection(correction: Correction, context: MemoryContext): Promise<Memory | null> {
    const memoryId = `correction-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create a correction memory
    const correctionMemory = MemoryFactory.createCorrectionMemory(
      memoryId,
      {
        patternType: PatternType.FIELD_MAPPING,
        patternData: {
          field: correction.field,
          originalValue: correction.originalValue,
          correctedValue: correction.correctedValue
        },
        threshold: correction.confidence
      },
      Math.max(this.config.minNewMemoryConfidence, correction.confidence),
      context,
      this.mapFieldToCorrectionType(correction.field),
      [
        {
          field: correction.field,
          operator: ConditionOperator.EQUALS,
          value: correction.originalValue
        }
      ],
      {
        actionType: CorrectionActionType.SET_VALUE,
        targetField: correction.field,
        newValue: correction.correctedValue,
        explanation: correction.reason
      }
    );

    return correctionMemory;
  }

  private async createMemoryFromCorrectionGroup(corrections: Correction[], context: MemoryContext): Promise<Memory | null> {
    if (corrections.length === 0) return null;

    const firstCorrection = corrections[0]!;
    const memoryId = `group-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Find the most common corrected value
    const correctedValues = corrections.map(c => c.correctedValue);
    const commonValue = this.getMostCommonValue(correctedValues);
    
    // Calculate confidence based on group consistency
    const consistency = correctedValues.filter(v => v === commonValue).length / correctedValues.length;
    const confidence = Math.max(this.config.minNewMemoryConfidence, consistency * 0.8);

    const correctionMemory = MemoryFactory.createCorrectionMemory(
      memoryId,
      {
        patternType: PatternType.FIELD_MAPPING,
        patternData: {
          field: firstCorrection.field,
          groupSize: corrections.length,
          consistency,
          commonValue
        },
        threshold: confidence
      },
      confidence,
      context,
      this.mapFieldToCorrectionType(firstCorrection.field),
      [
        {
          field: firstCorrection.field,
          operator: ConditionOperator.EXISTS,
          value: true
        }
      ],
      {
        actionType: CorrectionActionType.SET_VALUE,
        targetField: firstCorrection.field,
        newValue: commonValue,
        explanation: `Group-based correction for ${firstCorrection.field} from ${corrections.length} similar corrections`
      }
    );

    return correctionMemory;
  }

  private groupSimilarCorrections(corrections: Correction[]): Correction[][] {
    const groups: Correction[][] = [];
    const processed = new Set<number>();

    for (let i = 0; i < corrections.length; i++) {
      if (processed.has(i)) continue;

      const group = [corrections[i]!];
      processed.add(i);

      for (let j = i + 1; j < corrections.length; j++) {
        if (processed.has(j)) continue;

        if (this.areCorrectionsSimila(corrections[i]!, corrections[j]!)) {
          group.push(corrections[j]!);
          processed.add(j);
        }
      }

      groups.push(group);
    }

    return groups;
  }

  private areCorrectionsSimila(correction1: Correction, correction2: Correction): boolean {
    return correction1.field === correction2.field &&
           correction1.correctedValue === correction2.correctedValue;
  }

  private getCorrectionType(correction: Correction): string {
    // Simple heuristic to determine correction type
    if (typeof correction.correctedValue === 'number') {
      return 'numeric';
    } else if (correction.correctedValue instanceof Date) {
      return 'date';
    } else if (typeof correction.correctedValue === 'string') {
      return 'text';
    }
    return 'unknown';
  }

  private getMostCommonValue(values: unknown[]): unknown {
    const counts = new Map<unknown, number>();
    
    for (const value of values) {
      counts.set(value, (counts.get(value) || 0) + 1);
    }

    let maxCount = 0;
    let mostCommon = values[0];

    for (const [value, count] of counts.entries()) {
      if (count > maxCount) {
        maxCount = count;
        mostCommon = value;
      }
    }

    return mostCommon;
  }

  private calculateTimeSpan(_corrections: Correction[]): number {
    // This would calculate the time span of corrections
    // For now, return a default value
    return 1; // 1 day
  }

  private mapFieldToCorrectionType(field: string): CorrectionType {
    switch (field.toLowerCase()) {
      case 'totalamount':
      case 'amount':
        return CorrectionType.PRICE_CORRECTION;
      case 'quantity':
        return CorrectionType.QUANTITY_CORRECTION;
      case 'servicedate':
      case 'invoicedate':
      case 'duedate':
        return CorrectionType.DATE_CORRECTION;
      case 'currency':
        return CorrectionType.CURRENCY_CORRECTION;
      case 'vatamount':
      case 'vat':
        return CorrectionType.VAT_CORRECTION;
      default:
        return CorrectionType.FIELD_MAPPING_CORRECTION;
    }
  }

  private getLearningTypeForMemory(memory: Memory): LearningType {
    switch (memory.type) {
      case MemoryType.VENDOR:
        return LearningType.VENDOR_MEMORY_CREATION;
      case MemoryType.CORRECTION:
        return LearningType.CORRECTION_MEMORY_CREATION;
      case MemoryType.RESOLUTION:
        return LearningType.RESOLUTION_MEMORY_CREATION;
      default:
        return LearningType.CORRECTION_MEMORY_CREATION;
    }
  }

  private isPatternForMemory(pattern: RecognizedPattern, memory: Memory): boolean {
    // Simple check - in a real implementation this would be more sophisticated
    return pattern.patternData['field'] === (memory as any).correctionAction?.targetField;
  }

  private isCorrectionInPattern(correction: Correction, pattern: RecognizedPattern): boolean {
    return correction.field === pattern.patternData['field'];
  }

  private createContextFromFeedback(_feedback: HumanFeedback): MemoryContext {
    return {
      invoiceCharacteristics: {
        complexity: ComplexityLevel.MODERATE,
        language: 'en',
        documentFormat: 'unknown',
        extractionQuality: QualityLevel.GOOD
      },
      historicalContext: {
        recentResults: [],
        trendingPatterns: [],
        seasonalFactors: []
      },
      environmentalFactors: []
    };
  }

  private estimateComplexity(invoice: RawInvoice): ComplexityLevel {
    const fieldCount = invoice.extractedFields.length;
    const textLength = invoice.rawText.length;
    
    if (fieldCount <= 5 && textLength <= 1000) return ComplexityLevel.SIMPLE;
    if (fieldCount <= 10 && textLength <= 3000) return ComplexityLevel.MODERATE;
    if (fieldCount <= 20 && textLength <= 6000) return ComplexityLevel.COMPLEX;
    return ComplexityLevel.VERY_COMPLEX;
  }

  private generateLearningReasoning(
    strategy: LearningStrategy,
    correctionsProcessed: number,
    memoriesCreated: number,
    memoriesReinforced: number,
    patternsRecognized: number,
    learningResults: LearningResult[]
  ): string {
    const parts: string[] = [];

    parts.push(`Used ${strategy} learning strategy`);
    parts.push(`Processed ${correctionsProcessed} corrections`);
    
    if (memoriesCreated > 0) {
      parts.push(`Created ${memoriesCreated} new memories`);
    }
    
    if (memoriesReinforced > 0) {
      parts.push(`Reinforced ${memoriesReinforced} existing memories`);
    }
    
    if (patternsRecognized > 0) {
      parts.push(`Recognized ${patternsRecognized} patterns`);
    }

    const successRate = learningResults.length > 0 
      ? (learningResults.filter(r => r.success).length / learningResults.length * 100).toFixed(1)
      : '0';
    
    parts.push(`Success rate: ${successRate}%`);

    return parts.join('. ') + '.';
  }

  private async getLearningSessionCount(_timeWindow?: number): Promise<number> {
    // This would query the database for learning session count
    // For now, return 0 as this is a basic implementation
    return 0;
  }

  private recordAuditStep(step: AuditStep): void {
    this.auditSteps.push(step);
  }
}

/**
 * Create a memory learning engine instance
 */
export function createMemoryLearningEngine(
  db: DatabaseConnection,
  config?: Partial<MemoryLearningConfig>
): MemoryLearningEngine {
  return new MemoryLearningEngineImpl(db, config);
}