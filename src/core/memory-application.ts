/**
 * Memory Application Engine
 * 
 * Implements the core logic for applying recalled memories to transform
 * raw invoices into normalized format with field mappings, corrections,
 * and various transformation types.
 */

import {
  Memory,
  MemoryType,
  RawInvoice,
  NormalizedInvoice,
  VendorMemory,
  CorrectionMemory,
  ResolutionMemory,
  TransformationType,
  TransformationRule,
  Correction,
  CorrectionAction,
  CorrectionActionType,
  Condition,
  ConditionOperator,
  ValidationRule,
  ValidationType,
  LineItem,
  Money,
  NormalizedField,
  AuditStep,
  AuditOperation
} from '../types';

/**
 * Configuration for memory application operations
 */
export interface MemoryApplicationConfig {
  /** Maximum number of memories to apply per invoice */
  maxMemoriesPerInvoice: number;
  
  /** Minimum confidence threshold for applying memories */
  minApplicationThreshold: number;
  
  /** Enable field mapping transformations */
  enableFieldMappings: boolean;
  
  /** Enable correction suggestions */
  enableCorrections: boolean;
  
  /** Enable conflict resolution */
  enableConflictResolution: boolean;
  
  /** Maximum number of correction suggestions */
  maxCorrections: number;
  
  /** Enable validation of transformations */
  enableValidation: boolean;
  
  /** Timeout for transformation operations (ms) */
  transformationTimeout: number;
}

/**
 * Result of memory application operation
 */
export interface MemoryApplicationResult {
  /** Normalized invoice with applied transformations */
  normalizedInvoice: NormalizedInvoice;
  
  /** Corrections suggested by memories */
  proposedCorrections: Correction[];
  
  /** Fields that were normalized */
  normalizedFields: NormalizedField[];
  
  /** Memories that were successfully applied */
  appliedMemories: AppliedMemory[];
  
  /** Memories that failed to apply */
  failedMemories: FailedMemory[];
  
  /** Conflicts that were resolved */
  resolvedConflicts: ResolvedConflict[];
  
  /** Overall confidence in the application */
  applicationConfidence: number;
  
  /** Detailed reasoning for all applications */
  reasoning: string;
  
  /** Audit trail of application steps */
  auditSteps: AuditStep[];
}

/**
 * Memory that was successfully applied
 */
export interface AppliedMemory {
  /** The memory that was applied */
  memory: Memory;
  
  /** Type of application performed */
  applicationType: MemoryApplicationType;
  
  /** Fields that were affected */
  affectedFields: string[];
  
  /** Confidence in the application */
  applicationConfidence: number;
  
  /** Reasoning for applying this memory */
  reasoning: string;
  
  /** Transformations performed */
  transformations: AppliedTransformation[];
}

/**
 * Memory that failed to apply
 */
export interface FailedMemory {
  /** The memory that failed to apply */
  memory: Memory;
  
  /** Reason for failure */
  failureReason: string;
  
  /** Error details if applicable */
  errorDetails?: string;
  
  /** Whether this was a validation failure */
  validationFailure: boolean;
}

/**
 * Conflict that was resolved during application
 */
export interface ResolvedConflict {
  /** Type of conflict */
  conflictType: ConflictType;
  
  /** Memories involved in the conflict */
  conflictingMemories: Memory[];
  
  /** Memory that was selected */
  selectedMemory: Memory;
  
  /** Resolution strategy used */
  resolutionStrategy: string;
  
  /** Reasoning for the resolution */
  reasoning: string;
}

/**
 * Types of memory applications
 */
export enum MemoryApplicationType {
  FIELD_MAPPING = 'field_mapping',
  CORRECTION = 'correction',
  RESOLUTION = 'resolution',
  TRANSFORMATION = 'transformation',
  VALIDATION = 'validation'
}

/**
 * Types of conflicts during application
 */
export enum ConflictType {
  FIELD_MAPPING_CONFLICT = 'field_mapping_conflict',
  CORRECTION_CONFLICT = 'correction_conflict',
  TRANSFORMATION_CONFLICT = 'transformation_conflict',
  VALIDATION_CONFLICT = 'validation_conflict'
}

/**
 * Transformation that was applied
 */
export interface AppliedTransformation {
  /** Type of transformation */
  transformationType: TransformationType;
  
  /** Source field */
  sourceField: string;
  
  /** Target field */
  targetField: string;
  
  /** Original value */
  originalValue: unknown;
  
  /** Transformed value */
  transformedValue: unknown;
  
  /** Confidence in the transformation */
  confidence: number;
  
  /** Optional transformation rule used */
  transformationRule?: TransformationRule;
}

/**
 * Interface for the memory application engine
 */
export interface MemoryApplicationEngine {
  /**
   * Apply memories to transform a raw invoice into normalized format
   * @param invoice Raw invoice to transform
   * @param memories Memories to apply
   * @returns Application result with normalized invoice and metadata
   */
  applyMemories(invoice: RawInvoice, memories: Memory[]): Promise<MemoryApplicationResult>;

  /**
   * Apply field mappings from vendor memories
   * @param invoice Raw invoice
   * @param vendorMemories Vendor memories with field mappings
   * @returns Normalized fields and transformations
   */
  applyFieldMappings(invoice: RawInvoice, vendorMemories: VendorMemory[]): Promise<{
    normalizedFields: NormalizedField[];
    transformations: AppliedTransformation[];
  }>;

  /**
   * Generate correction suggestions from correction memories
   * @param invoice Raw invoice
   * @param correctionMemories Correction memories
   * @returns Array of suggested corrections
   */
  generateCorrections(invoice: RawInvoice, correctionMemories: CorrectionMemory[]): Promise<Correction[]>;

