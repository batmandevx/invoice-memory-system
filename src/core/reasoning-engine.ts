/**
 * Reasoning Engine for AI Agent Memory System
 * 
 * Provides detailed reasoning and explanation generation for all memory operations,
 * decisions, and applications. Ensures transparency and auditability by generating
 * human-readable explanations for every action taken by the memory system.
 */

import {
  Memory,
  MemoryType,
  VendorMemory,
  RawInvoice,
  NormalizedInvoice,
  Decision,
  DecisionType,
  RiskLevel,
  RiskAssessment,
  MemoryUpdate,
  ProcessingOutcome
} from '../types';
import { AppliedMemory, FailedMemory, ResolvedConflict } from './memory-application';

// Local type definitions for types referenced in function signatures
type IssueSeverity = 'critical' | 'high' | 'medium' | 'low';
type ValidationIssue = { severity: IssueSeverity; description: string; field?: string };

/**
 * Detailed reasoning for memory selection and application
 */
export interface MemorySelectionReasoning {
  /** Why this memory was selected */
  selectionReason: string;

  /** Confidence factors that influenced selection */
  confidenceFactors: string[];

  /** Context factors that made this memory relevant */
  contextFactors: string[];

  /** Why other memories were not selected */
  rejectionReasons: string[];

  /** Risk factors considered */
  riskFactors: string[];
}

/**
 * Detailed reasoning for decision making
 */
export interface DecisionReasoning {
  /** Primary reason for the decision */
  primaryReason: string;

  /** Confidence analysis */
  confidenceAnalysis: string;

  /** Risk assessment reasoning */
  riskAnalysis: string;

  /** Memory influence on decision */
  memoryInfluence: string;

  /** Validation issues impact */
  validationImpact: string;

  /** Alternative decisions considered */
  alternativesConsidered: string[];

  /** Final decision justification */
  finalJustification: string;
}

/**
 * Detailed reasoning for memory application
 */
export interface ApplicationReasoning {
  /** Why memories were applied */
  applicationJustification: string;

  /** Field mapping explanations */
  fieldMappingExplanations: FieldMappingExplanation[];

  /** Correction explanations */
  correctionExplanations: CorrectionExplanation[];

  /** Conflict resolution explanations */
  conflictResolutions: ConflictResolutionExplanation[];

  /** Validation reasoning */
  validationReasoning: string;

  /** Overall application summary */
  applicationSummary: string;
}

/**
 * Explanation for field mapping operations
 */
export interface FieldMappingExplanation {
  /** Source field name */
  sourceField: string;

  /** Target field name */
  targetField: string;

  /** Original value */
  originalValue: unknown;

  /** Transformed value */
  transformedValue: unknown;

  /** Memory that provided the mapping */
  memoryId: string;

  /** Confidence in the mapping */
  confidence: number;

  /** Detailed explanation of the transformation */
  explanation: string;

  /** Why this mapping was chosen */
  selectionReason: string;
}

/**
 * Explanation for correction operations
 */
export interface CorrectionExplanation {
  /** Field being corrected */
  field: string;

  /** Original value */
  originalValue: unknown;

  /** Corrected value */
  correctedValue: unknown;

  /** Memory that suggested the correction */
  memoryId: string;

  /** Confidence in the correction */
  confidence: number;

  /** Detailed explanation of why correction was needed */
  explanation: string;

  /** Pattern or rule that triggered the correction */
  triggerPattern: string;

  /** Historical context for this correction */
  historicalContext: string;
}

/**
 * Explanation for conflict resolution
 */
export interface ConflictResolutionExplanation {
  /** Type of conflict */
  conflictType: string;

  /** Memories involved in conflict */
  conflictingMemoryIds: string[];

  /** Selected memory */
  selectedMemoryId: string;

  /** Resolution strategy used */
  resolutionStrategy: string;

  /** Detailed explanation of resolution */
  explanation: string;

  /** Why other memories were rejected */
  rejectionReasons: string[];
}

/**
 * Interface for the reasoning engine
 */
