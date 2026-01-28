/**
 * Vendor Pattern Recognition System
 * 
 * Implements vendor memory isolation, vendor-specific field mapping learning,
 * and VAT behavior pattern recognition as specified in task 9.1.
 * 
 * Requirements: 2.1, 2.2, 2.3, 2.5
 */

import {
  MemoryType,
  VendorMemory,
  FieldMapping,
  VATBehavior,
  CurrencyPattern,
  DateFormat,
  RawInvoice,
  ExtractedField,
  TransformationType,
  TransformationRule,
  MappingExample,
  MemoryPattern,
  PatternType,
  MemoryContext,
  ComplexityLevel,
  QualityLevel,
  AuditStep,
  AuditOperation
} from '../types';
import { MemoryRepository } from '../database/memory-repository';
import { MemoryFactory } from './memory-base';

/**
 * Configuration for vendor pattern recognition
 */
export interface VendorPatternConfig {
  /** Minimum confidence threshold for creating new patterns */
  minPatternConfidence: number;
  
  /** Minimum number of examples required to establish a pattern */
  minExamplesForPattern: number;
  
  /** Maximum age in days for pattern examples */
  maxExampleAgeDays: number;
  
  /** Enable automatic VAT behavior detection */
  enableVATDetection: boolean;
  
  /** Enable currency pattern learning */
  enableCurrencyLearning: boolean;
  
  /** Enable date format learning */
  enableDateFormatLearning: boolean;
  
  /** Confidence boost for vendor-specific patterns */
  vendorSpecificBoost: number;
}

/**
 * Result of vendor pattern recognition
 */
export interface VendorPatternResult {
  /** Vendor ID that was analyzed */
  vendorId: string;
  
  /** Detected field mappings */
  detectedMappings: FieldMapping[];
  
  /** Detected VAT behavior patterns */
  vatBehavior: VATBehavior;
  
  /** Detected currency patterns */
  currencyPatterns: CurrencyPattern[];
  
  /** Detected date formats */
  dateFormats: DateFormat[];
  
  /** Confidence in the overall pattern recognition */
  overallConfidence: number;
  
  /** Reasoning for the pattern recognition */
  reasoning: string;
  
  /** Whether new patterns were learned */
  newPatternsLearned: boolean;
}

/**
 * Vendor-specific learning context
 */
export interface VendorLearningContext {
  /** Current invoice being processed */
  invoice: RawInvoice;
  
  /** Historical invoices from this vendor */
  historicalInvoices: RawInvoice[];
  
  /** Existing vendor memory if available */
  existingMemory?: VendorMemory;
  
  /** Human corrections applied to this vendor's invoices */
  humanCorrections: VendorCorrection[];
}

/**
 * Human correction specific to a vendor
 */
export interface VendorCorrection {
  /** Invoice ID where correction was applied */
  invoiceId: string;
  
  /** Field that was corrected */
  fieldName: string;
  
  /** Original extracted value */
  originalValue: unknown;
  
  /** Corrected value */
  correctedValue: unknown;
  
  /** Timestamp of correction */
  timestamp: Date;
  
  /** Confidence in the correction */
  confidence: number;
}

/**
 * Interface for vendor pattern recognition engine
 */
export interface VendorPatternRecognitionEngine {
  /**
   * Analyze vendor patterns and learn from invoice data
   * @param context Vendor learning context
   * @returns Pattern recognition results
   */
  recognizePatterns(context: VendorLearningContext): Promise<VendorPatternResult>;
  
  /**
   * Isolate vendor memories to prevent cross-vendor contamination
   * @param vendorId Vendor to isolate memories for
   * @returns Isolated vendor memories
   */
  isolateVendorMemories(vendorId: string): Promise<VendorMemory[]>;
  
  /**
   * Learn field mappings from vendor-specific examples
   * @param vendorId Vendor ID
   * @param examples Field mapping examples
   * @returns Learned field mappings
   */
  learnFieldMappings(vendorId: string, examples: MappingExample[]): Promise<FieldMapping[]>;
  
  /**
   * Detect VAT behavior patterns for a vendor
   * @param vendorId Vendor ID
   * @param invoices Historical invoices
   * @returns Detected VAT behavior
   */
  detectVATBehavior(vendorId: string, invoices: RawInvoice[]): Promise<VATBehavior>;
  
  /**
   * Update vendor memory with new patterns
   * @param vendorId Vendor ID
   * @param patterns New patterns to add
   * @returns Updated vendor memory
   */
  updateVendorMemory(vendorId: string, patterns: VendorPatternResult): Promise<VendorMemory>;
  
  /**
   * Get audit steps for pattern recognition operations
   * @returns Array of audit steps
   */
  getAuditSteps(): AuditStep[];
  
