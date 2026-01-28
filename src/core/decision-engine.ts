/**
 * Decision Engine for AI Agent Memory System
 * 
 * Implements confidence-based decision logic that determines whether to
 * auto-apply memory corrections or escalate for human review based on
 * confidence thresholds and risk assessment.
 */

import {
  Decision,
  DecisionType,
  NormalizedInvoice,
  RecommendedAction,
  ActionType,
  ActionPriority,
  RiskAssessment,
  RiskLevel,
  RiskFactor,
  RiskType,
  AuditStep,
  AuditOperation,
  Memory,
  MemoryContext,
  ProcessingEnvironment
} from '../types';
import { ConfidenceManager } from './confidence-manager';
import { DatabaseConnection } from '../database/connection';

/**
 * Configuration for decision making
 */
export interface DecisionConfig {
  /** Default escalation threshold for confidence-based decisions */
  defaultEscalationThreshold: number;
  
  /** Minimum confidence required for auto-approval */
  autoApprovalThreshold: number;
  
  /** Maximum confidence below which rejection is considered */
  rejectionThreshold: number;
  
  /** Risk tolerance level */
  riskTolerance: RiskLevel;
  
  /** Enable conservative mode for new vendors */
  conservativeModeForNewVendors: boolean;
  
  /** Enable high-value invoice special handling */
  highValueInvoiceThreshold: number;
}

/**
 * Context for decision making
 */
export interface DecisionContext {
  /** The normalized invoice being processed */
  invoice: NormalizedInvoice;
  
  /** Overall confidence score for the processing */
  confidence: number;
  
  /** Memories that were applied during processing */
  appliedMemories: Memory[];
  
  /** Memory context for additional decision factors */
  memoryContext: MemoryContext;
  
  /** Processing environment information */
  environment: ProcessingEnvironment;
  
  /** Any validation errors or warnings */
  validationIssues: ValidationIssue[];
}

/**
 * Validation issue that affects decision making
 */
export interface ValidationIssue {
  /** Severity of the issue */
  severity: IssueSeverity;
  
  /** Type of validation issue */
  issueType: ValidationIssueType;
  
  /** Field affected by the issue */
  affectedField: string;
  
  /** Description of the issue */
  description: string;
  
  /** Suggested resolution */
  suggestedResolution?: string;
}

/**
 * Severity levels for validation issues
 */
export enum IssueSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

/**
 * Types of validation issues
 */
export enum ValidationIssueType {
  MISSING_FIELD = 'missing_field',
  INVALID_FORMAT = 'invalid_format',
  BUSINESS_RULE_VIOLATION = 'business_rule_violation',
  INCONSISTENT_DATA = 'inconsistent_data',
  SUSPICIOUS_VALUE = 'suspicious_value'
}

/**
 * Interface for the decision engine
 */
export interface DecisionEngine {
  /**
   * Make a processing decision based on confidence and context
   * @param context Decision context including invoice, confidence, and memories
   * @returns Decision with reasoning and recommended actions
   */
  makeDecision(context: DecisionContext): Promise<Decision>;

  /**
   * Evaluate risk factors for a decision
   * @param context Decision context
   * @returns Risk assessment with factors and mitigation strategies
   */
  assessRisk(context: DecisionContext): Promise<RiskAssessment>;

  /**
   * Generate recommended actions based on decision context
   * @param context Decision context
   * @param decisionType Type of decision being made
   * @returns Array of recommended actions
   */
  generateRecommendedActions(context: DecisionContext, decisionType: DecisionType): RecommendedAction[];

  /**
   * Get audit steps for decision making process
   * @returns Array of audit steps
   */
  getAuditSteps(): AuditStep[];

  /**
   * Clear audit steps (for testing)
   */
  clearAuditSteps(): void;
}

/**
 * Implementation of the decision engine
 */
