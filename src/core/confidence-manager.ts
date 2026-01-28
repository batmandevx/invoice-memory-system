/**
 * Confidence Management System
 * 
 * Implements confidence calculation algorithms, memory reinforcement/decay,
 * and escalation threshold management for the AI Agent Memory System.
 */

import {
  Memory,
  MemoryType,
  ProcessingOutcome,
  ProcessingOutcomeType,
  ProcessingPerformanceMetrics,
  MemoryContext,
  ComplexityLevel,
  QualityLevel,
  AuditStep,
  AuditOperation
} from '../types';
import { DatabaseConnection } from '../database/connection';

/**
 * Interface for confidence management operations
 */
export interface ConfidenceManager {
  /**
   * Calculate initial confidence for a new memory
   * @param memory Memory to calculate confidence for
   * @returns Initial confidence score (0.0-1.0)
   */
  calculateInitialConfidence(memory: Memory): number;

  /**
   * Reinforce memory confidence based on successful outcomes
   * @param memory Memory to reinforce
   * @param outcome Processing outcome that validates the memory
   * @returns New confidence score (0.0-1.0)
   */
  reinforceMemory(memory: Memory, outcome: ProcessingOutcome): number;

  /**
   * Apply decay to memory confidence based on time since last use
   * @param memory Memory to decay
   * @param timeSinceLastUse Time in milliseconds since last use
   * @returns New confidence score (0.0-1.0)
   */
  decayMemory(memory: Memory, timeSinceLastUse: number): number;

  /**
   * Evaluate overall reliability of a memory
   * @param memory Memory to evaluate
   * @returns Reliability score and analysis
   */
  evaluateMemoryReliability(memory: Memory): ReliabilityScore;

  /**
   * Adjust escalation threshold based on system performance
   * @param performanceMetrics Current system performance metrics
   * @returns New escalation threshold (0.0-1.0)
   */
  adjustEscalationThreshold(performanceMetrics: PerformanceMetrics): Promise<number>;

  /**
   * Get current escalation threshold
   * @returns Current escalation threshold (0.0-1.0)
   */
  getEscalationThreshold(): Promise<number>;

  /**
   * Determine if memory confidence is above escalation threshold
   * @param confidence Confidence score to check
   * @returns True if above threshold (auto-apply), false if below (escalate)
   */
  shouldAutoApply(confidence: number): Promise<boolean>;

  /**
   * Calculate comprehensive confidence for a set of memories
   * @param memories Array of memories to evaluate
   * @param context Processing context
   * @returns Overall confidence calculation
   */
  calculateOverallConfidence(memories: Memory[], context: MemoryContext): ConfidenceCalculation;
}

/**
 * Detailed confidence calculation breakdown
 */
export interface ConfidenceCalculation {
  /** Base confidence from individual memories */
  baseConfidence: number;
  
  /** Reinforcement factor from successful applications */
  reinforcementFactor: number;
  
  /** Decay factor from time since last use */
  decayFactor: number;
  
  /** Reliability bonus from consistent performance */
  reliabilityBonus: number;
  
  /** Contextual adjustment based on current situation */
  contextualAdjustment: number;
  
  /** Final calculated confidence score */
  finalConfidence: number;
  
  /** Detailed reasoning for the calculation */
  reasoning: string;
}

/**
 * Memory reliability assessment
 */
export interface ReliabilityScore {
  /** Overall reliability score (0.0-1.0) */
  score: number;
  
  /** Reliability classification */
  classification: ReliabilityClassification;
  
  /** Factors contributing to reliability */
  factors: ReliabilityFactor[];
  
  /** Recommendations for improving reliability */
  recommendations: string[];
}

/**
 * Reliability classifications
 */
export enum ReliabilityClassification {
  VERY_HIGH = 'very_high',
  HIGH = 'high',
  MODERATE = 'moderate',
  LOW = 'low',
  VERY_LOW = 'very_low'
}

/**
 * Factor contributing to memory reliability
 */
export interface ReliabilityFactor {
  /** Type of reliability factor */
  factorType: ReliabilityFactorType;
  
  /** Impact on reliability (-1.0 to 1.0) */
  impact: number;
  
  /** Description of the factor */
  description: string;
  
  /** Current value of the factor */
  value: number;
}

