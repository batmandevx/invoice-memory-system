/**
 * Base Classes for Memory System
 * 
 * This module provides abstract base classes and concrete implementations
 * for the memory system's core components.
 */

import {
  Memory,
  MemoryType,
  MemoryPattern,
  MemoryContext,
  VendorMemory,
  CorrectionMemory,
  ResolutionMemory,
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

/**
 * Abstract base class for all memory types
 * Provides common functionality and enforces consistent behavior
 */
export abstract class BaseMemory implements Memory {
  public readonly id: string;
  public readonly type: MemoryType;
  public readonly pattern: MemoryPattern;
  public confidence: number;
  public readonly createdAt: Date;
  public lastUsed: Date;
  public usageCount: number;
  public successRate: number;
  public readonly context: MemoryContext;

  constructor(
    id: string,
    type: MemoryType,
    pattern: MemoryPattern,
    confidence: number,
    context: MemoryContext
  ) {
    this.id = id;
    this.type = type;
    this.pattern = pattern;
    this.confidence = Math.max(0, Math.min(1, confidence)); // Ensure 0-1 range
    this.createdAt = new Date();
    this.lastUsed = new Date();
    this.usageCount = 0;
    this.successRate = 0;
    this.context = context;
  }

  /**
   * Update memory usage statistics
   * @param successful Whether the memory application was successful
   */
  public updateUsage(successful: boolean): void {
    this.lastUsed = new Date();
    this.usageCount++;
    
    // Update success rate using exponential moving average
    const alpha = 0.1; // Learning rate
    const newSuccessValue = successful ? 1 : 0;
    this.successRate = alpha * newSuccessValue + (1 - alpha) * this.successRate;
  }

  /**
   * Update confidence score
   * @param newConfidence New confidence value (0-1)
   */
  public updateConfidence(newConfidence: number): void {
    this.confidence = Math.max(0, Math.min(1, newConfidence));
  }

  /**
   * Check if this memory is applicable to a given context
   * @param context Context to check against
   * @returns True if memory is applicable
   */
  public abstract isApplicable(context: MemoryContext): boolean;

  /**
   * Calculate relevance score for a given context
   * @param context Context to evaluate
   * @returns Relevance score (0-1)
   */
  public abstract calculateRelevance(context: MemoryContext): number;

  /**
   * Get a human-readable description of this memory
   * @returns Description string
   */
  public abstract getDescription(): string;
}

/**
 * Concrete implementation of VendorMemory
 */
export class VendorMemoryImpl extends BaseMemory implements VendorMemory {
  public readonly vendorId: string;
  public fieldMappings: FieldMapping[];
  public vatBehavior: VATBehavior;
  public currencyPatterns: CurrencyPattern[];
  public dateFormats: DateFormat[];

  constructor(
    id: string,
    pattern: MemoryPattern,
    confidence: number,
    context: MemoryContext,
    vendorId: string,
    fieldMappings: FieldMapping[] = [],
    vatBehavior: VATBehavior,
    currencyPatterns: CurrencyPattern[] = [],
    dateFormats: DateFormat[] = []
  ) {
    super(id, MemoryType.VENDOR, pattern, confidence, context);
    this.vendorId = vendorId;
    this.fieldMappings = fieldMappings;
    this.vatBehavior = vatBehavior;
    this.currencyPatterns = currencyPatterns;
    this.dateFormats = dateFormats;
  }

  public isApplicable(context: MemoryContext): boolean {
    // Vendor memory is applicable if the vendor ID matches
    return context.vendorId === this.vendorId;
  }

  public calculateRelevance(context: MemoryContext): number {
    if (!this.isApplicable(context)) {
      return 0;
    }

    let relevance = this.confidence;

    // Boost relevance based on usage success
    relevance *= (0.5 + 0.5 * this.successRate);

    // Consider invoice characteristics similarity
    if (context.invoiceCharacteristics.language === this.context.invoiceCharacteristics.language) {
      relevance *= 1.1;
    }

    if (context.invoiceCharacteristics.complexity === this.context.invoiceCharacteristics.complexity) {
      relevance *= 1.05;
    }

    return Math.min(1, relevance);
  }

  public getDescription(): string {
    return `Vendor memory for ${this.vendorId} with ${this.fieldMappings.length} field mappings and ${this.currencyPatterns.length} currency patterns`;
  }

  /**
   * Add a new field mapping to this vendor memory
   * @param mapping Field mapping to add
   */
  public addFieldMapping(mapping: FieldMapping): void {
    // Check if mapping already exists and update or add
    const existingIndex = this.fieldMappings.findIndex(
      m => m.sourceField === mapping.sourceField && m.targetField === mapping.targetField
    );

    if (existingIndex >= 0) {
      // Update existing mapping with higher confidence
      const existingMapping = this.fieldMappings[existingIndex];
      if (existingMapping && mapping.confidence > existingMapping.confidence) {
        this.fieldMappings[existingIndex] = mapping;
      }
    } else {
      this.fieldMappings.push(mapping);
    }
  }

  /**
   * Add a new currency pattern to this vendor memory
   * @param pattern Currency pattern to add
   */
  public addCurrencyPattern(pattern: CurrencyPattern): void {
    // Avoid duplicates
    const exists = this.currencyPatterns.some(
      p => p.pattern.source === pattern.pattern.source && p.currencyCode === pattern.currencyCode
    );

    if (!exists) {
      this.currencyPatterns.push(pattern);
    }
  }

  /**
   * Add a new date format to this vendor memory
   * @param format Date format to add
   */
  public addDateFormat(format: DateFormat): void {
    // Avoid duplicates
    const exists = this.dateFormats.some(
      f => f.format === format.format
    );

    if (!exists) {
      this.dateFormats.push(format);
    }
  }
}

/**
 * Concrete implementation of CorrectionMemory
 */
export class CorrectionMemoryImpl extends BaseMemory implements CorrectionMemory {
  public readonly correctionType: CorrectionType;
  public triggerConditions: Condition[];
  public correctionAction: CorrectionAction;
  public validationRules: ValidationRule[];

  constructor(
    id: string,
    pattern: MemoryPattern,
    confidence: number,
    context: MemoryContext,
    correctionType: CorrectionType,
    triggerConditions: Condition[],
    correctionAction: CorrectionAction,
    validationRules: ValidationRule[] = []
  ) {
    super(id, MemoryType.CORRECTION, pattern, confidence, context);
    this.correctionType = correctionType;
    this.triggerConditions = triggerConditions;
    this.correctionAction = correctionAction;
    this.validationRules = validationRules;
  }

  public isApplicable(_context: MemoryContext): boolean {
    // Correction memory is applicable if all trigger conditions can potentially be met
    // This is a simplified check - actual condition evaluation happens during application
    return this.triggerConditions.length > 0;
  }

  public calculateRelevance(context: MemoryContext): number {
    let relevance = this.confidence;

    // Boost relevance based on success rate
    relevance *= (0.3 + 0.7 * this.successRate);

    // Consider vendor match if available
    if (context.vendorId && this.context.vendorId === context.vendorId) {
      relevance *= 1.2;
    }

    // Consider invoice characteristics
    if (context.invoiceCharacteristics.complexity === this.context.invoiceCharacteristics.complexity) {
      relevance *= 1.1;
    }

    return Math.min(1, relevance);
  }

  public getDescription(): string {
    return `Correction memory for ${this.correctionType} with ${this.triggerConditions.length} conditions`;
  }

  /**
   * Add a new trigger condition
   * @param condition Condition to add
   */
  public addTriggerCondition(condition: Condition): void {
    this.triggerConditions.push(condition);
  }

  /**
   * Add a new validation rule
   * @param rule Validation rule to add
   */
  public addValidationRule(rule: ValidationRule): void {
    this.validationRules.push(rule);
  }
}

/**
 * Concrete implementation of ResolutionMemory
 */
export class ResolutionMemoryImpl extends BaseMemory implements ResolutionMemory {
  public readonly discrepancyType: DiscrepancyType;
  public resolutionOutcome: ResolutionOutcome;
  public humanDecision: HumanDecision;
  public contextFactors: ContextFactor[];

  constructor(
    id: string,
    pattern: MemoryPattern,
    confidence: number,
    context: MemoryContext,
    discrepancyType: DiscrepancyType,
    resolutionOutcome: ResolutionOutcome,
    humanDecision: HumanDecision,
    contextFactors: ContextFactor[] = []
  ) {
    super(id, MemoryType.RESOLUTION, pattern, confidence, context);
    this.discrepancyType = discrepancyType;
    this.resolutionOutcome = resolutionOutcome;
    this.humanDecision = humanDecision;
    this.contextFactors = contextFactors;
  }

  public isApplicable(_context: MemoryContext): boolean {
    // Resolution memory is applicable based on pattern matching and context similarity
    return this.pattern.threshold <= this.confidence;
  }

  public calculateRelevance(context: MemoryContext): number {
    let relevance = this.confidence;

    // Boost relevance based on human decision confidence
    relevance *= (0.5 + 0.5 * this.humanDecision.confidence);

    // Consider vendor match
    if (context.vendorId && this.context.vendorId === context.vendorId) {
      relevance *= 1.3;
    }

    // Consider context factors
    const contextFactorBoost = this.contextFactors.reduce((boost, factor) => {
      return boost + (factor.weight * 0.1);
    }, 0);
    relevance *= (1 + Math.min(0.5, contextFactorBoost));

    return Math.min(1, relevance);
  }

  public getDescription(): string {
    return `Resolution memory for ${this.discrepancyType} resolved as ${this.resolutionOutcome.resolutionAction}`;
  }

  /**
   * Add a new context factor
   * @param factor Context factor to add
   */
  public addContextFactor(factor: ContextFactor): void {
    this.contextFactors.push(factor);
  }

  /**
   * Update the resolution outcome
   * @param outcome New resolution outcome
   */
  public updateResolutionOutcome(outcome: ResolutionOutcome): void {
    this.resolutionOutcome = outcome;
  }
}

/**
 * Factory class for creating memory instances
 */
export class MemoryFactory {
  /**
   * Create a new VendorMemory instance
   */
  public static createVendorMemory(
    id: string,
    pattern: MemoryPattern,
    confidence: number,
    context: MemoryContext,
    vendorId: string,
    vatBehavior: VATBehavior,
    fieldMappings?: FieldMapping[],
    currencyPatterns?: CurrencyPattern[],
    dateFormats?: DateFormat[]
  ): VendorMemoryImpl {
    return new VendorMemoryImpl(
      id,
      pattern,
      confidence,
      context,
      vendorId,
      fieldMappings,
      vatBehavior,
      currencyPatterns,
      dateFormats
    );
  }

  /**
   * Create a new CorrectionMemory instance
   */
  public static createCorrectionMemory(
    id: string,
    pattern: MemoryPattern,
    confidence: number,
    context: MemoryContext,
    correctionType: CorrectionType,
    triggerConditions: Condition[],
    correctionAction: CorrectionAction,
    validationRules?: ValidationRule[]
  ): CorrectionMemoryImpl {
    return new CorrectionMemoryImpl(
      id,
      pattern,
      confidence,
      context,
      correctionType,
      triggerConditions,
      correctionAction,
      validationRules
    );
  }

  /**
   * Create a new ResolutionMemory instance
   */
  public static createResolutionMemory(
    id: string,
    pattern: MemoryPattern,
    confidence: number,
    context: MemoryContext,
    discrepancyType: DiscrepancyType,
    resolutionOutcome: ResolutionOutcome,
    humanDecision: HumanDecision,
    contextFactors?: ContextFactor[]
  ): ResolutionMemoryImpl {
    return new ResolutionMemoryImpl(
      id,
      pattern,
      confidence,
      context,
      discrepancyType,
      resolutionOutcome,
      humanDecision,
      contextFactors
    );
  }
}