  /**
   * Clear audit steps (for testing)
   */
  clearAuditSteps(): void;
}

/**
 * Implementation of vendor pattern recognition engine
 */
export class VendorPatternRecognitionEngineImpl implements VendorPatternRecognitionEngine {
  private repository: MemoryRepository;
  private config: VendorPatternConfig;
  private auditSteps: AuditStep[] = [];

  constructor(
    repository: MemoryRepository,
    config?: Partial<VendorPatternConfig>
  ) {
    this.repository = repository;
    this.config = {
      minPatternConfidence: 0.6,
      minExamplesForPattern: 2,
      maxExampleAgeDays: 90,
      enableVATDetection: true,
      enableCurrencyLearning: true,
      enableDateFormatLearning: true,
      vendorSpecificBoost: 0.2,
      ...config
    };
  }

  /**
   * Analyze vendor patterns and learn from invoice data
   */
  async recognizePatterns(context: VendorLearningContext): Promise<VendorPatternResult> {
    const startTime = Date.now();
    const vendorId = context.invoice.vendorId;
    
    // Step 1: Detect field mappings
    const detectedMappings = await this.detectFieldMappings(context);
    
    // Step 2: Detect VAT behavior if enabled
    let vatBehavior: VATBehavior = {
      vatIncludedInPrices: false,
      vatInclusionIndicators: [],
      vatExclusionIndicators: []
    };
    
    if (this.config.enableVATDetection) {
      vatBehavior = await this.detectVATBehavior(vendorId, [
        context.invoice,
        ...context.historicalInvoices
      ]);
    }
    
    // Step 3: Detect currency patterns if enabled
    let currencyPatterns: CurrencyPattern[] = [];
    if (this.config.enableCurrencyLearning) {
      currencyPatterns = await this.detectCurrencyPatterns(context);
    }
    
    // Step 4: Detect date formats if enabled
    let dateFormats: DateFormat[] = [];
    if (this.config.enableDateFormatLearning) {
      dateFormats = await this.detectDateFormats(context);
    }
    
    // Step 5: Calculate overall confidence
    const overallConfidence = this.calculateOverallConfidence(
      detectedMappings,
      vatBehavior,
      currencyPatterns,
      dateFormats
    );
    
    // Step 6: Generate reasoning
    const reasoning = this.generatePatternReasoning(
      detectedMappings,
      vatBehavior,
      currencyPatterns,
      dateFormats,
      context
    );
    
    // Step 7: Check if new patterns were learned
    const newPatternsLearned = await this.checkForNewPatterns(
      vendorId,
      detectedMappings,
      vatBehavior,
      currencyPatterns,
      dateFormats
    );
    
    // Record audit step
    this.recordAuditStep({
      id: `pattern-recognition-${Date.now()}`,
      timestamp: new Date(),
      operation: AuditOperation.MEMORY_LEARNING,
      description: 'Vendor pattern recognition analysis',
      input: {
        vendorId,
        invoiceId: context.invoice.id,
        historicalInvoicesCount: context.historicalInvoices.length,
        humanCorrectionsCount: context.humanCorrections.length
      },
      output: {
        detectedMappingsCount: detectedMappings.length,
        vatBehaviorDetected: this.config.enableVATDetection,
        currencyPatternsCount: currencyPatterns.length,
        dateFormatsCount: dateFormats.length,
        overallConfidence,
        newPatternsLearned
      },
      actor: 'VendorPatternRecognitionEngine',
      duration: Date.now() - startTime
    });
    
    return {
      vendorId,
      detectedMappings,
      vatBehavior,
      currencyPatterns,
      dateFormats,
      overallConfidence,
      reasoning,
      newPatternsLearned
    };
  }

  /**
   * Isolate vendor memories to prevent cross-vendor contamination
   */
  async isolateVendorMemories(vendorId: string): Promise<VendorMemory[]> {
    const startTime = Date.now();
    
    // Get all memories for this vendor
    const allMemories = await this.repository.findMemoriesByVendor(vendorId);
    
    // Filter to only vendor memories and ensure they belong to this vendor
    const vendorMemories = allMemories.filter(memory => {
      if (memory.type !== MemoryType.VENDOR) {
        return false;
      }
      
      const vendorMemory = memory as VendorMemory;
      return vendorMemory.vendorId === vendorId;
    }) as VendorMemory[];
    
    // Record audit step
    this.recordAuditStep({
      id: `vendor-isolation-${Date.now()}`,
      timestamp: new Date(),
      operation: AuditOperation.MEMORY_RECALL,
      description: 'Vendor memory isolation',
      input: {
        vendorId,
        totalMemoriesConsidered: allMemories.length
      },
      output: {
        isolatedMemoriesCount: vendorMemories.length,
        isolationStrategy: 'vendor_id_exact_match'
      },
      actor: 'VendorPatternRecognitionEngine',
      duration: Date.now() - startTime
    });
    
    return vendorMemories;
  }