/**
 * Types of reliability factors
 */
export enum ReliabilityFactorType {
  SUCCESS_RATE = 'success_rate',
  USAGE_FREQUENCY = 'usage_frequency',
  CONSISTENCY = 'consistency',
  RECENCY = 'recency',
  CONTEXT_MATCH = 'context_match',
  VALIDATION_HISTORY = 'validation_history'
}

/**
 * Performance metrics for confidence calculations
 */
export interface PerformanceMetrics extends ProcessingPerformanceMetrics {
  /** Memory-specific metrics */
  memoryMetrics: MemoryPerformanceMetrics;
  
  /** Threshold adjustment history */
  thresholdHistory: ThresholdAdjustment[];
  
  /** Recent confidence trends */
  confidenceTrends: ConfidenceTrend[];
}

/**
 * Memory-specific performance metrics
 */
export interface MemoryPerformanceMetrics {
  /** Average memory confidence */
  averageConfidence: number;
  
  /** Memory utilization rate */
  utilizationRate: number;
  
  /** Memory accuracy rate */
  accuracyRate: number;
  
  /** False positive rate */
  falsePositiveRate: number;
  
  /** False negative rate */
  falseNegativeRate: number;
}

/**
 * Historical threshold adjustment
 */
export interface ThresholdAdjustment {
  /** Timestamp of adjustment */
  timestamp: Date;
  
  /** Previous threshold value */
  previousThreshold: number;
  
  /** New threshold value */
  newThreshold: number;
  
  /** Reason for adjustment */
  reason: string;
  
  /** Performance metrics that triggered adjustment */
  triggeringMetrics: PerformanceMetrics;
}

/**
 * Confidence trend analysis
 */
export interface ConfidenceTrend {
  /** Time period for the trend */
  period: string;
  
  /** Average confidence in period */
  averageConfidence: number;
  
  /** Trend direction */
  trendDirection: 'increasing' | 'decreasing' | 'stable';
  
  /** Confidence variance */
  variance: number;
}

/**
 * Configuration for confidence calculations
 */
export interface ConfidenceConfig {
  /** Base confidence for new memories */
  baseConfidence: number;
  
  /** Maximum reinforcement per success */
  maxReinforcement: number;
  
  /** Decay rate per day */
  decayRatePerDay: number;
  
  /** Minimum confidence threshold */
  minimumConfidence: number;
  
  /** Maximum confidence threshold */
  maximumConfidence: number;
  
  /** Learning rate for confidence updates */
  learningRate: number;
  
  /** Context matching weight */
  contextWeight: number;
  
  /** Success rate weight */
  successRateWeight: number;
  
  /** Recency weight */
  recencyWeight: number;
}

/**
 * Implementation of the ConfidenceManager interface
 */
export class ConfidenceManagerImpl implements ConfidenceManager {
  private db: DatabaseConnection;
  private config: ConfidenceConfig;
  private auditSteps: AuditStep[] = [];

  constructor(db: DatabaseConnection, config?: Partial<ConfidenceConfig>) {
    this.db = db;
    this.config = {
      baseConfidence: 0.5,
      maxReinforcement: 0.1,
      decayRatePerDay: 0.01,
      minimumConfidence: 0.1,
      maximumConfidence: 1.0,
      learningRate: 0.1,
      contextWeight: 0.3,
      successRateWeight: 0.4,
      recencyWeight: 0.3,
      ...config
    };
  }

  /**
   * Calculate initial confidence for a new memory
   */
  public calculateInitialConfidence(memory: Memory): number {
    const startTime = Date.now();
    
    let confidence = this.config.baseConfidence;
    
    // Adjust based on memory type
    switch (memory.type) {
      case MemoryType.VENDOR:
        // Vendor memories start with moderate confidence
        confidence = 0.6;
        break;
      case MemoryType.CORRECTION:
        // Correction memories start with lower confidence until validated
        confidence = 0.4;
        break;
      case MemoryType.RESOLUTION:
        // Resolution memories inherit confidence from human decisions
        confidence = 0.7;
        break;
    }

    // Adjust based on context quality
    const contextAdjustment = this.calculateContextAdjustment(memory.context);
    confidence *= (1 + contextAdjustment);

    // Adjust based on pattern complexity
    const complexityAdjustment = this.calculateComplexityAdjustment(memory.pattern);
    confidence *= (1 + complexityAdjustment);

    // Ensure within bounds
    confidence = Math.max(this.config.minimumConfidence, 
                         Math.min(this.config.maximumConfidence, confidence));

    // Record audit step
    this.recordAuditStep({
      id: `conf-calc-${Date.now()}`,
      timestamp: new Date(),
      operation: AuditOperation.CONFIDENCE_CALCULATION,
      description: 'Initial confidence calculation',
      input: { memoryId: memory.id, memoryType: memory.type },
      output: { initialConfidence: confidence, contextAdjustment, complexityAdjustment },
      actor: 'ConfidenceManager',
      duration: Date.now() - startTime
    });

    return confidence;
  }