export interface ReasoningEngine {
  /**
   * Generate detailed reasoning for memory selection
   * @param selectedMemories Memories that were selected
   * @param rejectedMemories Memories that were considered but rejected
   * @param invoice Invoice context
   * @returns Detailed selection reasoning
   */
  generateMemorySelectionReasoning(
    selectedMemories: Memory[],
    rejectedMemories: Memory[],
    invoice: RawInvoice
  ): MemorySelectionReasoning;

  /**
   * Generate detailed reasoning for decision making
   * @param decision Decision that was made
   * @param context Decision context
   * @param appliedMemories Memories that influenced the decision
   * @param validationIssues Any validation issues
   * @returns Detailed decision reasoning
   */
  generateDecisionReasoning(
    decision: Decision,
    context: {
      invoice: NormalizedInvoice;
      confidence: number;
      escalationThreshold: number;
    },
    appliedMemories: Memory[],
    validationIssues: ValidationIssue[]
  ): DecisionReasoning;

  /**
   * Generate detailed reasoning for memory application
   * @param appliedMemories Successfully applied memories
   * @param failedMemories Failed memory applications
   * @param resolvedConflicts Resolved conflicts
   * @param invoice Invoice being processed
   * @returns Detailed application reasoning
   */
  generateApplicationReasoning(
    appliedMemories: AppliedMemory[],
    failedMemories: FailedMemory[],
    resolvedConflicts: ResolvedConflict[],
    invoice: RawInvoice
  ): ApplicationReasoning;

  /**
   * Generate human-readable summary of all operations
   * @param memoryReasoning Memory selection reasoning
   * @param applicationReasoning Application reasoning
   * @param decisionReasoning Decision reasoning
   * @returns Comprehensive human-readable summary
   */
  generateComprehensiveSummary(
    memoryReasoning: MemorySelectionReasoning,
    applicationReasoning: ApplicationReasoning,
    decisionReasoning: DecisionReasoning
  ): string;

  /**
   * Generate explanation for why memories were ignored
   * @param ignoredMemories Memories that were available but not used
   * @param invoice Invoice context
   * @returns Explanation of why memories were ignored
   */
  generateIgnoredMemoryExplanation(
    ignoredMemories: Memory[],
    invoice: RawInvoice
  ): string;

  /**
   * Generate reasoning for learning outcomes
   * @param outcome Processing outcome
   * @param memoryUpdates Memory updates that resulted
   * @returns Learning reasoning
   */
  generateLearningReasoning(
    outcome: ProcessingOutcome,
    memoryUpdates: MemoryUpdate[]
  ): string;
}

/**
 * Implementation of the reasoning engine
 */
export class ReasoningEngineImpl implements ReasoningEngine {