  /**
   * Resolve conflicts between memories
   * @param memories Conflicting memories
   * @param invoice Invoice context
   * @returns Resolved conflicts
   */
  resolveConflicts(memories: Memory[], invoice: RawInvoice): Promise<ResolvedConflict[]>;

  /**
   * Validate transformations and corrections
   * @param transformations Applied transformations
   * @param corrections Proposed corrections
   * @param invoice Original invoice
   * @returns Validation results
   */
  validateApplications(
    transformations: AppliedTransformation[],
    corrections: Correction[],
    invoice: RawInvoice
  ): Promise<ValidationResult[]>;

  /**
   * Get audit steps for memory application operations
   * @returns Array of audit steps
   */
  getAuditSteps(): AuditStep[];

  /**
   * Clear audit steps (for testing)
   */
  clearAuditSteps(): void;
}

/**
 * Validation result for transformations
 */
export interface ValidationResult {
  /** Whether validation passed */
  isValid: boolean;
  
  /** Field that was validated */
  field: string;
  
  /** Validation rule that was applied */
  validationRule: ValidationRule;
  
  /** Error message if validation failed */
  errorMessage?: string;
  
  /** Suggested fix if validation failed */
  suggestedFix?: string;
}

/**
 * Implementation of the memory application engine
 */
export class MemoryApplicationEngineImpl implements MemoryApplicationEngine {
  private config: MemoryApplicationConfig;
  private auditSteps: AuditStep[] = [];

  constructor(config?: Partial<MemoryApplicationConfig>) {
    this.config = {
      maxMemoriesPerInvoice: 20,
      minApplicationThreshold: 0.3,
      enableFieldMappings: true,
      enableCorrections: true,
      enableConflictResolution: true,
      maxCorrections: 10,
      enableValidation: true,
      transformationTimeout: 5000,
      ...config
    };
  }

  /**
   * Apply memories to transform a raw invoice into normalized format
   */
  async applyMemories(invoice: RawInvoice, memories: Memory[]): Promise<MemoryApplicationResult> {
    const startTime = Date.now();
    
    // Filter memories by confidence threshold
    const applicableMemories = memories.filter(
      memory => memory.confidence >= this.config.minApplicationThreshold
    ).slice(0, this.config.maxMemoriesPerInvoice);

    // Separate memories by type
    const vendorMemories = applicableMemories.filter(m => m.type === MemoryType.VENDOR) as VendorMemory[];
    const correctionMemories = applicableMemories.filter(m => m.type === MemoryType.CORRECTION) as CorrectionMemory[];
    const resolutionMemories = applicableMemories.filter(m => m.type === MemoryType.RESOLUTION) as ResolutionMemory[];

    // Resolve conflicts first
    const resolvedConflicts = this.config.enableConflictResolution 
      ? await this.resolveConflicts(applicableMemories, invoice)
      : [];

    // Apply field mappings
    const fieldMappingResult = this.config.enableFieldMappings
      ? await this.applyFieldMappings(invoice, vendorMemories)
      : { normalizedFields: [], transformations: [] };

    // Generate corrections
    const proposedCorrections = this.config.enableCorrections
      ? await this.generateCorrections(invoice, correctionMemories)
      : [];

    // Create normalized invoice
    const normalizedInvoice = await this.createNormalizedInvoice(
      invoice,
      fieldMappingResult.normalizedFields,
      fieldMappingResult.transformations,
      proposedCorrections
    );

    // Validate applications if enabled
    const validationResults = this.config.enableValidation
      ? await this.validateApplications(fieldMappingResult.transformations, proposedCorrections, invoice)
      : [];

    // Track applied and failed memories
    const appliedMemories: AppliedMemory[] = [];
    const failedMemories: FailedMemory[] = [];

    // Process vendor memories
    for (const memory of vendorMemories) {
      try {
        const transformations = fieldMappingResult.transformations.filter(
          t => this.isTransformationFromMemory(t, memory)
        );
        
        if (transformations.length > 0) {
          appliedMemories.push({
            memory,
            applicationType: MemoryApplicationType.FIELD_MAPPING,
            affectedFields: transformations.map(t => t.targetField),
            applicationConfidence: memory.confidence,
            reasoning: `Applied ${transformations.length} field mappings from vendor memory`,
            transformations
          });
        }
      } catch (error) {
        failedMemories.push({
          memory,
          failureReason: 'Field mapping application failed',
          errorDetails: error instanceof Error ? error.message : 'Unknown error',
          validationFailure: false
        });
      }
    }

    // Process correction memories
    const correctionMemoryMap = new Map<string, CorrectionMemory>();
    for (const memory of correctionMemories) {
      correctionMemoryMap.set(memory.id, memory);
    }

    for (const memory of correctionMemories) {
      try {
        const relatedCorrections = proposedCorrections.filter(
          c => this.isCorrectionFromMemory(c, memory)
        );
        
        if (relatedCorrections.length > 0) {
          appliedMemories.push({
            memory,
            applicationType: MemoryApplicationType.CORRECTION,
            affectedFields: relatedCorrections.map(c => c.field),
            applicationConfidence: memory.confidence,
            reasoning: `Generated ${relatedCorrections.length} corrections from correction memory`,
            transformations: []
          });
        }
      } catch (error) {
        failedMemories.push({
          memory,
          failureReason: 'Correction generation failed',
          errorDetails: error instanceof Error ? error.message : 'Unknown error',
          validationFailure: false
        });
      }
    }

    // Process resolution memories (for future use)
    for (const memory of resolutionMemories) {
      appliedMemories.push({
        memory,
        applicationType: MemoryApplicationType.RESOLUTION,
        affectedFields: [],
        applicationConfidence: memory.confidence,
        reasoning: 'Resolution memory available for future discrepancy handling',
        transformations: []
      });
    }

    // Calculate overall application confidence
    const applicationConfidence = this.calculateApplicationConfidence(
      appliedMemories,
      failedMemories,
      validationResults
    );

    // Generate reasoning
    const reasoning = this.generateApplicationReasoning(
      appliedMemories,
      failedMemories,
      resolvedConflicts,
      validationResults
    );

    // Record audit step
    this.recordAuditStep({
      id: `apply-${Date.now()}`,
      timestamp: new Date(),
      operation: AuditOperation.MEMORY_APPLICATION,
      description: 'Applied memories to normalize invoice',
      input: {
        invoiceId: invoice.id,
        memoriesCount: memories.length,
        applicableMemoriesCount: applicableMemories.length
      },
      output: {
        appliedMemoriesCount: appliedMemories.length,
        failedMemoriesCount: failedMemories.length,
        normalizedFieldsCount: fieldMappingResult.normalizedFields.length,
        correctionsCount: proposedCorrections.length,
        applicationConfidence
      },
      actor: 'MemoryApplicationEngine',
      duration: Date.now() - startTime
    });

    return {
      normalizedInvoice,
      proposedCorrections: proposedCorrections.slice(0, this.config.maxCorrections),
      normalizedFields: fieldMappingResult.normalizedFields,
      appliedMemories,
      failedMemories,
      resolvedConflicts,
      applicationConfidence,
      reasoning,
      auditSteps: [...this.auditSteps]
    };
  }