  /**
   * Reinforce memory confidence based on successful outcomes
   */
  public reinforceMemory(memory: Memory, outcome: ProcessingOutcome): number {
    const startTime = Date.now();
    
    let reinforcement = 0;
    
    // Calculate reinforcement based on outcome type
    switch (outcome.outcomeType) {
      case ProcessingOutcomeType.SUCCESS_AUTO:
        reinforcement = this.config.maxReinforcement;
        break;
      case ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW:
        reinforcement = this.config.maxReinforcement * 0.7;
        break;
      case ProcessingOutcomeType.FAILED_VALIDATION:
        reinforcement = -this.config.maxReinforcement * 1.5;
        break;
      case ProcessingOutcomeType.ESCALATED:
        reinforcement = -this.config.maxReinforcement * 0.5;
        break;
      case ProcessingOutcomeType.REJECTED:
        reinforcement = -this.config.maxReinforcement * 2.0;
        break;
    }

    // Adjust reinforcement based on human feedback
    if (outcome.humanFeedback) {
      const feedbackMultiplier = outcome.humanFeedback.satisfactionRating / 5.0;
      reinforcement *= feedbackMultiplier;
    }

    // Apply learning rate
    reinforcement *= this.config.learningRate;

    // Calculate new confidence
    const oldConfidence = memory.confidence;
    const newConfidence = Math.max(this.config.minimumConfidence,
                                  Math.min(this.config.maximumConfidence,
                                          oldConfidence + reinforcement));

    // Record audit step
    this.recordAuditStep({
      id: `conf-reinf-${Date.now()}`,
      timestamp: new Date(),
      operation: AuditOperation.CONFIDENCE_CALCULATION,
      description: 'Memory confidence reinforcement',
      input: { 
        memoryId: memory.id, 
        oldConfidence, 
        outcomeType: outcome.outcomeType,
        reinforcement 
      },
      output: { newConfidence },
      actor: 'ConfidenceManager',
      duration: Date.now() - startTime
    });

    return newConfidence;
  }

  /**
   * Apply decay to memory confidence based on time since last use
   */
  public decayMemory(memory: Memory, timeSinceLastUse: number): number {
    const startTime = Date.now();
    
    // Convert milliseconds to days
    const daysSinceLastUse = timeSinceLastUse / (1000 * 60 * 60 * 24);
    
    // Calculate decay amount
    const decayAmount = daysSinceLastUse * this.config.decayRatePerDay;
    
    // Apply decay with exponential function to prevent linear decay
    const decayFactor = Math.exp(-decayAmount);
    
    const oldConfidence = memory.confidence;
    const newConfidence = Math.max(this.config.minimumConfidence,
                                  oldConfidence * decayFactor);

    // Record audit step
    this.recordAuditStep({
      id: `conf-decay-${Date.now()}`,
      timestamp: new Date(),
      operation: AuditOperation.CONFIDENCE_CALCULATION,
      description: 'Memory confidence decay',
      input: { 
        memoryId: memory.id, 
        oldConfidence, 
        daysSinceLastUse,
        decayAmount,
        decayFactor
      },
      output: { newConfidence },
      actor: 'ConfidenceManager',
      duration: Date.now() - startTime
    });

    return newConfidence;
  }