export class DecisionEngineImpl implements DecisionEngine {
  private confidenceManager: ConfidenceManager;
  private config: DecisionConfig;
  private auditSteps: AuditStep[] = [];

  constructor(
    confidenceManager: ConfidenceManager,
    _db: DatabaseConnection,
    config?: Partial<DecisionConfig>
  ) {
    this.confidenceManager = confidenceManager;
    // Note: db parameter kept for future use in database-dependent operations
    this.config = {
      defaultEscalationThreshold: 0.7,
      autoApprovalThreshold: 0.85,
      rejectionThreshold: 0.3,
      riskTolerance: RiskLevel.MEDIUM,
      conservativeModeForNewVendors: true,
      highValueInvoiceThreshold: 10000,
      ...config
    };
  }

  /**
   * Make a processing decision based on confidence and context
   */
  async makeDecision(context: DecisionContext): Promise<Decision> {
    const startTime = Date.now();
    
    // Get current escalation threshold from confidence manager
    const escalationThreshold = await this.confidenceManager.getEscalationThreshold();
    
    // Assess risk factors
    const riskAssessment = await this.assessRisk(context);
    
    // Determine decision type based on confidence and risk
    const decisionType = await this.determineDecisionType(
      context.confidence,
      escalationThreshold,
      riskAssessment,
      context
    );
    
    // Calculate final decision confidence
    const decisionConfidence = this.calculateDecisionConfidence(
      context.confidence,
      riskAssessment,
      context
    );
    
    // Generate reasoning
    const reasoning = this.generateDecisionReasoning(
      context,
      decisionType,
      escalationThreshold,
      riskAssessment
    );
    
    // Generate recommended actions
    const recommendedActions = this.generateRecommendedActions(context, decisionType);
    
    // Record audit step
    this.recordAuditStep({
      id: `decision-${Date.now()}`,
      timestamp: new Date(),
      operation: AuditOperation.DECISION_MAKING,
      description: 'Confidence-based decision making',
      input: {
        invoiceId: context.invoice.id,
        confidence: context.confidence,
        escalationThreshold,
        riskLevel: riskAssessment.riskLevel,
        appliedMemoriesCount: context.appliedMemories.length
      },
      output: {
        decisionType,
        decisionConfidence,
        riskLevel: riskAssessment.riskLevel,
        recommendedActionsCount: recommendedActions.length
      },
      actor: 'DecisionEngine',
      duration: Date.now() - startTime
    });

    return {
      decisionType,
      confidence: decisionConfidence,
      reasoning,
      recommendedActions,
      riskAssessment
    };
  }