  /**
   * Generate detailed reasoning for memory selection
   */
  generateMemorySelectionReasoning(
    selectedMemories: Memory[],
    rejectedMemories: Memory[],
    invoice: RawInvoice
  ): MemorySelectionReasoning {
    const selectionReasons: string[] = [];
    const confidenceFactors: string[] = [];
    const contextFactors: string[] = [];
    const rejectionReasons: string[] = [];
    const riskFactors: string[] = [];

    // Analyze selected memories
    if (selectedMemories.length === 0) {
      selectionReasons.push('No memories were selected due to insufficient confidence or relevance');
    } else {
      selectionReasons.push(`Selected ${selectedMemories.length} memories based on confidence and relevance criteria`);

      // Analyze confidence factors
      const avgConfidence = selectedMemories.reduce((sum, m) => sum + m.confidence, 0) / selectedMemories.length;
      confidenceFactors.push(`Average confidence of selected memories: ${(avgConfidence * 100).toFixed(1)}%`);

      const highConfidenceCount = selectedMemories.filter(m => m.confidence >= 0.8).length;
      if (highConfidenceCount > 0) {
        confidenceFactors.push(`${highConfidenceCount} high-confidence memories (≥80%) included`);
      }

      // Analyze context factors
      const vendorMemories = selectedMemories.filter(m => m.type === MemoryType.VENDOR);
      const correctionMemories = selectedMemories.filter(m => m.type === MemoryType.CORRECTION);
      const resolutionMemories = selectedMemories.filter(m => m.type === MemoryType.RESOLUTION);

      if (vendorMemories.length > 0) {
        contextFactors.push(`${vendorMemories.length} vendor-specific memories matched for ${invoice.vendorId}`);
      }
      if (correctionMemories.length > 0) {
        contextFactors.push(`${correctionMemories.length} correction patterns applicable to invoice structure`);
      }
      if (resolutionMemories.length > 0) {
        contextFactors.push(`${resolutionMemories.length} resolution memories available for discrepancy handling`);
      }

      // Analyze usage patterns
      const recentlyUsedCount = selectedMemories.filter(
        m => m.lastUsed && (Date.now() - m.lastUsed.getTime()) < 30 * 24 * 60 * 60 * 1000 // 30 days
      ).length;
      if (recentlyUsedCount > 0) {
        contextFactors.push(`${recentlyUsedCount} memories have been successfully used recently`);
      }
    }

    // Analyze rejected memories
    if (rejectedMemories.length > 0) {
      const lowConfidenceCount = rejectedMemories.filter(m => m.confidence < 0.3).length;
      const irrelevantCount = rejectedMemories.filter(m => !this.isMemoryRelevant(m, invoice)).length;
      const outdatedCount = rejectedMemories.filter(m => this.isMemoryOutdated(m)).length;

      if (lowConfidenceCount > 0) {
        rejectionReasons.push(`${lowConfidenceCount} memories rejected due to low confidence (<30%)`);
      }
      if (irrelevantCount > 0) {
        rejectionReasons.push(`${irrelevantCount} memories rejected as irrelevant to current invoice context`);
      }
      if (outdatedCount > 0) {
        rejectionReasons.push(`${outdatedCount} memories rejected as outdated or unused for extended period`);
      }
    }

    // Analyze risk factors
    const untriedMemories = selectedMemories.filter(m => m.usageCount === 0);
    if (untriedMemories.length > 0) {
      riskFactors.push(`${untriedMemories.length} untested memories included - may require validation`);
    }

    const lowSuccessRateMemories = selectedMemories.filter(m => m.successRate < 0.7);
    if (lowSuccessRateMemories.length > 0) {
      riskFactors.push(`${lowSuccessRateMemories.length} memories with success rate <70% included`);
    }

    return {
      selectionReason: selectionReasons.join('. '),
      confidenceFactors,
      contextFactors,
      rejectionReasons,
      riskFactors
    };
  }

  /**
   * Generate detailed reasoning for decision making
   */
  generateDecisionReasoning(
    decision: Decision,
    context: {
      invoice: NormalizedInvoice;
      confidence: number;
      escalationThreshold: number;
    },
    appliedMemories: Memory[],
    validationIssues: ValidationIssue[]
  ): DecisionReasoning {
    const confidencePercent = (context.confidence * 100).toFixed(1);
    const thresholdPercent = (context.escalationThreshold * 100).toFixed(1);

    // Primary reason analysis
    let primaryReason: string;
    switch (decision.decisionType) {
      case DecisionType.AUTO_APPROVE:
        primaryReason = `Auto-approval granted due to high confidence (${confidencePercent}%) and acceptable risk level`;
        break;
      case DecisionType.HUMAN_REVIEW_REQUIRED:
        if (context.confidence < context.escalationThreshold) {
          primaryReason = `Human review required due to confidence ${confidencePercent}% below threshold ${thresholdPercent}%`;
        } else {
          primaryReason = `Human review required due to risk factors despite adequate confidence`;
        }
        break;
      case DecisionType.ESCALATE_TO_EXPERT:
        primaryReason = `Expert escalation required due to high complexity or critical risk factors`;
        break;
      case DecisionType.REJECT_INVOICE:
        primaryReason = `Invoice rejected due to critical validation failures or extremely low confidence`;
        break;
      case DecisionType.REQUEST_ADDITIONAL_INFO:
        primaryReason = `Additional information requested due to insufficient data for reliable processing`;
        break;
      default:
        primaryReason = `Decision made based on system analysis`;
    }

    // Confidence analysis
    const confidenceAnalysis = this.generateConfidenceAnalysis(context.confidence, context.escalationThreshold, appliedMemories);

    // Risk analysis
    const riskAnalysis = this.generateRiskAnalysis(decision.riskAssessment);

    // Memory influence analysis
    const memoryInfluence = this.generateMemoryInfluenceAnalysis(appliedMemories);

    // Validation impact analysis
    const validationImpact = this.generateValidationImpactAnalysis(validationIssues);

    // Alternative decisions considered
    const alternativesConsidered = this.generateAlternativesAnalysis(decision, context, validationIssues);

    // Final justification
    const finalJustification = this.generateFinalJustification(decision, context, appliedMemories, validationIssues);

    return {
      primaryReason,
      confidenceAnalysis,
      riskAnalysis,
      memoryInfluence,
      validationImpact,
      alternativesConsidered,
      finalJustification
    };
  }