  /**
   * Learn field mappings from vendor-specific examples
   */
  async learnFieldMappings(vendorId: string, examples: MappingExample[]): Promise<FieldMapping[]> {
    const startTime = Date.now();
    
    // Group examples by source-target field pairs
    const mappingGroups = new Map<string, MappingExample[]>();
    
    examples.forEach(example => {
      // Extract field mapping from example context
      const mapping = this.extractMappingFromExample(example);
      if (mapping) {
        const key = `${mapping.sourceField}->${mapping.targetField}`;
        if (!mappingGroups.has(key)) {
          mappingGroups.set(key, []);
        }
        mappingGroups.get(key)!.push(example);
      }
    });
    
    const learnedMappings: FieldMapping[] = [];
    
    // Create field mappings from grouped examples
    for (const [key, mappingExamples] of mappingGroups) {
      if (mappingExamples.length >= this.config.minExamplesForPattern) {
        const [sourceField, targetField] = key.split('->');
        
        // Calculate confidence based on consistency and example count
        const confidence = this.calculateMappingConfidence(mappingExamples);
        
        if (confidence >= this.config.minPatternConfidence) {
          // Detect transformation rule if needed
          const transformationRule = this.detectTransformationRule(mappingExamples);
          
          const fieldMapping: FieldMapping = {
            sourceField: sourceField!,
            targetField: targetField!,
            transformationRule: transformationRule || {
              type: TransformationType.DIRECT_MAPPING,
              parameters: {}
            },
            confidence: confidence + this.config.vendorSpecificBoost,
            examples: mappingExamples
          };
          
          learnedMappings.push(fieldMapping);
        }
      }
    }
    
    // Record audit step
    this.recordAuditStep({
      id: `field-mapping-learning-${Date.now()}`,
      timestamp: new Date(),
      operation: AuditOperation.MEMORY_LEARNING,
      description: 'Field mapping learning from examples',
      input: {
        vendorId,
        examplesCount: examples.length,
        uniqueMappingsConsidered: mappingGroups.size
      },
      output: {
        learnedMappingsCount: learnedMappings.length,
        averageConfidence: learnedMappings.length > 0 
          ? learnedMappings.reduce((sum, m) => sum + m.confidence, 0) / learnedMappings.length 
          : 0
      },
      actor: 'VendorPatternRecognitionEngine',
      duration: Date.now() - startTime
    });
    
    return learnedMappings;
  }

  /**
   * Detect VAT behavior patterns for a vendor
   */
  async detectVATBehavior(vendorId: string, invoices: RawInvoice[]): Promise<VATBehavior> {
    const startTime = Date.now();
    
    const vatInclusionIndicators: string[] = [];
    const vatExclusionIndicators: string[] = [];
    let vatIncludedCount = 0;
    let vatExcludedCount = 0;
    
    // Analyze each invoice for VAT indicators
    for (const invoice of invoices) {
      const vatAnalysis = this.analyzeInvoiceVAT(invoice);
      
      if (vatAnalysis.vatIncluded) {
        vatIncludedCount++;
        vatInclusionIndicators.push(...vatAnalysis.inclusionIndicators);
      } else {
        vatExcludedCount++;
        vatExclusionIndicators.push(...vatAnalysis.exclusionIndicators);
      }
    }
    
    // Determine predominant VAT behavior
    const totalInvoices = invoices.length;
    const vatIncludedInPrices = vatIncludedCount > vatExcludedCount;
    
    // Remove duplicates and sort by frequency
    const uniqueInclusionIndicators = this.getUniqueIndicators(vatInclusionIndicators);
    const uniqueExclusionIndicators = this.getUniqueIndicators(vatExclusionIndicators);
    
    // Calculate default VAT rate if possible
    const defaultVatRate = this.calculateDefaultVATRate(invoices);
    
    const vatBehavior: VATBehavior = {
      vatIncludedInPrices,
      defaultVatRate: defaultVatRate || 0,
      vatInclusionIndicators: uniqueInclusionIndicators,
      vatExclusionIndicators: uniqueExclusionIndicators
    };
    
    // Record audit step
    this.recordAuditStep({
      id: `vat-behavior-detection-${Date.now()}`,
      timestamp: new Date(),
      operation: AuditOperation.MEMORY_LEARNING,
      description: 'VAT behavior pattern detection',
      input: {
        vendorId,
        invoicesAnalyzed: totalInvoices
      },
      output: {
        vatIncludedInPrices,
        vatIncludedCount,
        vatExcludedCount,
        defaultVatRate,
        inclusionIndicatorsCount: uniqueInclusionIndicators.length,
        exclusionIndicatorsCount: uniqueExclusionIndicators.length
      },
      actor: 'VendorPatternRecognitionEngine',
      duration: Date.now() - startTime
    });
    
    return vatBehavior;
  }