  /**
   * Apply field mappings from vendor memories
   */
  async applyFieldMappings(invoice: RawInvoice, vendorMemories: VendorMemory[]): Promise<{
    normalizedFields: NormalizedField[];
    transformations: AppliedTransformation[];
  }> {
    const normalizedFields: NormalizedField[] = [];
    const transformations: AppliedTransformation[] = [];

    // Group field mappings by source->target field pair to handle conflicts
    const fieldMappingGroups = new Map<string, { memory: VendorMemory; mapping: any }[]>();
    
    for (const memory of vendorMemories) {
      for (const mapping of memory.fieldMappings) {
        const key = `${mapping.sourceField}->${mapping.targetField}`;
        if (!fieldMappingGroups.has(key)) {
          fieldMappingGroups.set(key, []);
        }
        fieldMappingGroups.get(key)!.push({ memory, mapping });
      }
    }

    // For each field mapping group, select the highest confidence memory
    for (const [fieldKey, mappingGroup] of fieldMappingGroups.entries()) {
      // Sort by memory confidence descending
      const sortedMappings = mappingGroup.sort((a, b) => b.memory.confidence - a.memory.confidence);
      
      // Use the highest confidence mapping
      const { memory, mapping } = sortedMappings[0]!;
      
      try {
        const sourceValue = this.extractFieldValue(invoice, mapping.sourceField);
        
        if (sourceValue !== undefined && sourceValue !== null) {
          const transformedValue = await this.applyTransformation(
            sourceValue,
            mapping.transformationRule
          );

          normalizedFields.push({
            originalField: mapping.sourceField,
            normalizedField: mapping.targetField,
            originalValue: sourceValue,
            normalizedValue: transformedValue,
            memoryId: memory.id,
            confidence: mapping.confidence
          });

          transformations.push({
            transformationType: mapping.transformationRule?.type || TransformationType.DIRECT_MAPPING,
            sourceField: mapping.sourceField,
            targetField: mapping.targetField,
            originalValue: sourceValue,
            transformedValue,
            confidence: mapping.confidence,
            ...(mapping.transformationRule && { transformationRule: mapping.transformationRule })
          });
          
          // Record audit step for field mapping selection
          if (sortedMappings.length > 1) {
            this.recordAuditStep({
              id: `field-mapping-selection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date(),
              operation: AuditOperation.MEMORY_APPLICATION,
              description: `Selected highest confidence field mapping for ${fieldKey}`,
              input: {
                fieldKey,
                availableMappings: sortedMappings.length,
                selectedMemoryId: memory.id,
                selectedConfidence: memory.confidence
              },
              output: {
                transformedValue,
                transformationType: mapping.transformationRule?.type || 'direct'
              },
              actor: 'MemoryApplicationEngine',
              duration: 0
            });
          }
        }
      } catch (error) {
        // Log transformation error but continue with other mappings
        console.warn(`Failed to apply field mapping ${mapping.sourceField} -> ${mapping.targetField}:`, error);
      }
    }

    return { normalizedFields, transformations };
  }

  /**
   * Generate correction suggestions from correction memories
   */
  async generateCorrections(invoice: RawInvoice, correctionMemories: CorrectionMemory[]): Promise<Correction[]> {
    const corrections: Correction[] = [];

    // Group correction memories by target field to handle conflicts across all memories
    const correctionGroups = new Map<string, CorrectionMemory[]>();
    
    for (const memory of correctionMemories) {
      const targetField = memory.correctionAction.targetField;
      if (!correctionGroups.has(targetField)) {
        correctionGroups.set(targetField, []);
      }
      correctionGroups.get(targetField)!.push(memory);
    }

    // For each field, select the single highest confidence memory across all memories
    for (const [targetField, memories] of correctionGroups.entries()) {
      // Sort by confidence descending to get the absolute highest confidence memory
      const sortedMemories = memories.sort((a, b) => b.confidence - a.confidence);
      
      // Try memories in order of confidence until one succeeds
      for (const memory of sortedMemories) {
        try {
          // Check if trigger conditions are met
          const conditionsMet = await this.evaluateConditions(invoice, memory.triggerConditions);
          
          if (conditionsMet) {
            const correction = await this.createCorrectionFromMemory(invoice, memory);
            if (correction) {
              corrections.push(correction);
              
              // Record audit step for correction selection
              this.recordAuditStep({
                id: `correction-selection-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
                timestamp: new Date(),
                operation: AuditOperation.MEMORY_APPLICATION,
                description: `Selected highest confidence correction for field ${targetField}`,
                input: {
                  targetField,
                  availableMemories: memories.length,
                  selectedMemoryId: memory.id,
                  selectedConfidence: memory.confidence,
                  allConfidences: memories.map(m => m.confidence)
                },
                output: {
                  correctionGenerated: true,
                  correctionValue: correction.correctedValue
                },
                actor: 'MemoryApplicationEngine',
                duration: 0
              });
              
              break; // Only use the highest confidence memory that works for this field
            }
          }
        } catch (error) {
          console.warn(`Failed to generate correction from memory ${memory.id}:`, error);
          // Continue to next memory in confidence order
        }
      }
    }