  /**
   * Evaluate overall reliability of a memory
   */
  public evaluateMemoryReliability(memory: Memory): ReliabilityScore {
    const factors: ReliabilityFactor[] = [];
    
    // Success rate factor
    factors.push({
      factorType: ReliabilityFactorType.SUCCESS_RATE,
      impact: (memory.successRate - 0.5) * 2, // Scale to -1 to 1
      description: `Success rate of ${(memory.successRate * 100).toFixed(1)}%`,
      value: memory.successRate
    });

    // Usage frequency factor
    const usageFrequency = memory.usageCount / Math.max(1, this.daysSinceCreation(memory));
    factors.push({
      factorType: ReliabilityFactorType.USAGE_FREQUENCY,
      impact: Math.min(1, usageFrequency / 10), // Normalize to 0-1
      description: `Used ${memory.usageCount} times since creation`,
      value: usageFrequency
    });

    // Recency factor
    const daysSinceLastUse = this.daysSinceLastUse(memory);
    const recencyImpact = Math.max(-1, 1 - (daysSinceLastUse / 30)); // Decay over 30 days
    factors.push({
      factorType: ReliabilityFactorType.RECENCY,
      impact: recencyImpact,
      description: `Last used ${daysSinceLastUse.toFixed(1)} days ago`,
      value: daysSinceLastUse
    });

    // Calculate overall score
    const totalImpact = factors.reduce((sum, factor) => sum + factor.impact, 0);
    const averageImpact = totalImpact / factors.length;
    const score = Math.max(0, Math.min(1, (averageImpact + 1) / 2)); // Scale to 0-1

    // Determine classification
    let classification: ReliabilityClassification;
    if (score >= 0.9) classification = ReliabilityClassification.VERY_HIGH;
    else if (score >= 0.7) classification = ReliabilityClassification.HIGH;
    else if (score >= 0.5) classification = ReliabilityClassification.MODERATE;
    else if (score >= 0.3) classification = ReliabilityClassification.LOW;
    else classification = ReliabilityClassification.VERY_LOW;

    // Generate recommendations
    const recommendations: string[] = [];
    if (memory.successRate < 0.7) {
      recommendations.push('Consider reviewing and refining memory patterns');
    }
    if (daysSinceLastUse > 30) {
      recommendations.push('Memory may be outdated, consider archiving if not used soon');
    }
    if (memory.usageCount < 5) {
      recommendations.push('Memory needs more validation through usage');
    }

    return {
      score,
      classification,
      factors,
      recommendations
    };
  }

  /**
   * Adjust escalation threshold based on system performance
   */
  public async adjustEscalationThreshold(performanceMetrics: PerformanceMetrics): Promise<number> {
    const currentThreshold = await this.getEscalationThreshold();
    let newThreshold = currentThreshold;
    
    // Adjust based on automation rate
    if (performanceMetrics.automationRate < 0.6) {
      // Low automation rate - lower threshold to increase automation
      newThreshold = Math.max(0.3, currentThreshold - 0.05);
    } else if (performanceMetrics.automationRate > 0.9) {
      // Very high automation rate - check if we're being too aggressive
      if (performanceMetrics.successRate < 0.8) {
        // High automation but low success - raise threshold
        newThreshold = Math.min(0.9, currentThreshold + 0.05);
      }
    }

    // Adjust based on human review rate
    if (performanceMetrics.humanReviewRate > 0.5) {
      // Too much human review - lower threshold
      newThreshold = Math.max(0.3, newThreshold - 0.03);
    }

    // Adjust based on memory accuracy
    if (performanceMetrics.memoryMetrics.accuracyRate < 0.7) {
      // Low accuracy - raise threshold to be more conservative
      newThreshold = Math.min(0.9, newThreshold + 0.1);
    }

    // Only update if change is significant
    if (Math.abs(newThreshold - currentThreshold) >= 0.02) {
      await this.setEscalationThreshold(newThreshold);
      
      // Record the adjustment
      const adjustment: ThresholdAdjustment = {
        timestamp: new Date(),
        previousThreshold: currentThreshold,
        newThreshold,
        reason: this.generateThresholdAdjustmentReason(performanceMetrics, currentThreshold, newThreshold),
        triggeringMetrics: performanceMetrics
      };
      
      await this.recordThresholdAdjustment(adjustment);
    }

    return newThreshold;
  }