  /**
   * Generate detailed reasoning for memory application
   */
  generateApplicationReasoning(
    appliedMemories: AppliedMemory[],
    failedMemories: FailedMemory[],
    resolvedConflicts: ResolvedConflict[],
    invoice: RawInvoice
  ): ApplicationReasoning {
    // Application justification
    const applicationJustification = this.generateApplicationJustification(appliedMemories, failedMemories);

    // Field mapping explanations
    const fieldMappingExplanations = this.generateFieldMappingExplanations(appliedMemories);

    // Correction explanations
    const correctionExplanations = this.generateCorrectionExplanations(appliedMemories);

    // Conflict resolution explanations
    const conflictResolutions = this.generateConflictResolutionExplanations(resolvedConflicts);

    // Validation reasoning
    const validationReasoning = this.generateValidationReasoning(appliedMemories, failedMemories);

    // Overall application summary
    const applicationSummary = this.generateApplicationSummary(
      appliedMemories,
      failedMemories,
      resolvedConflicts,
      invoice
    );

    return {
      applicationJustification,
      fieldMappingExplanations,
      correctionExplanations,
      conflictResolutions,
      validationReasoning,
      applicationSummary
    };
  }

  /**
   * Generate human-readable summary of all operations
   */
  generateComprehensiveSummary(
    memoryReasoning: MemorySelectionReasoning,
    applicationReasoning: ApplicationReasoning,
    decisionReasoning: DecisionReasoning
  ): string {
    const sections: string[] = [];

    // Memory Selection Summary
    sections.push(`MEMORY SELECTION: ${memoryReasoning.selectionReason}`);
    if (memoryReasoning.confidenceFactors.length > 0) {
      sections.push(`Confidence factors: ${memoryReasoning.confidenceFactors.join('; ')}`);
    }
    if (memoryReasoning.contextFactors.length > 0) {
      sections.push(`Context factors: ${memoryReasoning.contextFactors.join('; ')}`);
    }

    // Application Summary
    sections.push(`MEMORY APPLICATION: ${applicationReasoning.applicationSummary}`);
    if (applicationReasoning.fieldMappingExplanations.length > 0) {
      const mappingCount = applicationReasoning.fieldMappingExplanations.length;
      sections.push(`Applied ${mappingCount} field mappings with detailed transformations`);
    }
    if (applicationReasoning.correctionExplanations.length > 0) {
      const correctionCount = applicationReasoning.correctionExplanations.length;
      sections.push(`Generated ${correctionCount} corrections based on learned patterns`);
    }

    // Decision Summary
    sections.push(`DECISION: ${decisionReasoning.primaryReason}`);
    sections.push(`Confidence analysis: ${decisionReasoning.confidenceAnalysis}`);
    sections.push(`Risk analysis: ${decisionReasoning.riskAnalysis}`);

    // Final justification
    sections.push(`CONCLUSION: ${decisionReasoning.finalJustification}`);

    return sections.join('. ') + '.';
  }