  /**
   * Evaluate risk factors for a decision
   */
  async assessRisk(context: DecisionContext): Promise<RiskAssessment> {
    const riskFactors: RiskFactor[] = [];
    
    // Financial risk assessment
    const invoiceAmount = context.invoice.totalAmount.amount;
    if (invoiceAmount > this.config.highValueInvoiceThreshold) {
      riskFactors.push({
        riskType: RiskType.FINANCIAL,
        severity: Math.min(1.0, invoiceAmount / (this.config.highValueInvoiceThreshold * 2)),
        description: `High-value invoice: ${invoiceAmount} ${context.invoice.totalAmount.currency}`
      });
    }
    
    // Confidence-based risk
    if (context.confidence < 0.5) {
      riskFactors.push({
        riskType: RiskType.OPERATIONAL,
        severity: (0.5 - context.confidence) * 2, // Scale to 0-1
        description: `Low processing confidence: ${(context.confidence * 100).toFixed(1)}%`
      });
    }
    
    // Vendor relationship risk
    const vendorInfo = context.memoryContext.vendorId;
    if (vendorInfo) {
      // In a real implementation, we'd query vendor information from database
      // For now, we'll simulate based on vendor ID patterns
      if (context.appliedMemories.length === 0) {
        riskFactors.push({
          riskType: RiskType.OPERATIONAL,
          severity: 0.4, // Reduced severity for new vendors
          description: 'New or unfamiliar vendor with limited memory history'
        });
      }
    }
    
    // Compliance risk assessment - make it more aggressive for multiple errors
    const criticalIssues = context.validationIssues.filter(
      issue => issue.severity === IssueSeverity.CRITICAL || issue.severity === IssueSeverity.ERROR
    );
    if (criticalIssues.length > 0) {
      const severity = Math.min(1.0, criticalIssues.length * 0.4); // Increased multiplier
      riskFactors.push({
        riskType: RiskType.COMPLIANCE,
        severity,
        description: `${criticalIssues.length} critical validation issues detected`
      });
    }
    
    // Memory consistency risk
    const inconsistentMemories = context.appliedMemories.filter(memory => memory.confidence < 0.6);
    if (inconsistentMemories.length > 0) {
      riskFactors.push({
        riskType: RiskType.TECHNICAL,
        severity: inconsistentMemories.length / context.appliedMemories.length,
        description: `${inconsistentMemories.length} low-confidence memories applied`
      });
    }
    
    // Calculate overall risk level - use max severity for more aggressive assessment
    const maxSeverity = riskFactors.length > 0 
      ? Math.max(...riskFactors.map(factor => factor.severity))
      : 0;
    const averageSeverity = riskFactors.length > 0 
      ? riskFactors.reduce((sum, factor) => sum + factor.severity, 0) / riskFactors.length
      : 0;
    
    // Use the higher of max or average for risk classification
    const effectiveSeverity = Math.max(maxSeverity, averageSeverity);
    
    let riskLevel: RiskLevel;
    if (effectiveSeverity >= 0.8) riskLevel = RiskLevel.VERY_HIGH;
    else if (effectiveSeverity >= 0.6) riskLevel = RiskLevel.HIGH;
    else if (effectiveSeverity >= 0.4) riskLevel = RiskLevel.MEDIUM;
    else if (effectiveSeverity >= 0.2) riskLevel = RiskLevel.LOW;
    else riskLevel = RiskLevel.VERY_LOW;
    
    // Generate mitigation strategies
    const mitigationStrategies = this.generateMitigationStrategies(riskFactors);
    
    return {
      riskLevel,
      riskFactors,
      mitigationStrategies
    };
  }

  /**
   * Generate recommended actions based on decision context
   */
  generateRecommendedActions(context: DecisionContext, decisionType: DecisionType): RecommendedAction[] {
    const actions: RecommendedAction[] = [];
    
    switch (decisionType) {
      case DecisionType.AUTO_APPROVE:
        actions.push({
          actionType: ActionType.APPLY_CORRECTION,
          priority: ActionPriority.HIGH,
          description: 'Apply all memory-based corrections and process automatically',
          expectedOutcome: 'Invoice processed without human intervention'
        });
        break;
        
      case DecisionType.HUMAN_REVIEW_REQUIRED:
        actions.push({
          actionType: ActionType.ESCALATE_ISSUE,
          priority: ActionPriority.MEDIUM,
          description: 'Escalate to human reviewer for validation',
          expectedOutcome: 'Human validation of memory applications and corrections'
        });
        
        // Add specific validation actions for issues
        context.validationIssues.forEach(issue => {
          if (issue.severity === IssueSeverity.ERROR || issue.severity === IssueSeverity.CRITICAL) {
            actions.push({
              actionType: ActionType.VALIDATE_FIELD,
              priority: ActionPriority.HIGH,
              description: `Validate ${issue.affectedField}: ${issue.description}`,
              expectedOutcome: issue.suggestedResolution || 'Field validation and correction'
            });
          }
        });
        break;
        
      case DecisionType.ESCALATE_TO_EXPERT:
        actions.push({
          actionType: ActionType.ESCALATE_ISSUE,
          priority: ActionPriority.CRITICAL,
          description: 'Escalate to domain expert for complex decision',
          expectedOutcome: 'Expert review and guidance on processing approach'
        });
        break;
        
      case DecisionType.REJECT_INVOICE:
        actions.push({
          actionType: ActionType.ESCALATE_ISSUE,
          priority: ActionPriority.CRITICAL,
          description: 'Reject invoice due to critical issues or very low confidence',
          expectedOutcome: 'Invoice rejected and returned to sender for correction'
        });
        break;
        
      case DecisionType.REQUEST_ADDITIONAL_INFO:
        actions.push({
          actionType: ActionType.CONTACT_VENDOR,
          priority: ActionPriority.MEDIUM,
          description: 'Request additional information from vendor',
          expectedOutcome: 'Clarification received to enable proper processing'
        });
        break;
    }
    
    // Add memory update actions if needed
    const lowConfidenceMemories = context.appliedMemories.filter(memory => memory.confidence < 0.5);
    if (lowConfidenceMemories.length > 0) {
      actions.push({
        actionType: ActionType.UPDATE_MEMORY,
        priority: ActionPriority.LOW,
        description: `Review and potentially update ${lowConfidenceMemories.length} low-confidence memories`,
        expectedOutcome: 'Improved memory reliability for future processing'
      });
    }
    
    return actions;
  }