  /**
   * Update vendor memory with new patterns
   */
  async updateVendorMemory(vendorId: string, patterns: VendorPatternResult): Promise<VendorMemory> {
    const startTime = Date.now();
    
    // Get existing vendor memory or create new one
    const existingMemories = await this.isolateVendorMemories(vendorId);
    let vendorMemory: VendorMemory;
    
    if (existingMemories.length > 0) {
      // Update existing memory
      vendorMemory = existingMemories[0]!;
      
      // Merge new patterns with existing ones
      this.mergeFieldMappings(vendorMemory, patterns.detectedMappings);
      this.mergeVATBehavior(vendorMemory, patterns.vatBehavior);
      this.mergeCurrencyPatterns(vendorMemory, patterns.currencyPatterns);
      this.mergeDateFormats(vendorMemory, patterns.dateFormats);
      
      // Update confidence based on new patterns
      (vendorMemory as any).updateConfidence(
        Math.min(1.0, vendorMemory.confidence + (patterns.overallConfidence * 0.15)) // Increased from 0.1 to 0.15
      );
    } else {
      // Create new vendor memory
      const memoryContext: MemoryContext = {
        vendorId,
        invoiceCharacteristics: {
          complexity: ComplexityLevel.MODERATE,
          language: 'en', // Default, should be detected
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
        patternData: {
          vendorId,
          patternType: 'vendor_specific'
        },
        threshold: this.config.minPatternConfidence
      };
      
      vendorMemory = MemoryFactory.createVendorMemory(
        `vendor-${vendorId}-${Date.now()}`,
        memoryPattern,
        patterns.overallConfidence,
        memoryContext,
        vendorId,
        patterns.vatBehavior,
        patterns.detectedMappings,
        patterns.currencyPatterns,
        patterns.dateFormats
      );
    }
    
    // Save updated memory
    await this.repository.saveMemory(vendorMemory);
    
    // Record audit step
    this.recordAuditStep({
      id: `vendor-memory-update-${Date.now()}`,
      timestamp: new Date(),
      operation: AuditOperation.MEMORY_LEARNING,
      description: 'Vendor memory update with new patterns',
      input: {
        vendorId,
        existingMemoryFound: existingMemories.length > 0,
        newPatternsCount: patterns.detectedMappings.length + patterns.currencyPatterns.length + patterns.dateFormats.length
      },
      output: {
        memoryId: vendorMemory.id,
        finalConfidence: vendorMemory.confidence,
        totalFieldMappings: vendorMemory.fieldMappings.length,
        totalCurrencyPatterns: vendorMemory.currencyPatterns.length,
        totalDateFormats: vendorMemory.dateFormats.length
      },
      actor: 'VendorPatternRecognitionEngine',
      duration: Date.now() - startTime
    });
    
    return vendorMemory;
  }

  /**
   * Get audit steps for pattern recognition operations
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

  private async detectFieldMappings(context: VendorLearningContext): Promise<FieldMapping[]> {
    const mappings: FieldMapping[] = [];
    
    // Analyze current invoice fields
    const currentFields = context.invoice.extractedFields;
    
    // Look for common German field mappings (as per requirements)
    for (const field of currentFields) {
      const mapping = this.detectGermanFieldMapping(field);
      if (mapping) {
        mappings.push(mapping);
      }
    }
    
    // Learn from human corrections
    for (const correction of context.humanCorrections) {
      const mapping = this.createMappingFromCorrection(correction);
      if (mapping) {
        mappings.push(mapping);
      }
    }
    
    return mappings;
  }

  private detectGermanFieldMapping(field: ExtractedField): FieldMapping | null {
    // Specific German field mappings as per requirements
    const germanMappings: Record<string, string> = {
      'Leistungsdatum': 'serviceDate',
      'Rechnungsdatum': 'invoiceDate',
      'Fälligkeitsdatum': 'dueDate',
      'Rechnungsnummer': 'invoiceNumber',
      'Bestellnummer': 'purchaseOrderNumber',
      'Gesamtbetrag': 'totalAmount',
      'MwSt': 'vatAmount',
      'Nettobetrag': 'netAmount'
    };
    
    const fieldName = field.name.toLowerCase();
    
    for (const [germanField, englishField] of Object.entries(germanMappings)) {
      if (fieldName.includes(germanField.toLowerCase())) {
        const transformationRule = this.createTransformationRule(germanField, englishField);
        return {
          sourceField: field.name,
          targetField: englishField,
          confidence: field.confidence + this.config.vendorSpecificBoost,
          examples: [{
            sourceValue: String(field.value),
            targetValue: String(field.value),
            context: 'German field mapping detection'
          }],
          ...(transformationRule && { transformationRule })
        };
      }
    }
    
    return null;
  }

  private createMappingFromCorrection(correction: VendorCorrection): FieldMapping | null {
    return {
      sourceField: correction.fieldName,
      targetField: correction.fieldName, // Assuming same field, different value
      confidence: correction.confidence + this.config.vendorSpecificBoost,
      examples: [{
        sourceValue: String(correction.originalValue),
        targetValue: String(correction.correctedValue),
        context: `Human correction from invoice ${correction.invoiceId}`
      }],
      transformationRule: {
        type: TransformationType.DIRECT_MAPPING,
        parameters: {
          originalValue: correction.originalValue,
          correctedValue: correction.correctedValue
        }
      }
    };
  }

  private createTransformationRule(sourceField: string, targetField: string): TransformationRule | undefined {
    // Create appropriate transformation rules based on field types
    if (sourceField.toLowerCase().includes('datum') || targetField.toLowerCase().includes('date')) {
      return {
        type: TransformationType.DATE_PARSING,
        parameters: {
          inputFormat: 'DD.MM.YYYY', // Common German date format
          outputFormat: 'ISO'
        },
        validationPattern: /^\d{2}\.\d{2}\.\d{4}$/
      };
    }
    
    if (sourceField.toLowerCase().includes('betrag') || targetField.toLowerCase().includes('amount')) {
      return {
        type: TransformationType.CURRENCY_EXTRACTION,
        parameters: {
          currencySymbols: ['€', 'EUR'],
          decimalSeparator: ',',
          thousandsSeparator: '.'
        },
        validationPattern: /^\d{1,3}(?:\.\d{3})*,\d{2}\s*€?$/
      };
    }
    
    return {
      type: TransformationType.DIRECT_MAPPING,
      parameters: {}
    };
  }

  private async detectCurrencyPatterns(context: VendorLearningContext): Promise<CurrencyPattern[]> {
    const patterns: CurrencyPattern[] = [];
    const invoices = [context.invoice, ...context.historicalInvoices];
    
    // Common currency patterns
    const currencyRegexes = [
      { pattern: /(\d+[.,]\d{2})\s*€/g, currency: 'EUR', context: 'Euro with symbol' },
      { pattern: /€\s*(\d+[.,]\d{2})/g, currency: 'EUR', context: 'Euro symbol prefix' },
      { pattern: /(\d+[.,]\d{2})\s*EUR/g, currency: 'EUR', context: 'Euro with code' },
      { pattern: /EUR\s*(\d+[.,]\d{2})/g, currency: 'EUR', context: 'Euro code prefix' }
    ];
    
    for (const regex of currencyRegexes) {
      let matchCount = 0;
      
      for (const invoice of invoices) {
        const matches = invoice.rawText.match(regex.pattern);
        if (matches && matches.length > 0) {
          matchCount += matches.length;
        }
      }
      
      if (matchCount >= this.config.minExamplesForPattern) {
        const confidence = Math.min(0.9, matchCount / (invoices.length * 2));
        
        patterns.push({
          pattern: regex.pattern,
          currencyCode: regex.currency,
          confidence: confidence + this.config.vendorSpecificBoost,
          context: regex.context
        });
      }
    }
    
    return patterns;
  }

  private async detectDateFormats(context: VendorLearningContext): Promise<DateFormat[]> {
    const formats: DateFormat[] = [];
    const invoices = [context.invoice, ...context.historicalInvoices];
    
    // Common German date formats
    const dateFormats = [
      { format: 'DD.MM.YYYY', pattern: /\d{2}\.\d{2}\.\d{4}/g, examples: [] as string[] },
      { format: 'DD.MM.YY', pattern: /\d{2}\.\d{2}\.\d{2}/g, examples: [] as string[] },
      { format: 'DD/MM/YYYY', pattern: /\d{2}\/\d{2}\/\d{4}/g, examples: [] as string[] },
      { format: 'YYYY-MM-DD', pattern: /\d{4}-\d{2}-\d{2}/g, examples: [] as string[] }
    ];
    
    for (const dateFormat of dateFormats) {
      let matchCount = 0;
      const examples: string[] = [];
      
      for (const invoice of invoices) {
        const matches = invoice.rawText.match(dateFormat.pattern);
        if (matches) {
          matchCount += matches.length;
          examples.push(...matches.slice(0, 3)); // Keep first 3 examples
        }
      }
      
      if (matchCount >= this.config.minExamplesForPattern) {
        const confidence = Math.min(0.9, matchCount / (invoices.length * 2));
        
        formats.push({
          format: dateFormat.format,
          pattern: dateFormat.pattern,
          confidence: confidence + this.config.vendorSpecificBoost,
          examples: [...new Set(examples)].slice(0, 5) // Unique examples, max 5
        });
      }
    }
    
    return formats;
  }

  private analyzeInvoiceVAT(invoice: RawInvoice): { vatIncluded: boolean; inclusionIndicators: string[]; exclusionIndicators: string[] } {
    const text = invoice.rawText.toLowerCase();
    
    // German VAT inclusion indicators
    const inclusionIndicators = [
      'mwst. inkl.',
      'inkl. mwst',
      'inkl. 19% mwst',
      'inkl. mwst.',
      'prices incl. vat',
      'preise inkl. mwst',
      'brutto'
    ];
    
    // German VAT exclusion indicators
    const exclusionIndicators = [
      'mwst. excl.',
      'excl. mwst',
      'prices excl. vat',
      'preise excl. mwst',
      'netto',
      'zzgl. mwst'
    ];
    
    const foundInclusion = inclusionIndicators.filter(indicator => text.includes(indicator));
    const foundExclusion = exclusionIndicators.filter(indicator => text.includes(indicator));
    
    // Determine VAT inclusion based on indicators found
    const vatIncluded = foundInclusion.length > foundExclusion.length;
    
    return {
      vatIncluded,
      inclusionIndicators: foundInclusion,
      exclusionIndicators: foundExclusion
    };
  }

  private getUniqueIndicators(indicators: string[]): string[] {
    const counts = new Map<string, number>();
    
    indicators.forEach(indicator => {
      counts.set(indicator, (counts.get(indicator) || 0) + 1);
    });
    
    // Sort by frequency and return unique indicators
    return Array.from(counts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([indicator]) => indicator);
  }

  private calculateDefaultVATRate(invoices: RawInvoice[]): number | undefined {
    const vatRates: number[] = [];
    
    for (const invoice of invoices) {
      // Look for VAT rate patterns in the text
      const vatMatches = invoice.rawText.match(/(\d+(?:[.,]\d+)?)\s*%\s*mwst/gi);
      if (vatMatches) {
        vatMatches.forEach(match => {
          const rate = parseFloat(match.replace(/[^\d.,]/g, '').replace(',', '.'));
          if (!isNaN(rate) && rate > 0 && rate < 100) {
            vatRates.push(rate);
          }
        });
      }
    }
    
    if (vatRates.length === 0) {
      return undefined;
    }
    
    // Return the most common VAT rate
    const rateCounts = new Map<number, number>();
    vatRates.forEach(rate => {
      rateCounts.set(rate, (rateCounts.get(rate) || 0) + 1);
    });
    
    let mostCommonRate = vatRates[0]!;
    let maxCount = 0;
    
    rateCounts.forEach((count, rate) => {
      if (count > maxCount) {
        maxCount = count;
        mostCommonRate = rate;
      }
    });
    
    return mostCommonRate;
  }

  private calculateOverallConfidence(
    mappings: FieldMapping[],
    vatBehavior: VATBehavior,
    currencyPatterns: CurrencyPattern[],
    dateFormats: DateFormat[]
  ): number {
    let totalConfidence = 0;
    let componentCount = 0;
    
    // Field mappings confidence
    if (mappings.length > 0) {
      const avgMappingConfidence = mappings.reduce((sum, m) => sum + m.confidence, 0) / mappings.length;
      totalConfidence += avgMappingConfidence;
      componentCount++;
    }
    
    // VAT behavior confidence (based on indicator count)
    const vatConfidence = Math.min(0.9, 
      (vatBehavior.vatInclusionIndicators.length + vatBehavior.vatExclusionIndicators.length) * 0.2
    );
    totalConfidence += vatConfidence;
    componentCount++;
    
    // Currency patterns confidence
    if (currencyPatterns.length > 0) {
      const avgCurrencyConfidence = currencyPatterns.reduce((sum, p) => sum + p.confidence, 0) / currencyPatterns.length;
      totalConfidence += avgCurrencyConfidence;
      componentCount++;
    }
    
    // Date formats confidence
    if (dateFormats.length > 0) {
      const avgDateConfidence = dateFormats.reduce((sum, f) => sum + f.confidence, 0) / dateFormats.length;
      totalConfidence += avgDateConfidence;
      componentCount++;
    }
    
    return componentCount > 0 ? totalConfidence / componentCount : 0;
  }

  private generatePatternReasoning(
    mappings: FieldMapping[],
    vatBehavior: VATBehavior,
    currencyPatterns: CurrencyPattern[],
    dateFormats: DateFormat[],
    context: VendorLearningContext
  ): string {
    const parts: string[] = [];
    
    parts.push(`Analyzed vendor ${context.invoice.vendorId} with ${context.historicalInvoices.length} historical invoices`);
    
    if (mappings.length > 0) {
      parts.push(`Detected ${mappings.length} field mappings`);
      const germanMappings = mappings.filter(m => m.sourceField.match(/leistungsdatum|rechnungsdatum/i));
      if (germanMappings.length > 0) {
        parts.push(`Found ${germanMappings.length} German-specific field mappings`);
      }
    }
    
    if (vatBehavior.vatInclusionIndicators.length > 0 || vatBehavior.vatExclusionIndicators.length > 0) {
      const vatType = vatBehavior.vatIncludedInPrices ? 'inclusive' : 'exclusive';
      parts.push(`VAT behavior: ${vatType} pricing detected`);
      if (vatBehavior.defaultVatRate) {
        parts.push(`Default VAT rate: ${vatBehavior.defaultVatRate}%`);
      }
    }
    
    if (currencyPatterns.length > 0) {
      parts.push(`Detected ${currencyPatterns.length} currency patterns`);
    }
    
    if (dateFormats.length > 0) {
      parts.push(`Detected ${dateFormats.length} date formats`);
    }
    
    if (context.humanCorrections.length > 0) {
      parts.push(`Incorporated ${context.humanCorrections.length} human corrections`);
    }
    
    return parts.join('. ') + '.';
  }

  private async checkForNewPatterns(
    vendorId: string,
    mappings: FieldMapping[],
    vatBehavior: VATBehavior,
    currencyPatterns: CurrencyPattern[],
    dateFormats: DateFormat[]
  ): Promise<boolean> {
    const existingMemories = await this.isolateVendorMemories(vendorId);
    
    if (existingMemories.length === 0) {
      // No existing memory, so all patterns are new
      return mappings.length > 0 || currencyPatterns.length > 0 || dateFormats.length > 0;
    }
    
    const existingMemory = existingMemories[0]!;
    
    // Check for new field mappings
    const newMappings = mappings.filter(mapping => 
      !existingMemory.fieldMappings.some(existing => 
        existing.sourceField === mapping.sourceField && existing.targetField === mapping.targetField
      )
    );
    
    // Check for VAT behavior changes
    const vatBehaviorChanged = 
      existingMemory.vatBehavior.vatIncludedInPrices !== vatBehavior.vatIncludedInPrices ||
      existingMemory.vatBehavior.defaultVatRate !== vatBehavior.defaultVatRate;
    
    // Check for new currency patterns
    const newCurrencyPatterns = currencyPatterns.filter(pattern =>
      !existingMemory.currencyPatterns.some(existing =>
        existing.pattern.source === pattern.pattern.source && existing.currencyCode === pattern.currencyCode
      )
    );
    
    // Check for new date formats
    const newDateFormats = dateFormats.filter(format =>
      !existingMemory.dateFormats.some(existing =>
        existing.format === format.format
      )
    );
    
    return newMappings.length > 0 || vatBehaviorChanged || newCurrencyPatterns.length > 0 || newDateFormats.length > 0;
  }

  private extractMappingFromExample(example: MappingExample): { sourceField: string; targetField: string } | null {
    // Extract field mapping information from example context
    const contextMatch = example.context.match(/([A-Za-z0-9_]+)\s*->\s*([A-Za-z0-9_]+)/);
    if (contextMatch) {
      return {
        sourceField: contextMatch[1]!,
        targetField: contextMatch[2]!
      };
    }
    return null;
  }

  private calculateMappingConfidence(examples: MappingExample[]): number {
    // Base confidence on number of examples and consistency
    const baseConfidence = Math.min(0.9, examples.length * 0.3); // Increased from 0.2 to 0.3
    
    // Check consistency of transformations
    const uniqueTransformations = new Set(
      examples.map(ex => `${ex.sourceValue}->${ex.targetValue}`)
    );
    
    const consistencyFactor = examples.length / uniqueTransformations.size;
    
    return Math.min(0.95, baseConfidence * consistencyFactor);
  }

  private detectTransformationRule(examples: MappingExample[]): TransformationRule | undefined {
    // Analyze examples to detect common transformation patterns
    const firstExample = examples[0];
    if (!firstExample) return undefined;
    
    // Check if it's a date transformation
    if (this.isDateValue(firstExample.sourceValue) && this.isDateValue(firstExample.targetValue)) {
      return {
        type: TransformationType.DATE_PARSING,
        parameters: {
          inputFormat: this.detectDateFormat(firstExample.sourceValue),
          outputFormat: this.detectDateFormat(firstExample.targetValue)
        }
      };
    }
    
    // Check if it's a currency transformation
    if (this.isCurrencyValue(firstExample.sourceValue) || this.isCurrencyValue(firstExample.targetValue)) {
      return {
        type: TransformationType.CURRENCY_EXTRACTION,
        parameters: {
          currencySymbols: ['€', 'EUR', '$', 'USD'],
          decimalSeparator: ',',
          thousandsSeparator: '.'
        }
      };
    }
    
    // Default to direct mapping
    return {
      type: TransformationType.DIRECT_MAPPING,
      parameters: {}
    };
  }

  private isDateValue(value: string): boolean {
    return /\d{1,2}[./-]\d{1,2}[./-]\d{2,4}/.test(value) || /\d{4}-\d{2}-\d{2}/.test(value);
  }

  private isCurrencyValue(value: string): boolean {
    return /[\d.,]+\s*[€$£¥]/.test(value) || /[€$£¥]\s*[\d.,]+/.test(value);
  }

  private detectDateFormat(value: string): string {
    if (/\d{2}\.\d{2}\.\d{4}/.test(value)) return 'DD.MM.YYYY';
    if (/\d{2}\.\d{2}\.\d{2}/.test(value)) return 'DD.MM.YY';
    if (/\d{2}\/\d{2}\/\d{4}/.test(value)) return 'DD/MM/YYYY';
    if (/\d{4}-\d{2}-\d{2}/.test(value)) return 'YYYY-MM-DD';
    return 'unknown';
  }

  private mergeFieldMappings(memory: VendorMemory, newMappings: FieldMapping[]): void {
    newMappings.forEach(newMapping => {
      // Check if mapping already exists
      const existingIndex = memory.fieldMappings.findIndex(existing => 
        existing.sourceField === newMapping.sourceField && existing.targetField === newMapping.targetField
      );
      
      if (existingIndex >= 0) {
        // Update existing mapping with higher confidence
        if (newMapping.confidence > memory.fieldMappings[existingIndex]!.confidence) {
          memory.fieldMappings[existingIndex] = newMapping;
        }
      } else {
        // Add new mapping
        memory.fieldMappings.push(newMapping);
      }
    });
  }

  private mergeVATBehavior(memory: VendorMemory, newVATBehavior: VATBehavior): void {
    // Update VAT behavior with new information
    memory.vatBehavior = {
      vatIncludedInPrices: newVATBehavior.vatIncludedInPrices,
      defaultVatRate: newVATBehavior.defaultVatRate || memory.vatBehavior.defaultVatRate || 0,
      vatInclusionIndicators: [
        ...new Set([...memory.vatBehavior.vatInclusionIndicators, ...newVATBehavior.vatInclusionIndicators])
      ],
      vatExclusionIndicators: [
        ...new Set([...memory.vatBehavior.vatExclusionIndicators, ...newVATBehavior.vatExclusionIndicators])
      ]
    };
  }

  private mergeCurrencyPatterns(memory: VendorMemory, newPatterns: CurrencyPattern[]): void {
    newPatterns.forEach(newPattern => {
      // Check if pattern already exists
      const existingIndex = memory.currencyPatterns.findIndex(existing => 
        existing.pattern.source === newPattern.pattern.source && existing.currencyCode === newPattern.currencyCode
      );
      
      if (existingIndex >= 0) {
        // Update existing pattern with higher confidence
        if (newPattern.confidence > memory.currencyPatterns[existingIndex]!.confidence) {
          memory.currencyPatterns[existingIndex] = newPattern;
        }
      } else {
        // Add new pattern
        memory.currencyPatterns.push(newPattern);
      }
    });
  }

  private mergeDateFormats(memory: VendorMemory, newFormats: DateFormat[]): void {
    newFormats.forEach(newFormat => {
      // Check if format already exists
      const existingIndex = memory.dateFormats.findIndex(existing => 
        existing.format === newFormat.format
      );
      
      if (existingIndex >= 0) {
        // Update existing format with higher confidence
        if (newFormat.confidence > memory.dateFormats[existingIndex]!.confidence) {
          memory.dateFormats[existingIndex] = newFormat;
        }
      } else {
        // Add new format
        memory.dateFormats.push(newFormat);
      }
    });
  }

  private recordAuditStep(step: AuditStep): void {
    this.auditSteps.push(step);
  }
}

/**
 * Create a vendor pattern recognition engine instance
 */
export function createVendorPatternRecognitionEngine(
  repository: MemoryRepository,
  config?: Partial<VendorPatternConfig>
): VendorPatternRecognitionEngine {
  return new VendorPatternRecognitionEngineImpl(repository, config);
}