  /**
   * Generate explanation for why memories were ignored
   */
  generateIgnoredMemoryExplanation(
    ignoredMemories: Memory[],
    invoice: RawInvoice
  ): string {
    if (ignoredMemories.length === 0) {
      return 'All available memories were considered and either applied or properly rejected based on relevance and confidence criteria.';
    }

    const explanations: string[] = [];

    // Group by reason for ignoring
    const lowConfidence = ignoredMemories.filter(m => m.confidence < 0.3);
    const irrelevant = ignoredMemories.filter(m => !this.isMemoryRelevant(m, invoice));
    const outdated = ignoredMemories.filter(m => this.isMemoryOutdated(m));
    const lowSuccess = ignoredMemories.filter(m => m.successRate < 0.5);

    if (lowConfidence.length > 0) {
      explanations.push(`${lowConfidence.length} memories ignored due to confidence below 30% threshold`);
    }
    if (irrelevant.length > 0) {
      explanations.push(`${irrelevant.length} memories ignored as irrelevant to vendor ${invoice.vendorId} or invoice pattern`);
    }
    if (outdated.length > 0) {
      explanations.push(`${outdated.length} memories ignored due to extended period without successful application`);
    }
    if (lowSuccess.length > 0) {
      explanations.push(`${lowSuccess.length} memories ignored due to poor historical success rate (<50%)`);
    }

    return `${ignoredMemories.length} memories were ignored: ${explanations.join('; ')}.`;
  }

  /**
   * Generate reasoning for learning outcomes
   */
  generateLearningReasoning(
    outcome: ProcessingOutcome,
    memoryUpdates: MemoryUpdate[]
  ): string {
    const reasoningParts: string[] = [];

    // Analyze outcome type
    switch (outcome.outcome) {
      case 'approved':
        reasoningParts.push('Processing outcome was approved, reinforcing applied memories');
        break;
      case 'rejected':
        reasoningParts.push('Processing outcome was rejected, requiring memory confidence adjustments');
        break;
      case 'corrected':
        reasoningParts.push('Human corrections were applied, creating new learning opportunities');
        break;
      default:
        reasoningParts.push('Processing outcome analyzed for learning opportunities');
    }

    // Analyze memory updates
    if (memoryUpdates.length > 0) {
      const newMemories = memoryUpdates.filter(u => u.updateType === 'created').length;
      const updatedMemories = memoryUpdates.filter(u => u.updateType === 'updated').length;
      const archivedMemories = memoryUpdates.filter(u => u.updateType === 'archived').length;

      if (newMemories > 0) {
        reasoningParts.push(`${newMemories} new memories created from human corrections and patterns`);
      }
      if (updatedMemories > 0) {
        reasoningParts.push(`${updatedMemories} existing memories updated with confidence adjustments`);
      }
      if (archivedMemories > 0) {
        reasoningParts.push(`${archivedMemories} low-performing memories archived for quality maintenance`);
      }
    } else {
      reasoningParts.push('No memory updates required - existing memories performed as expected');
    }

    // Add human decision context if available
    if (outcome.humanDecision) {
      const decision = outcome.humanDecision;
      reasoningParts.push(`Human decision: ${decision.decision} with confidence ${(decision.confidence * 100).toFixed(1)}%`);
      if (decision.reasoning) {
        reasoningParts.push(`Human reasoning: "${decision.reasoning}"`);
      }
    }

    return reasoningParts.join('. ') + '.';
  }

  // Private helper methods

  private isMemoryRelevant(memory: Memory, invoice: RawInvoice): boolean {
    // Check vendor relevance
    if (memory.type === MemoryType.VENDOR) {
      const vendorMemory = memory as VendorMemory;
      return vendorMemory.vendorId === invoice.vendorId;
    }

    // For correction and resolution memories, check pattern relevance
    // This is a simplified check - in practice would be more sophisticated
    return memory.context.vendorId === invoice.vendorId ||
      memory.context.vendorId === 'all' ||
      memory.usageCount > 5; // Well-established patterns
  }

  private isMemoryOutdated(memory: Memory): boolean {
    if (!memory.lastUsed) {
      return memory.usageCount === 0 &&
        (Date.now() - memory.createdAt.getTime()) > 90 * 24 * 60 * 60 * 1000; // 90 days
    }

    // Consider outdated if not used in 60 days and has low success rate
    const daysSinceLastUse = (Date.now() - memory.lastUsed.getTime()) / (24 * 60 * 60 * 1000);
    return daysSinceLastUse > 60 && memory.successRate < 0.6;
  }