  /**
   * Get audit steps for decision making process
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

  private async determineDecisionType(
    confidence: number,
    escalationThreshold: number,
    riskAssessment: RiskAssessment,
    context: DecisionContext
  ): Promise<DecisionType> {
    // Check for critical validation issues first
    const criticalIssues = context.validationIssues.filter(
      issue => issue.severity === IssueSeverity.CRITICAL
    );
    if (criticalIssues.length > 0) {
      return DecisionType.REJECT_INVOICE;
    }
    
    // Check for very low confidence
    if (confidence < this.config.rejectionThreshold) {
      return DecisionType.REQUEST_ADDITIONAL_INFO;
    }
    
    // Check for very high risk (only if risk is actually very high)
    if (riskAssessment.riskLevel === RiskLevel.VERY_HIGH && 
        riskAssessment.riskFactors.some(f => f.severity > 0.8)) {
      return DecisionType.ESCALATE_TO_EXPERT;
    }
    
    // High confidence and acceptable risk - auto approve
    if (confidence >= this.config.autoApprovalThreshold && 
        riskAssessment.riskLevel <= RiskLevel.MEDIUM) {
      return DecisionType.AUTO_APPROVE;
    }
    
    // Apply conservative mode for new vendors (but only if confidence is not very high)
    if (this.config.conservativeModeForNewVendors && 
        context.appliedMemories.length === 0 && 
        confidence < this.config.autoApprovalThreshold) {
      return DecisionType.HUMAN_REVIEW_REQUIRED;
    }
    
    // Use escalation threshold for standard decision
    if (confidence >= escalationThreshold) {
      // Additional checks for high-value invoices
      const invoiceAmount = context.invoice.totalAmount.amount;
      if (invoiceAmount > this.config.highValueInvoiceThreshold && 
          riskAssessment.riskLevel >= RiskLevel.HIGH) {
        return DecisionType.HUMAN_REVIEW_REQUIRED;
      }
      return DecisionType.AUTO_APPROVE;
    } else {
      return DecisionType.HUMAN_REVIEW_REQUIRED;
    }
  }

  private calculateDecisionConfidence(
    processingConfidence: number,
    riskAssessment: RiskAssessment,
    context: DecisionContext
  ): number {
    let decisionConfidence = processingConfidence;
    
    // Adjust based on risk level
    switch (riskAssessment.riskLevel) {
      case RiskLevel.VERY_LOW:
        decisionConfidence *= 1.1;
        break;
      case RiskLevel.LOW:
        decisionConfidence *= 1.05;
        break;
      case RiskLevel.MEDIUM:
        // No adjustment
        break;
      case RiskLevel.HIGH:
        decisionConfidence *= 0.9;
        break;
      case RiskLevel.VERY_HIGH:
        decisionConfidence *= 0.8;
        break;
    }
    
    // Adjust based on validation issues
    const errorCount = context.validationIssues.filter(
      issue => issue.severity === IssueSeverity.ERROR || issue.severity === IssueSeverity.CRITICAL
    ).length;
    if (errorCount > 0) {
      decisionConfidence *= Math.max(0.5, 1 - (errorCount * 0.1));
    }
    
    // Ensure within bounds
    return Math.max(0, Math.min(1, decisionConfidence));
  }

  private generateDecisionReasoning(
    context: DecisionContext,
    decisionType: DecisionType,
    escalationThreshold: number,
    riskAssessment: RiskAssessment
  ): string {
    const reasons: string[] = [];
    
    // Enhanced confidence-based reasoning
    const confidencePercent = (context.confidence * 100).toFixed(1);
    const thresholdPercent = (escalationThreshold * 100).toFixed(1);
    
    // Primary confidence assessment
    if (context.confidence >= escalationThreshold) {
      reasons.push(`Processing confidence ${confidencePercent}% exceeds escalation threshold ${thresholdPercent}%`);
      
      // Additional confidence quality indicators
      if (context.confidence >= 0.9) {
        reasons.push('Very high confidence indicates reliable processing');
      } else if (context.confidence >= 0.8) {
        reasons.push('High confidence supports automated processing');
      } else {
        reasons.push('Moderate confidence above threshold but requires monitoring');
      }
    } else {
      reasons.push(`Processing confidence ${confidencePercent}% below escalation threshold ${thresholdPercent}%`);
      
      const confidenceGap = escalationThreshold - context.confidence;
      if (confidenceGap > 0.3) {
        reasons.push('Significant confidence gap indicates high uncertainty');
      } else if (confidenceGap > 0.1) {
        reasons.push('Moderate confidence gap suggests caution needed');
      } else {
        reasons.push('Small confidence gap - borderline case requiring careful evaluation');
      }
    }
    
    // Enhanced risk-based reasoning
    const riskFactorCount = riskAssessment.riskFactors.length;
    reasons.push(`Risk assessment: ${riskAssessment.riskLevel} with ${riskFactorCount} factors identified`);
    
    if (riskFactorCount > 0) {
      // Categorize risk factors
      const riskCategories = riskAssessment.riskFactors.reduce((acc: Record<string, number>, factor: any) => {
        acc[factor.riskType] = (acc[factor.riskType] || 0) + 1;
        return acc;
      }, {});
      
      const riskSummary = Object.entries(riskCategories)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      reasons.push(`Risk categories: ${riskSummary}`);
      
      // High severity risk factors
      const highSeverityRisks = riskAssessment.riskFactors.filter((factor: any) => factor.severity >= 0.7);
      if (highSeverityRisks.length > 0) {
        reasons.push(`${highSeverityRisks.length} high-severity risk factors require attention`);
      }
    }
    
    // Enhanced memory-based reasoning
    if (context.appliedMemories.length > 0) {
      const avgMemoryConfidence = context.appliedMemories.reduce(
        (sum, memory) => sum + memory.confidence, 0
      ) / context.appliedMemories.length;
      reasons.push(`${context.appliedMemories.length} memories applied with average confidence ${(avgMemoryConfidence * 100).toFixed(1)}%`);
      
      // Memory quality analysis
      const highQualityMemories = context.appliedMemories.filter(m => 
        m.confidence >= 0.8 && m.usageCount >= 3 && m.successRate >= 0.8
      );
      if (highQualityMemories.length > 0) {
        reasons.push(`${highQualityMemories.length} high-quality memories with proven track record`);
      }
      
      const newMemories = context.appliedMemories.filter(m => m.usageCount === 0);
      if (newMemories.length > 0) {
        reasons.push(`${newMemories.length} untested memories applied - increased monitoring recommended`);
      }
      
      // Memory type distribution
      const memoryTypes = context.appliedMemories.reduce((acc: Record<string, number>, memory) => {
        acc[memory.type] = (acc[memory.type] || 0) + 1;
        return acc;
      }, {});
      
      const typeDistribution = Object.entries(memoryTypes)
        .map(([type, count]) => `${count} ${type}`)
        .join(', ');
      reasons.push(`Memory types: ${typeDistribution}`);
    } else {
      reasons.push('No memories available for this vendor/pattern - using default processing logic');
      
      // Check if this is a new vendor
      if (context.memoryContext.vendorId) {
        reasons.push(`New or unfamiliar vendor ${context.memoryContext.vendorId} requires conservative approach`);
      }
    }
    
    // Enhanced validation issues reasoning
    if (context.validationIssues.length > 0) {
      const criticalCount = context.validationIssues.filter(i => i.severity === IssueSeverity.CRITICAL).length;
      const errorCount = context.validationIssues.filter(i => i.severity === IssueSeverity.ERROR).length;
      const warningCount = context.validationIssues.filter(i => i.severity === IssueSeverity.WARNING).length;
      
      const issueSummary: string[] = [];
      if (criticalCount > 0) issueSummary.push(`${criticalCount} critical`);
      if (errorCount > 0) issueSummary.push(`${errorCount} errors`);
      if (warningCount > 0) issueSummary.push(`${warningCount} warnings`);
      
      reasons.push(`Validation issues detected: ${issueSummary.join(', ')}`);
      
      // Impact assessment
      if (criticalCount > 0) {
        reasons.push('Critical validation issues prevent automated processing');
      } else if (errorCount > 2) {
        reasons.push('Multiple validation errors indicate data quality concerns');
      } else if (errorCount > 0) {
        reasons.push('Validation errors require human review for resolution');
      }
      
      // Issue type analysis
      const issueTypes = context.validationIssues.reduce((acc: Record<string, number>, issue) => {
        acc[issue.issueType] = (acc[issue.issueType] || 0) + 1;
        return acc;
      }, {});
      
      const issueTypeSummary = Object.entries(issueTypes)
        .map(([type, count]) => `${count} ${type.replace('_', ' ')}`)
        .join(', ');
      reasons.push(`Issue types: ${issueTypeSummary}`);
    } else {
      reasons.push('All validation checks passed successfully');
    }
    
    // Enhanced decision type reasoning with alternatives considered
    switch (decisionType) {
      case DecisionType.AUTO_APPROVE:
        reasons.push('Auto-approval granted due to sufficient confidence and acceptable risk profile');
        
        // Explain why other options were not chosen
        if (context.confidence < 0.9) {
          reasons.push('Human review was considered but confidence and risk factors support automation');
        }
        if (riskAssessment.riskLevel !== RiskLevel.VERY_LOW) {
          reasons.push('Risk factors present but within acceptable limits for automated processing');
        }
        break;
        
      case DecisionType.HUMAN_REVIEW_REQUIRED:
        if (context.appliedMemories.length === 0) {
          reasons.push('Human review required due to limited memory history for reliable automation');
        } else if (context.confidence < escalationThreshold) {
          reasons.push('Human review required due to confidence below automation threshold');
        } else {
          reasons.push('Human review required due to risk factors despite adequate confidence');
        }
        
        // Explain what human reviewer should focus on
        const reviewFocus: string[] = [];
        if (context.validationIssues.length > 0) {
          reviewFocus.push('validation issues');
        }
        if (context.appliedMemories.some(m => m.confidence < 0.6)) {
          reviewFocus.push('low-confidence memory applications');
        }
        if (riskAssessment.riskLevel >= RiskLevel.HIGH) {
          reviewFocus.push('high-risk factors');
        }
        
        if (reviewFocus.length > 0) {
          reasons.push(`Human reviewer should focus on: ${reviewFocus.join(', ')}`);
        }
        break;
        
      case DecisionType.ESCALATE_TO_EXPERT:
        reasons.push('Expert escalation required due to complexity beyond standard processing capabilities');
        
        if (riskAssessment.riskLevel === RiskLevel.VERY_HIGH) {
          reasons.push('Very high risk level requires specialized expertise');
        }
        if (context.validationIssues.filter(i => i.severity === IssueSeverity.CRITICAL).length > 1) {
          reasons.push('Multiple critical issues require expert analysis');
        }
        break;
        
      case DecisionType.REJECT_INVOICE:
        reasons.push('Invoice rejection necessary due to critical issues preventing reliable processing');
        
        if (context.confidence < 0.2) {
          reasons.push('Extremely low confidence makes processing unreliable');
        }
        if (context.validationIssues.filter(i => i.severity === IssueSeverity.CRITICAL).length > 0) {
          reasons.push('Critical validation failures make processing impossible');
        }
        break;
        
      case DecisionType.REQUEST_ADDITIONAL_INFO:
        reasons.push('Additional information required to achieve reliable processing confidence');
        
        if (context.confidence < 0.4) {
          reasons.push('Current confidence too low for any automated processing');
        }
        
        // Suggest what additional information might help
        const infoNeeded: string[] = [];
        if (context.appliedMemories.length === 0) {
          infoNeeded.push('vendor-specific processing patterns');
        }
        if (context.validationIssues.some(i => i.issueType === 'missing_field')) {
          infoNeeded.push('missing required fields');
        }
        if (context.validationIssues.some(i => i.issueType === 'invalid_format')) {
          infoNeeded.push('data format clarification');
        }
        
        if (infoNeeded.length > 0) {
          reasons.push(`Additional information needed: ${infoNeeded.join(', ')}`);
        }
        break;
    }
    
    // Final decision confidence assessment
    const decisionConfidencePercent = (context.confidence * 100).toFixed(1);
    reasons.push(`Final decision confidence: ${decisionConfidencePercent}%`);
    
    // Mitigation strategies if available
    if (riskAssessment.mitigationStrategies.length > 0) {
      reasons.push(`${riskAssessment.mitigationStrategies.length} risk mitigation strategies available`);
    }
    
    return `Decision: ${decisionType}. ${reasons.join('. ')}.`;
  }

  private generateMitigationStrategies(riskFactors: RiskFactor[]): string[] {
    const strategies: string[] = [];
    
    riskFactors.forEach(factor => {
      switch (factor.riskType) {
        case RiskType.FINANCIAL:
          strategies.push('Implement additional approval workflow for high-value invoices');
          strategies.push('Require secondary validation for amounts above threshold');
          break;
        case RiskType.OPERATIONAL:
          strategies.push('Increase confidence threshold for unfamiliar patterns');
          strategies.push('Implement gradual learning approach for new vendors');
          break;
        case RiskType.COMPLIANCE:
          strategies.push('Ensure all validation rules are properly applied');
          strategies.push('Maintain detailed audit trail for compliance review');
          break;
        case RiskType.TECHNICAL:
          strategies.push('Review and update low-confidence memory patterns');
          strategies.push('Implement memory quality monitoring and cleanup');
          break;
        case RiskType.REPUTATIONAL:
          strategies.push('Implement conservative processing for sensitive vendors');
          strategies.push('Ensure proper escalation for relationship-critical invoices');
          break;
      }
    });
    
    // Remove duplicates
    return [...new Set(strategies)];
  }

  private recordAuditStep(step: AuditStep): void {
    this.auditSteps.push(step);
  }
}

/**
 * Create a decision engine instance
 */
export function createDecisionEngine(
  confidenceManager: ConfidenceManager,
  db: DatabaseConnection,
  config?: Partial<DecisionConfig>
): DecisionEngine {
  return new DecisionEngineImpl(confidenceManager, db, config);
}