    return corrections;
  }

  /**
   * Resolve conflicts between memories
   */
  async resolveConflicts(memories: Memory[], invoice: RawInvoice): Promise<ResolvedConflict[]> {
    const conflicts: ResolvedConflict[] = [];
    
    // Group memories by potential conflict areas
    const fieldMappingGroups = this.groupMemoriesByFieldMapping(memories);
    const correctionGroups = this.groupMemoriesByCorrection(memories);

    // Resolve field mapping conflicts
    for (const [fieldKey, conflictingMemories] of fieldMappingGroups.entries()) {
      if (conflictingMemories.length > 1) {
        const selectedMemory = this.selectBestMemory(conflictingMemories, invoice);
        
        const conflict: ResolvedConflict = {
          conflictType: ConflictType.FIELD_MAPPING_CONFLICT,
          conflictingMemories,
          selectedMemory,
          resolutionStrategy: 'highest_confidence',
          reasoning: `Selected memory with highest confidence (${selectedMemory.confidence.toFixed(3)}) for field mapping ${fieldKey}`
        };
        
        conflicts.push(conflict);
        
        // Record audit step for conflict resolution
        this.recordAuditStep({
          id: `conflict-resolution-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          operation: AuditOperation.MEMORY_APPLICATION,
          description: `Resolved field mapping conflict for ${fieldKey}`,
          input: {
            conflictType: 'field_mapping_conflict',
            conflictingMemoryIds: conflictingMemories.map(m => m.id),
            fieldKey
          },
          output: {
            selectedMemoryId: selectedMemory.id,
            selectedConfidence: selectedMemory.confidence,
            resolutionStrategy: 'highest_confidence'
          },
          actor: 'MemoryApplicationEngine',
          duration: 0
        });
      }
    }

    // Resolve correction conflicts
    for (const [correctionKey, conflictingMemories] of correctionGroups.entries()) {
      if (conflictingMemories.length > 1) {
        const selectedMemory = this.selectBestMemory(conflictingMemories, invoice);
        
        const conflict: ResolvedConflict = {
          conflictType: ConflictType.CORRECTION_CONFLICT,
          conflictingMemories,
          selectedMemory,
          resolutionStrategy: 'highest_confidence',
          reasoning: `Selected memory with highest confidence (${selectedMemory.confidence.toFixed(3)}) for correction ${correctionKey}`
        };
        
        conflicts.push(conflict);
        
        // Record audit step for conflict resolution
        this.recordAuditStep({
          id: `conflict-resolution-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: new Date(),
          operation: AuditOperation.MEMORY_APPLICATION,
          description: `Resolved correction conflict for ${correctionKey}`,
          input: {
            conflictType: 'correction_conflict',
            conflictingMemoryIds: conflictingMemories.map(m => m.id),
            correctionKey
          },
          output: {
            selectedMemoryId: selectedMemory.id,
            selectedConfidence: selectedMemory.confidence,
            resolutionStrategy: 'highest_confidence'
          },
          actor: 'MemoryApplicationEngine',
          duration: 0
        });
      }
    }

    return conflicts;
  }

  /**
   * Validate transformations and corrections
   */
  async validateApplications(
    transformations: AppliedTransformation[],
    corrections: Correction[],
    _invoice: RawInvoice
  ): Promise<ValidationResult[]> {
    const validationResults: ValidationResult[] = [];

    // Validate transformations
    for (const transformation of transformations) {
      const validationResult = await this.validateTransformation(transformation);
      validationResults.push(validationResult);
    }

    // Validate corrections
    for (const correction of corrections) {
      const validationResult = await this.validateCorrection(correction);
      validationResults.push(validationResult);
    }

    return validationResults;
  }

  /**
   * Get audit steps for memory application operations
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

  private extractFieldValue(invoice: RawInvoice, fieldName: string): unknown {
    // First check extracted fields
    const extractedField = invoice.extractedFields.find(f => f.name === fieldName);
    if (extractedField) {
      return extractedField.value;
    }

    // Then check common field patterns in raw text
    const rawTextValue = this.extractFromRawText(invoice.rawText, fieldName);
    if (rawTextValue !== undefined) {
      return rawTextValue;
    }

    // Return undefined if field not found
    return undefined;
  }

  private extractFromRawText(rawText: string, fieldName: string): unknown {
    // Simple pattern matching for common fields
    const patterns: Record<string, RegExp> = {
      'Leistungsdatum': /Leistungsdatum[:\s]+([^\n\r]+)/i,
      'serviceDate': /service\s*date[:\s]+([^\n\r]+)/i,
      'invoiceNumber': /invoice\s*(?:number|#)[:\s]+([^\n\r\s]+)/i,
      'totalAmount': /total[:\s]+([0-9,.\s]+)/i,
      'currency': /\b([A-Z]{3})\b/i // This is too broad and matches "EUR" in the text
    };

    const pattern = patterns[fieldName];
    if (pattern) {
      const match = rawText.match(pattern);
      if (match && fieldName === 'currency') {
        // For currency, only return if it's actually a currency code, not part of other text
        const potentialCurrency = match[1] || match[0];
        const currencyCodes = ['EUR', 'USD', 'GBP', 'CHF', 'JPY'];
        if (currencyCodes.includes(potentialCurrency.trim().toUpperCase())) {
          return potentialCurrency.trim().toUpperCase();
        }
        return undefined;
      }
      return match ? (match[1] || match[2] || match[0]).trim() : undefined;
    }

    return undefined;
  }

  private async applyTransformation(value: unknown, rule?: TransformationRule): Promise<unknown> {
    if (!rule) {
      return value; // Direct mapping
    }

    const stringValue = String(value);

    switch (rule.type) {
      case TransformationType.DIRECT_MAPPING:
        return value;

      case TransformationType.DATE_PARSING:
        return this.parseDate(stringValue, rule.parameters);

      case TransformationType.CURRENCY_EXTRACTION:
        return this.extractCurrency(stringValue, rule.parameters);

      case TransformationType.TEXT_NORMALIZATION:
        return this.normalizeText(stringValue, rule.parameters);

      case TransformationType.REGEX_EXTRACTION:
        return this.extractWithRegex(stringValue, rule.parameters);

      default:
        return value;
    }
  }

  private parseDate(value: string, parameters: Record<string, unknown>): Date | undefined {
    try {
      const format = parameters['format'] as string || 'auto';
      
      if (format === 'auto') {
        // Try common date formats
        const datePatterns = [
          /(\d{1,2})\.(\d{1,2})\.(\d{4})/,  // DD.MM.YYYY
          /(\d{4})-(\d{1,2})-(\d{1,2})/,   // YYYY-MM-DD
          /(\d{1,2})\/(\d{1,2})\/(\d{4})/  // MM/DD/YYYY
        ];

        for (const pattern of datePatterns) {
          const match = value.match(pattern);
          if (match) {
            if (pattern.source.includes('\\.')) {
              // DD.MM.YYYY format
              return new Date(parseInt(match[3]!), parseInt(match[2]!) - 1, parseInt(match[1]!));
            } else if (pattern.source.includes('-')) {
              // YYYY-MM-DD format
              return new Date(parseInt(match[1]!), parseInt(match[2]!) - 1, parseInt(match[3]!));
            } else {
              // MM/DD/YYYY format
              return new Date(parseInt(match[3]!), parseInt(match[1]!) - 1, parseInt(match[2]!));
            }
          }
        }
      }

      // Fallback to standard Date parsing
      return new Date(value);
    } catch {
      return undefined;
    }
  }

  private extractCurrency(value: string, parameters: Record<string, unknown>): Money | undefined {
    try {
      const defaultCurrency = parameters['defaultCurrency'] as string || 'EUR';
      
      // Extract amount and currency
      const amountMatch = value.match(/([0-9,.\s]+)/);
      const currencyMatch = value.match(/([A-Z]{3})/);
      
      if (amountMatch) {
        const amountStr = amountMatch[1]!.replace(/[,\s]/g, '');
        const amount = parseFloat(amountStr);
        const currency = currencyMatch ? currencyMatch[1]! : defaultCurrency;
        
        return { amount, currency };
      }
      
      return undefined;
    } catch {
      return undefined;
    }
  }

  private normalizeText(value: string, parameters: Record<string, unknown>): string {
    let normalized = value;
    
    if (parameters['trim'] !== false) {
      normalized = normalized.trim();
    }
    
    if (parameters['toLowerCase']) {
      normalized = normalized.toLowerCase();
    }
    
    if (parameters['removeExtraSpaces'] !== false) {
      normalized = normalized.replace(/\s+/g, ' ');
    }
    
    return normalized;
  }

  private extractWithRegex(value: string, parameters: Record<string, unknown>): string | undefined {
    try {
      const pattern = parameters['pattern'] as string;
      const flags = parameters['flags'] as string || 'i';
      
      if (pattern) {
        const regex = new RegExp(pattern, flags);
        const match = value.match(regex);
        return match ? match[1] || match[0] : undefined;
      }
      
      return undefined;
    } catch {
      return undefined;
    }
  }

  private async evaluateConditions(invoice: RawInvoice, conditions: Condition[]): Promise<boolean> {
    for (const condition of conditions) {
      const fieldValue = this.extractFieldValue(invoice, condition.field);
      const conditionMet = this.evaluateCondition(fieldValue, condition);
      
      if (!conditionMet) {
        return false; // All conditions must be met
      }
    }
    
    return conditions.length > 0; // Return true only if there are conditions and all are met
  }

  private evaluateCondition(fieldValue: unknown, condition: Condition): boolean {
    switch (condition.operator) {
      case ConditionOperator.EQUALS:
        return fieldValue === condition.value;
        
      case ConditionOperator.NOT_EQUALS:
        return fieldValue !== condition.value;
        
      case ConditionOperator.GREATER_THAN:
        return typeof fieldValue === 'number' && typeof condition.value === 'number' 
          ? fieldValue > condition.value : false;
        
      case ConditionOperator.LESS_THAN:
        return typeof fieldValue === 'number' && typeof condition.value === 'number' 
          ? fieldValue < condition.value : false;
        
      case ConditionOperator.CONTAINS:
        return typeof fieldValue === 'string' && typeof condition.value === 'string'
          ? fieldValue.includes(condition.value) : false;
        
      case ConditionOperator.MATCHES_REGEX:
        if (typeof fieldValue === 'string' && typeof condition.value === 'string') {
          try {
            const regex = new RegExp(condition.value, 'i');
            return regex.test(fieldValue);
          } catch {
            return false;
          }
        }
        return false;
        
      case ConditionOperator.EXISTS:
        return fieldValue !== undefined && fieldValue !== null;
        
      case ConditionOperator.NOT_EXISTS:
        return fieldValue === undefined || fieldValue === null;
        
      default:
        return false;
    }
  }

  private async createCorrectionFromMemory(invoice: RawInvoice, memory: CorrectionMemory): Promise<Correction | undefined> {
    try {
      const fieldValue = this.extractFieldValue(invoice, memory.correctionAction.targetField);
      const correctedValue = await this.applyCorrectionAction(fieldValue, memory.correctionAction);
      
      return {
        field: memory.correctionAction.targetField,
        originalValue: fieldValue,
        correctedValue,
        reason: memory.correctionAction.explanation || `Applied correction from memory ${memory.id}`,
        confidence: memory.confidence,
        memoryId: memory.id // Add memory ID to track source
      };
    } catch {
      return undefined;
    }
  }

  private async applyCorrectionAction(originalValue: unknown, action: CorrectionAction): Promise<unknown> {
    switch (action.actionType) {
      case CorrectionActionType.SET_VALUE:
        return action.newValue;
        
      case CorrectionActionType.MULTIPLY_BY:
        if (typeof originalValue === 'number' && typeof action.newValue === 'number') {
          return originalValue * action.newValue;
        }
        return originalValue;
        
      case CorrectionActionType.ADD_VALUE:
        if (typeof originalValue === 'number' && typeof action.newValue === 'number') {
          return originalValue + action.newValue;
        }
        return originalValue;
        
      case CorrectionActionType.REPLACE_TEXT:
        if (typeof originalValue === 'string' && typeof action.newValue === 'string') {
          return originalValue.replace(new RegExp(action.newValue, 'g'), String(action.newValue));
        }
        return originalValue;
        
      case CorrectionActionType.APPLY_TRANSFORMATION:
        // This would apply a transformation rule - simplified for now
        return action.newValue;
        
      default:
        return originalValue;
    }
  }

  private async createNormalizedInvoice(
    rawInvoice: RawInvoice,
    normalizedFields: NormalizedField[],
    transformations: AppliedTransformation[],
    corrections: Correction[]
  ): Promise<NormalizedInvoice> {
    // Start with basic invoice structure
    const normalized: NormalizedInvoice = {
      id: rawInvoice.id,
      vendorId: rawInvoice.vendorId,
      invoiceNumber: rawInvoice.invoiceNumber,
      invoiceDate: new Date(), // Will be overridden if found
      totalAmount: { amount: 0, currency: 'EUR' }, // Will be overridden if found
      currency: 'EUR',
      lineItems: [],
      normalizedFields
    };

    // Apply transformations to populate normalized fields
    for (const transformation of transformations) {
      this.applyTransformationToInvoice(normalized, transformation);
    }

    // Apply corrections
    for (const correction of corrections) {
      this.applyCorrectionToInvoice(normalized, correction);
    }

    // Extract line items from raw text (simplified)
    normalized.lineItems = this.extractLineItems(rawInvoice);

    // Ensure required fields have defaults
    if (!normalized.invoiceDate) {
      normalized.invoiceDate = new Date();
    }

    if (normalized.totalAmount.amount === 0) {
      // Calculate from line items
      normalized.totalAmount.amount = normalized.lineItems.reduce(
        (sum, item) => sum + item.totalPrice.amount, 0
      );
    }

    return normalized;
  }

  private applyTransformationToInvoice(invoice: NormalizedInvoice, transformation: AppliedTransformation): void {
    switch (transformation.targetField) {
      case 'serviceDate':
        if (transformation.transformedValue instanceof Date) {
          invoice.serviceDate = transformation.transformedValue;
        }
        break;
        
      case 'invoiceDate':
        if (transformation.transformedValue instanceof Date) {
          invoice.invoiceDate = transformation.transformedValue;
        }
        break;
        
      case 'dueDate':
        if (transformation.transformedValue instanceof Date) {
          invoice.dueDate = transformation.transformedValue;
        }
        break;
        
      case 'totalAmount':
        if (typeof transformation.transformedValue === 'object' && transformation.transformedValue !== null) {
          const money = transformation.transformedValue as Money;
          if (money.amount !== undefined && money.currency) {
            invoice.totalAmount = money;
            invoice.currency = money.currency;
          }
        }
        break;
        
      case 'purchaseOrderNumber':
        if (typeof transformation.transformedValue === 'string') {
          invoice.purchaseOrderNumber = transformation.transformedValue;
        }
        break;
    }
  }

  private applyCorrectionToInvoice(invoice: NormalizedInvoice, correction: Correction): void {
    // Apply correction to the appropriate field
    switch (correction.field) {
      case 'totalAmount':
        if (typeof correction.correctedValue === 'object' && correction.correctedValue !== null) {
          const money = correction.correctedValue as Money;
          if (money.amount !== undefined) {
            invoice.totalAmount = money;
          }
        }
        break;
        
      case 'currency':
        if (typeof correction.correctedValue === 'string') {
          invoice.currency = correction.correctedValue;
          invoice.totalAmount.currency = correction.correctedValue;
        }
        break;
        
      // Add more field corrections as needed
    }
  }

  private extractLineItems(rawInvoice: RawInvoice): LineItem[] {
    // Simplified line item extraction
    // In a real implementation, this would be more sophisticated
    const lineItems: LineItem[] = [];
    
    // Try to find line items in extracted fields
    const lineItemFields = rawInvoice.extractedFields.filter(
      field => field.name.includes('lineItem') || field.name.includes('item')
    );
    
    if (lineItemFields.length === 0) {
      // Create a default line item if none found
      lineItems.push({
        description: 'Service/Product',
        quantity: 1,
        unitPrice: { amount: 0, currency: 'EUR' },
        totalPrice: { amount: 0, currency: 'EUR' }
      });
    }
    
    return lineItems;
  }

  private groupMemoriesByFieldMapping(memories: Memory[]): Map<string, Memory[]> {
    const groups = new Map<string, Memory[]>();
    
    for (const memory of memories) {
      if (memory.type === MemoryType.VENDOR) {
        const vendorMemory = memory as VendorMemory;
        for (const mapping of vendorMemory.fieldMappings) {
          const key = `${mapping.sourceField}->${mapping.targetField}`;
          if (!groups.has(key)) {
            groups.set(key, []);
          }
          groups.get(key)!.push(memory);
        }
      }
    }
    
    return groups;
  }

  private groupMemoriesByCorrection(memories: Memory[]): Map<string, Memory[]> {
    const groups = new Map<string, Memory[]>();
    
    for (const memory of memories) {
      if (memory.type === MemoryType.CORRECTION) {
        const correctionMemory = memory as CorrectionMemory;
        const key = `${correctionMemory.correctionType}-${correctionMemory.correctionAction.targetField}`;
        if (!groups.has(key)) {
          groups.set(key, []);
        }
        groups.get(key)!.push(memory);
      }
    }
    
    return groups;
  }

  private selectBestMemory(memories: Memory[], _invoice: RawInvoice): Memory {
    // Select memory with highest confidence
    return memories.reduce((best, current) => 
      current.confidence > best.confidence ? current : best
    );
  }

  private isTransformationFromMemory(transformation: AppliedTransformation, memory: VendorMemory): boolean {
    return memory.fieldMappings.some(
      mapping => mapping.sourceField === transformation.sourceField && 
                 mapping.targetField === transformation.targetField
    );
  }

  private isCorrectionFromMemory(correction: Correction, memory: CorrectionMemory): boolean {
    // First check if the correction has a memoryId that matches
    if (correction.memoryId) {
      return correction.memoryId === memory.id;
    }
    
    // Fallback to field matching (for backwards compatibility)
    return memory.correctionAction.targetField === correction.field;
  }

  private calculateApplicationConfidence(
    appliedMemories: AppliedMemory[],
    failedMemories: FailedMemory[],
    validationResults: ValidationResult[]
  ): number {
    // If no memories were applied, return a baseline confidence
    if (appliedMemories.length === 0) {
      return 0.5; // Neutral confidence when no memories are applied
    }

    // Base confidence from applied memories
    const avgMemoryConfidence = appliedMemories.reduce(
      (sum, memory) => sum + memory.applicationConfidence, 0
    ) / appliedMemories.length;

    // Penalty for failed memories
    const failurePenalty = failedMemories.length * 0.1;

    // Penalty for validation failures
    const validationFailures = validationResults.filter(r => !r.isValid).length;
    const validationPenalty = validationFailures * 0.05;

    // Calculate final confidence
    const confidence = Math.max(0.1, avgMemoryConfidence - failurePenalty - validationPenalty);
    
    return Math.min(1, confidence);
  }

  private generateApplicationReasoning(
    appliedMemories: AppliedMemory[],
    failedMemories: FailedMemory[],
    resolvedConflicts: ResolvedConflict[],
    validationResults: ValidationResult[]
  ): string {
    const parts: string[] = [];

    // Enhanced reasoning with more detail
    if (appliedMemories.length > 0) {
      parts.push(`Successfully applied ${appliedMemories.length} memories`);
      
      // Break down by application type
      const typeBreakdown = appliedMemories.reduce((acc, memory) => {
        acc[memory.applicationType] = (acc[memory.applicationType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const typeDescriptions = Object.entries(typeBreakdown)
        .map(([type, count]) => {
          switch (type) {
            case 'field_mapping':
              return `${count} field mappings (vendor-specific transformations)`;
            case 'correction':
              return `${count} corrections (learned from human feedback)`;
            case 'resolution':
              return `${count} resolution patterns (discrepancy handling)`;
            case 'transformation':
              return `${count} data transformations (format conversions)`;
            case 'validation':
              return `${count} validation rules (quality checks)`;
            default:
              return `${count} ${type.replace('_', ' ')} operations`;
          }
        })
        .join(', ');
      
      if (typeDescriptions) {
        parts.push(`Memory applications included: ${typeDescriptions}`);
      }
      
      // Confidence analysis
      const avgConfidence = appliedMemories.reduce((sum, m) => sum + m.applicationConfidence, 0) / appliedMemories.length;
      parts.push(`Average application confidence: ${(avgConfidence * 100).toFixed(1)}%`);
      
      // High-impact memories
      const highImpactMemories = appliedMemories.filter(m => 
        m.applicationConfidence >= 0.8 && m.memory.usageCount >= 3
      );
      if (highImpactMemories.length > 0) {
        parts.push(`${highImpactMemories.length} high-impact memories with proven track record applied`);
      }
      
      // Field impact analysis
      const affectedFields = new Set(appliedMemories.flatMap(m => m.affectedFields));
      if (affectedFields.size > 0) {
        parts.push(`Transformed ${affectedFields.size} invoice fields: ${Array.from(affectedFields).join(', ')}`);
      }
    } else {
      parts.push('No memories were applied - processed using default logic');
    }

    // Failed memory analysis
    if (failedMemories.length > 0) {
      parts.push(`${failedMemories.length} memories failed to apply`);
      
      const validationFailures = failedMemories.filter(m => m.validationFailure).length;
      const otherFailures = failedMemories.length - validationFailures;
      
      if (validationFailures > 0) {
        parts.push(`${validationFailures} failed due to validation issues`);
      }
      if (otherFailures > 0) {
        parts.push(`${otherFailures} failed due to compatibility or data issues`);
      }
      
      // Specific failure reasons
      const failureReasons = failedMemories.reduce((acc, memory) => {
        acc[memory.failureReason] = (acc[memory.failureReason] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const reasonSummary = Object.entries(failureReasons)
        .map(([reason, count]) => `${count} due to ${reason}`)
        .join(', ');
      
      if (reasonSummary) {
        parts.push(`Failure breakdown: ${reasonSummary}`);
      }
    }

    // Conflict resolution analysis
    if (resolvedConflicts.length > 0) {
      parts.push(`Resolved ${resolvedConflicts.length} memory conflicts`);
      
      const conflictTypes = resolvedConflicts.reduce((acc, conflict) => {
        acc[conflict.conflictType] = (acc[conflict.conflictType] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);
      
      const conflictSummary = Object.entries(conflictTypes)
        .map(([type, count]) => {
          switch (type) {
            case 'field_mapping_conflict':
              return `${count} field mapping conflicts`;
            case 'correction_conflict':
              return `${count} correction conflicts`;
            case 'transformation_conflict':
              return `${count} transformation conflicts`;
            case 'validation_conflict':
              return `${count} validation conflicts`;
            default:
              return `${count} ${type.replace('_', ' ')} conflicts`;
          }
        })
        .join(', ');
      
      parts.push(`Conflict types resolved: ${conflictSummary}`);
      
      // Resolution strategies used
      const strategies = [...new Set(resolvedConflicts.map(c => c.resolutionStrategy))];
      if (strategies.length > 0) {
        parts.push(`Resolution strategies: ${strategies.join(', ')}`);
      }
    }

    // Validation analysis
    const validationFailures = validationResults.filter(r => !r.isValid).length;
    const validationSuccesses = validationResults.filter(r => r.isValid).length;
    
    if (validationResults.length > 0) {
      parts.push(`Validation results: ${validationSuccesses} passed, ${validationFailures} failed`);
      
      if (validationFailures > 0) {
        // Group validation failures by type
        const failureTypes = validationResults
          .filter(r => !r.isValid)
          .reduce((acc, result) => {
            const type = result.validationRule.validationType;
            acc[type] = (acc[type] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
        
        const failureTypeSummary = Object.entries(failureTypes)
          .map(([type, count]) => `${count} ${type.replace('_', ' ')} failures`)
          .join(', ');
        
        parts.push(`Validation failure types: ${failureTypeSummary}`);
      }
    }

    // Overall assessment
    const successRate = appliedMemories.length / (appliedMemories.length + failedMemories.length);
    if (appliedMemories.length + failedMemories.length > 0) {
      parts.push(`Overall memory application success rate: ${(successRate * 100).toFixed(1)}%`);
    }

    return parts.join('. ') + '.';
  }

  private async validateTransformation(transformation: AppliedTransformation): Promise<ValidationResult> {
    // Basic validation - check if transformation produced a valid result
    const isValid = transformation.transformedValue !== undefined && 
                   transformation.transformedValue !== null;

    return {
      isValid,
      field: transformation.targetField,
      validationRule: {
        validationType: ValidationType.FORMAT_CHECK,
        parameters: { transformationType: transformation.transformationType },
        errorMessage: 'Transformation failed to produce valid result'
      },
      errorMessage: isValid ? undefined : 'Transformation produced null or undefined result',
      suggestedFix: isValid ? undefined : 'Review transformation rule and source data'
    } as ValidationResult;
  }

  private async validateCorrection(correction: Correction): Promise<ValidationResult> {
    // Basic validation - check if correction has valid values
    const isValid = correction.correctedValue !== undefined && 
                   correction.correctedValue !== null &&
                   correction.confidence > 0;

    return {
      isValid,
      field: correction.field,
      validationRule: {
        validationType: ValidationType.BUSINESS_RULE_CHECK,
        parameters: { correctionType: 'general' },
        errorMessage: 'Correction validation failed'
      },
      errorMessage: isValid ? undefined : 'Correction has invalid values or zero confidence',
      suggestedFix: isValid ? undefined : 'Review correction logic and confidence calculation'
    } as ValidationResult;
  }

  private recordAuditStep(step: AuditStep): void {
    this.auditSteps.push(step);
  }
}

/**
 * Create a memory application engine instance
 */
export function createMemoryApplicationEngine(
  config?: Partial<MemoryApplicationConfig>
): MemoryApplicationEngine {
  return new MemoryApplicationEngineImpl(config);
}