  private generateConfidenceAnalysis(
    confidence: number,
    threshold: number,
    appliedMemories: Memory[]
  ): string {
    const parts: string[] = [];

    parts.push(`Overall processing confidence: ${(confidence * 100).toFixed(1)}%`);
    parts.push(`Escalation threshold: ${(threshold * 100).toFixed(1)}%`);

    if (appliedMemories.length > 0) {
      const avgMemoryConfidence = appliedMemories.reduce((sum, m) => sum + m.confidence, 0) / appliedMemories.length;
      parts.push(`Average memory confidence: ${(avgMemoryConfidence * 100).toFixed(1)}%`);

      const highConfidenceCount = appliedMemories.filter(m => m.confidence >= 0.8).length;
      if (highConfidenceCount > 0) {
        parts.push(`${highConfidenceCount} high-confidence memories contributed to decision`);
      }
    } else {
      parts.push('No memories applied - decision based on default processing logic');
    }

    return parts.join('; ');
  }

  private generateRiskAnalysis(riskAssessment: { riskLevel: RiskLevel; riskFactors: any[]; mitigationStrategies: string[] }): string {
    const parts: string[] = [];

    parts.push(`Risk level assessed as ${riskAssessment.riskLevel}`);

    if (riskAssessment.riskFactors.length > 0) {
      parts.push(`${riskAssessment.riskFactors.length} risk factors identified`);

      // Categorize risk factors
      const riskTypes = riskAssessment.riskFactors.reduce((acc: Record<string, number>, factor: any) => {
        acc[factor.riskType] = (acc[factor.riskType] || 0) + 1;
        return acc;
      }, {});

      const riskSummary = Object.entries(riskTypes)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      parts.push(`Risk types: ${riskSummary}`);
    }

    if (riskAssessment.mitigationStrategies.length > 0) {
      parts.push(`${riskAssessment.mitigationStrategies.length} mitigation strategies available`);
    }

    return parts.join('; ');
  }

  private generateMemoryInfluenceAnalysis(appliedMemories: Memory[]): string {
    if (appliedMemories.length === 0) {
      return 'No memories influenced the decision - processed using default logic';
    }

    const parts: string[] = [];

    // Analyze by memory type
    const vendorCount = appliedMemories.filter(m => m.type === MemoryType.VENDOR).length;
    const correctionCount = appliedMemories.filter(m => m.type === MemoryType.CORRECTION).length;
    const resolutionCount = appliedMemories.filter(m => m.type === MemoryType.RESOLUTION).length;

    const influences: string[] = [];
    if (vendorCount > 0) influences.push(`${vendorCount} vendor patterns`);
    if (correctionCount > 0) influences.push(`${correctionCount} correction patterns`);
    if (resolutionCount > 0) influences.push(`${resolutionCount} resolution patterns`);

    parts.push(`Decision influenced by ${influences.join(', ')}`);

    // Analyze confidence impact
    const highImpactMemories = appliedMemories.filter(m => m.confidence >= 0.8 && m.usageCount >= 3);
    if (highImpactMemories.length > 0) {
      parts.push(`${highImpactMemories.length} high-impact memories with proven track record`);
    }

    return parts.join('; ');
  }

  private generateValidationImpactAnalysis(validationIssues: ValidationIssue[]): string {
    if (validationIssues.length === 0) {
      return 'No validation issues detected - all checks passed successfully';
    }

    const critical = validationIssues.filter(i => i.severity === IssueSeverity.CRITICAL).length;
    const errors = validationIssues.filter(i => i.severity === IssueSeverity.ERROR).length;
    const warnings = validationIssues.filter(i => i.severity === IssueSeverity.WARNING).length;

    const parts: string[] = [];

    if (critical > 0) parts.push(`${critical} critical issues`);
    if (errors > 0) parts.push(`${errors} errors`);
    if (warnings > 0) parts.push(`${warnings} warnings`);

    return `Validation found ${parts.join(', ')} requiring attention`;
  }