  /**
   * Get current escalation threshold from database
   */
  public async getEscalationThreshold(): Promise<number> {
    try {
      const config = await this.db.queryOne<{ value: string }>(
        'SELECT value FROM system_config WHERE key = ?',
        ['escalation_threshold']
      );
      
      return config ? parseFloat(config.value) : 0.7; // Default threshold
    } catch (error) {
      // Handle database errors gracefully by returning default threshold
      console.warn('Failed to retrieve escalation threshold from database, using default:', error);
      return 0.7;
    }
  }

  /**
   * Determine if memory confidence is above escalation threshold
   */
  public async shouldAutoApply(confidence: number): Promise<boolean> {
    const threshold = await this.getEscalationThreshold();
    return confidence >= threshold;
  }

  /**
   * Calculate comprehensive confidence for a set of memories
   */
  public calculateOverallConfidence(memories: Memory[], context: MemoryContext): ConfidenceCalculation {
    if (memories.length === 0) {
      return {
        baseConfidence: 0,
        reinforcementFactor: 0,
        decayFactor: 0,
        reliabilityBonus: 0,
        contextualAdjustment: 0,
        finalConfidence: 0,
        reasoning: 'No memories available for confidence calculation'
      };
    }

    // Calculate weighted average confidence
    const totalWeight = memories.reduce((sum, memory) => sum + memory.usageCount + 1, 0);
    const baseConfidence = memories.reduce((sum, memory) => {
      const weight = (memory.usageCount + 1) / totalWeight;
      return sum + (memory.confidence * weight);
    }, 0);

    // Calculate reinforcement factor from success rates
    const averageSuccessRate = memories.reduce((sum, memory) => sum + memory.successRate, 0) / memories.length;
    const reinforcementFactor = (averageSuccessRate - 0.5) * 0.2; // Scale to -0.1 to 0.1

    // Calculate decay factor from recency
    const averageRecency = memories.reduce((sum, memory) => sum + this.daysSinceLastUse(memory), 0) / memories.length;
    const decayFactor = Math.max(-0.2, -averageRecency * 0.01); // Max penalty of -0.2

    // Calculate reliability bonus
    const reliabilityScores = memories.map(memory => this.evaluateMemoryReliability(memory).score);
    const averageReliability = reliabilityScores.reduce((sum, score) => sum + score, 0) / reliabilityScores.length;
    const reliabilityBonus = (averageReliability - 0.5) * 0.1; // Scale to -0.05 to 0.05

    // Calculate contextual adjustment
    const contextualAdjustment = this.calculateContextualAdjustment(memories, context);

    // Calculate final confidence
    const finalConfidence = Math.max(0, Math.min(1, 
      baseConfidence + reinforcementFactor + decayFactor + reliabilityBonus + contextualAdjustment
    ));

    // Generate reasoning
    const reasoning = this.generateConfidenceReasoning({
      baseConfidence,
      reinforcementFactor,
      decayFactor,
      reliabilityBonus,
      contextualAdjustment,
      finalConfidence,
      reasoning: ''
    }, memories.length);

    return {
      baseConfidence,
      reinforcementFactor,
      decayFactor,
      reliabilityBonus,
      contextualAdjustment,
      finalConfidence,
      reasoning
    };
  }

  /**
   * Get audit steps for confidence calculations
   */
  public getAuditSteps(): AuditStep[] {
    return [...this.auditSteps];
  }

  /**
   * Clear audit steps (for testing)
   */
  public clearAuditSteps(): void {
    this.auditSteps = [];
  }

  // Private helper methods

  private calculateContextAdjustment(context: MemoryContext): number {
    let adjustment = 0;

    // Adjust based on extraction quality
    switch (context.invoiceCharacteristics.extractionQuality) {
      case QualityLevel.EXCELLENT:
        adjustment += 0.1;
        break;
      case QualityLevel.GOOD:
        adjustment += 0.05;
        break;
      case QualityLevel.FAIR:
        adjustment -= 0.05;
        break;
      case QualityLevel.POOR:
        adjustment -= 0.1;
        break;
    }

    // Adjust based on complexity
    switch (context.invoiceCharacteristics.complexity) {
      case ComplexityLevel.SIMPLE:
        adjustment += 0.05;
        break;
      case ComplexityLevel.MODERATE:
        adjustment += 0.02;
        break;
      case ComplexityLevel.COMPLEX:
        adjustment -= 0.02;
        break;
      case ComplexityLevel.VERY_COMPLEX:
        adjustment -= 0.05;
        break;
    }

    return adjustment;
  }