  private generateAlternativesAnalysis(
    decision: Decision,
    context: { confidence: number; escalationThreshold: number },
    validationIssues: ValidationIssue[]
  ): string[] {
    const alternatives: string[] = [];

    const criticalIssues = validationIssues.filter(i => i.severity === IssueSeverity.CRITICAL).length;

    switch (decision.decisionType) {
      case DecisionType.AUTO_APPROVE:
        if (context.confidence < 0.9) {
          alternatives.push('Human review was considered due to moderate confidence but risk assessment supported auto-approval');
        }
        if (criticalIssues > 0) {
          alternatives.push('Rejection was considered due to validation issues but they were deemed non-blocking');
        }
        break;

      case DecisionType.HUMAN_REVIEW_REQUIRED:
        if (context.confidence >= context.escalationThreshold) {
          alternatives.push('Auto-approval was considered but risk factors required human validation');
        }
        if (context.confidence < 0.3) {
          alternatives.push('Rejection was considered due to very low confidence but human review preferred');
        }
        break;

      case DecisionType.REJECT_INVOICE:
        alternatives.push('Human review was considered but critical issues made rejection necessary');
        break;

      case DecisionType.ESCALATE_TO_EXPERT:
        alternatives.push('Standard human review was considered but complexity required expert attention');
        break;
    }

    return alternatives;
  }

  private generateFinalJustification(
    decision: Decision,
    context: { confidence: number; escalationThreshold: number },
    appliedMemories: Memory[],
    validationIssues: ValidationIssue[]
  ): string {
    const confidencePercent = (context.confidence * 100).toFixed(1);
    const memoryCount = appliedMemories.length;
    const issueCount = validationIssues.length;

    switch (decision.decisionType) {
      case DecisionType.AUTO_APPROVE:
        return `Auto-approval justified by ${confidencePercent}% confidence, ${memoryCount} supporting memories, and ${issueCount} minor validation issues that do not impact processing quality`;

      case DecisionType.HUMAN_REVIEW_REQUIRED:
        return `Human review required to validate ${confidencePercent}% confidence decision with ${memoryCount} applied memories and ${issueCount} validation considerations`;

      case DecisionType.ESCALATE_TO_EXPERT:
        return `Expert escalation necessary due to complex decision factors requiring specialized knowledge beyond standard processing capabilities`;

      case DecisionType.REJECT_INVOICE:
        return `Rejection necessary due to critical validation failures or insufficient confidence (${confidencePercent}%) for reliable processing`;

      case DecisionType.REQUEST_ADDITIONAL_INFO:
        return `Additional information required to achieve reliable processing confidence above current ${confidencePercent}% level`;

      default:
        return `Decision made based on comprehensive analysis of confidence, memory patterns, and validation results`;
    }
  }

  private generateApplicationJustification(appliedMemories: AppliedMemory[], failedMemories: FailedMemory[]): string {
    const parts: string[] = [];

    if (appliedMemories.length > 0) {
      parts.push(`Successfully applied ${appliedMemories.length} memories`);

      const avgConfidence = appliedMemories.reduce((sum, m) => sum + m.applicationConfidence, 0) / appliedMemories.length;
      parts.push(`with average application confidence ${(avgConfidence * 100).toFixed(1)}%`);
    }

    if (failedMemories.length > 0) {
      parts.push(`${failedMemories.length} memories failed to apply due to validation or compatibility issues`);
    }

    return parts.join(' ');
  }

  private generateFieldMappingExplanations(appliedMemories: AppliedMemory[]): FieldMappingExplanation[] {
    const explanations: FieldMappingExplanation[] = [];

    for (const appliedMemory of appliedMemories) {
      if (appliedMemory.applicationType === 'field_mapping') {
        for (const transformation of appliedMemory.transformations) {
          explanations.push({
            sourceField: transformation.sourceField,
            targetField: transformation.targetField,
            originalValue: transformation.originalValue,
            transformedValue: transformation.transformedValue,
            memoryId: appliedMemory.memory.id,
            confidence: transformation.confidence,
            explanation: this.generateTransformationExplanation(transformation),
            selectionReason: `Selected based on ${(appliedMemory.applicationConfidence * 100).toFixed(1)}% confidence and successful usage pattern`
          });
        }
      }
    }

    return explanations;
  }

  private generateCorrectionExplanations(appliedMemories: AppliedMemory[]): CorrectionExplanation[] {
    const explanations: CorrectionExplanation[] = [];

    for (const appliedMemory of appliedMemories) {
      if (appliedMemory.applicationType === 'correction') {
        // This would be populated from actual correction data
        // For now, create a placeholder structure
        explanations.push({
          field: appliedMemory.affectedFields[0] || 'unknown',
          originalValue: 'original_value',
          correctedValue: 'corrected_value',
          memoryId: appliedMemory.memory.id,
          confidence: appliedMemory.applicationConfidence,
          explanation: appliedMemory.reasoning,
          triggerPattern: 'Pattern detected from historical corrections',
          historicalContext: `Memory has ${appliedMemory.memory.usageCount} successful applications with ${(appliedMemory.memory.successRate * 100).toFixed(1)}% success rate`
        });
      }
    }

    return explanations;
  }

  private generateConflictResolutionExplanations(resolvedConflicts: ResolvedConflict[]): ConflictResolutionExplanation[] {
    return resolvedConflicts.map(conflict => ({
      conflictType: conflict.conflictType,
      conflictingMemoryIds: conflict.conflictingMemories.map(m => m.id),
      selectedMemoryId: conflict.selectedMemory.id,
      resolutionStrategy: conflict.resolutionStrategy,
      explanation: conflict.reasoning,
      rejectionReasons: conflict.conflictingMemories
        .filter(m => m.id !== conflict.selectedMemory.id)
        .map(m => `Memory ${m.id} rejected due to lower confidence (${(m.confidence * 100).toFixed(1)}%)`)
    }));
  }

  private generateValidationReasoning(appliedMemories: AppliedMemory[], failedMemories: FailedMemory[]): string {
    const parts: string[] = [];

    const validationFailures = failedMemories.filter(m => m.validationFailure).length;
    if (validationFailures > 0) {
      parts.push(`${validationFailures} memories failed validation checks`);
    }

    const successfulApplications = appliedMemories.length;
    if (successfulApplications > 0) {
      parts.push(`${successfulApplications} memories passed all validation requirements`);
    }

    return parts.length > 0 ? parts.join('; ') : 'All memory applications validated successfully';
  }

  private generateApplicationSummary(
    appliedMemories: AppliedMemory[],
    failedMemories: FailedMemory[],
    resolvedConflicts: ResolvedConflict[],
    invoice: RawInvoice
  ): string {
    const parts: string[] = [];

    parts.push(`Processed invoice ${invoice.id} from vendor ${invoice.vendorId}`);

    if (appliedMemories.length > 0) {
      parts.push(`successfully applied ${appliedMemories.length} memories`);
    }

    if (failedMemories.length > 0) {
      parts.push(`${failedMemories.length} memories could not be applied`);
    }

    if (resolvedConflicts.length > 0) {
      parts.push(`resolved ${resolvedConflicts.length} memory conflicts`);
    }

    return parts.join(', ');
  }

  private generateTransformationExplanation(transformation: any): string {
    const type = transformation.transformationType;
    const source = transformation.sourceField;
    const target = transformation.targetField;

    switch (type) {
      case 'direct_mapping':
        return `Direct mapping from ${source} to ${target} without transformation`;
      case 'date_parse':
        return `Parsed date value from ${source} and mapped to ${target} using learned date format patterns`;
      case 'currency_extract':
        return `Extracted currency information from ${source} and structured for ${target} field`;
      case 'text_normalize':
        return `Normalized text from ${source} using learned patterns and mapped to ${target}`;
      case 'regex_extract':
        return `Applied regex pattern to extract relevant data from ${source} for ${target}`;
      default:
        return `Applied transformation from ${source} to ${target}`;
    }
  }
}

/**
 * Create a reasoning engine instance
 */
export function createReasoningEngine(): ReasoningEngine {
  return new ReasoningEngineImpl();
}