  private calculateComplexityAdjustment(pattern: any): number {
    // Simple heuristic based on pattern data complexity
    const patternDataSize = JSON.stringify(pattern.patternData).length;
    
    if (patternDataSize < 100) return 0.05; // Simple patterns are more reliable
    if (patternDataSize < 500) return 0.02;
    if (patternDataSize < 1000) return -0.02;
    return -0.05; // Complex patterns are less reliable initially
  }

  private calculateContextualAdjustment(memories: Memory[], context: MemoryContext): number {
    let adjustment = 0;

    // Vendor match bonus
    const vendorMatches = memories.filter(memory => 
      memory.context.vendorId === context.vendorId
    ).length;
    const vendorMatchRatio = vendorMatches / memories.length;
    adjustment += vendorMatchRatio * 0.1;

    // Language match bonus
    const languageMatches = memories.filter(memory =>
      memory.context.invoiceCharacteristics.language === context.invoiceCharacteristics.language
    ).length;
    const languageMatchRatio = languageMatches / memories.length;
    adjustment += languageMatchRatio * 0.05;

    return Math.min(0.2, adjustment); // Cap at 0.2
  }

  private daysSinceCreation(memory: Memory): number {
    return (Date.now() - memory.createdAt.getTime()) / (1000 * 60 * 60 * 24);
  }

  private daysSinceLastUse(memory: Memory): number {
    return (Date.now() - memory.lastUsed.getTime()) / (1000 * 60 * 60 * 24);
  }

  private async setEscalationThreshold(threshold: number): Promise<void> {
    await this.db.execute(
      'UPDATE system_config SET value = ? WHERE key = ?',
      [threshold.toString(), 'escalation_threshold']
    );
  }

  private async recordThresholdAdjustment(adjustment: ThresholdAdjustment): Promise<void> {
    // Store in a hypothetical threshold_adjustments table
    // For now, we'll just log it (in a real implementation, we'd store this)
    console.log('Threshold adjustment recorded:', adjustment);
  }

  private generateThresholdAdjustmentReason(
    metrics: PerformanceMetrics, 
    oldThreshold: number, 
    newThreshold: number
  ): string {
    const reasons: string[] = [];
    
    if (metrics.automationRate < 0.6) {
      reasons.push('low automation rate');
    }
    if (metrics.humanReviewRate > 0.5) {
      reasons.push('high human review rate');
    }
    if (metrics.memoryMetrics.accuracyRate < 0.7) {
      reasons.push('low memory accuracy');
    }
    
    const direction = newThreshold > oldThreshold ? 'increased' : 'decreased';
    return `Threshold ${direction} from ${oldThreshold.toFixed(3)} to ${newThreshold.toFixed(3)} due to: ${reasons.join(', ')}`;
  }

  private generateConfidenceReasoning(calc: ConfidenceCalculation, memoryCount: number): string {
    const parts: string[] = [];
    
    parts.push(`Base confidence: ${calc.baseConfidence.toFixed(3)} (from ${memoryCount} memories)`);
    
    if (calc.reinforcementFactor !== 0) {
      const direction = calc.reinforcementFactor > 0 ? 'positive' : 'negative';
      parts.push(`${direction} reinforcement: ${calc.reinforcementFactor.toFixed(3)}`);
    }
    
    if (calc.decayFactor !== 0) {
      parts.push(`decay adjustment: ${calc.decayFactor.toFixed(3)}`);
    }
    
    if (calc.reliabilityBonus !== 0) {
      parts.push(`reliability bonus: ${calc.reliabilityBonus.toFixed(3)}`);
    }
    
    if (calc.contextualAdjustment !== 0) {
      parts.push(`contextual adjustment: ${calc.contextualAdjustment.toFixed(3)}`);
    }
    
    return parts.join(', ') + ` = ${calc.finalConfidence.toFixed(3)}`;
  }

  private recordAuditStep(step: AuditStep): void {
    this.auditSteps.push(step);
  }
}

/**
 * Create a confidence manager instance
 */
export function createConfidenceManager(
  db: DatabaseConnection, 
  config?: Partial<ConfidenceConfig>
): ConfidenceManager {
  return new ConfidenceManagerImpl(db, config);
}