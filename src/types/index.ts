/**
 * Core type definitions for the AI Agent Memory System
 * 
 * This module defines the fundamental data structures and interfaces
 * used throughout the memory system for invoice processing and learning.
 */

// ============================================================================
// Core System Interfaces
// ============================================================================

/**
 * Main interface for the AI Agent Memory System
 * Orchestrates the complete invoice processing pipeline with memory-based learning
 */
export interface MemorySystem {
  /**
   * Process an invoice using stored memories and learning capabilities
   * @param invoice Raw invoice data to process
   * @returns Complete processing result with normalization, corrections, and audit trail
   */
  processInvoice(invoice: RawInvoice): Promise<ProcessingResult>;

  /**
   * Recall relevant memories for a given invoice context
   * @param context Invoice processing context for memory matching
   * @returns Array of relevant memories ranked by confidence and relevance
   */
  recallMemories(context: InvoiceContext): Promise<Memory[]>;

  /**
   * Apply recalled memories to normalize and correct an invoice
   * @param invoice Raw invoice to transform
   * @param memories Relevant memories to apply
   * @returns Normalized invoice with memory-based transformations
   */
  applyMemories(invoice: RawInvoice, memories: Memory[]): Promise<NormalizedInvoice>;

  /**
   * Make processing decision based on confidence and business rules
   * @param invoice Normalized invoice data
   * @param confidence Overall confidence score for the processing
   * @returns Decision on whether to auto-process or escalate for human review
   */
  makeDecision(invoice: NormalizedInvoice, confidence: number): Promise<Decision>;

  /**
   * Learn from processing outcomes to improve future performance
   * @param outcome Result of invoice processing including human feedback
   */
  learnFromOutcome(outcome: ProcessingOutcome): Promise<void>;

  /**
   * Close the memory system and clean up resources
   */
  close(): Promise<void>;
}

/**
 * Complete result of invoice processing through the memory system
 * Includes all transformations, decisions, and audit information
 */
export interface ProcessingResult {
  /** Invoice with all memory-based normalizations applied */
  normalizedInvoice: NormalizedInvoice;
  
  /** Array of specific corrections suggested by the memory system */
  proposedCorrections: Correction[];
  
  /** Whether the invoice requires human review based on confidence thresholds */
  requiresHumanReview: boolean;
  
  /** Detailed explanation of all memory applications and decisions made */
  reasoning: string;
  
  /** Overall confidence score for the processing result (0.0-1.0) */
  confidenceScore: number;
  
  /** Array of memory updates performed during processing */
  memoryUpdates: MemoryUpdate[];
  
  /** Complete audit trail of all processing steps with timestamps */
  auditTrail: AuditStep[];
}

// ============================================================================
// Memory System Core Types
// ============================================================================

/**
 * Base interface for all memory types in the system
 * Represents learned knowledge that can be applied to future invoice processing
 */
export interface Memory {
  /** Unique identifier for the memory */
  id: string;
  
  /** Type classification of the memory */
  type: MemoryType;
  
  /** Pattern or rule that this memory represents */
  pattern: MemoryPattern;
  
  /** Confidence score indicating reliability (0.0-1.0) */
  confidence: number;
  
  /** Timestamp when the memory was first created */
  createdAt: Date;
  
  /** Timestamp when the memory was last successfully used */
  lastUsed: Date;
  
  /** Number of times this memory has been applied */
  usageCount: number;
  
  /** Success rate of this memory when applied (0.0-1.0) */
  successRate: number;
  
  /** Context information for when this memory should be applied */
  context: MemoryContext;
}

/**
 * Classification of different memory types in the system
 */
export enum MemoryType {
  /** Vendor-specific patterns and behaviors */
  VENDOR = 'vendor',
  
  /** Learned corrections from human feedback */
  CORRECTION = 'correction',
  
  /** Resolution patterns from past decisions */
  RESOLUTION = 'resolution'
}

/**
 * Vendor-specific memory storing patterns unique to individual suppliers
 */
export interface VendorMemory extends Memory {
  /** Unique identifier for the vendor */
  vendorId: string;
  
  /** Learned mappings between vendor fields and standard fields */
  fieldMappings: FieldMapping[];
  
  /** VAT handling behavior specific to this vendor */
  vatBehavior: VATBehavior;
  
  /** Currency extraction patterns for this vendor */
  currencyPatterns: CurrencyPattern[];
  
  /** Date format patterns used by this vendor */
  dateFormats: DateFormat[];
}

/**
 * Memory of corrections learned from human feedback
 */
export interface CorrectionMemory extends Memory {
  /** Type of correction this memory represents */
  correctionType: CorrectionType;
  
  /** Conditions that trigger this correction */
  triggerConditions: Condition[];
  
  /** Action to take when conditions are met */
  correctionAction: CorrectionAction;
  
  /** Rules to validate the correction is appropriate */
  validationRules: ValidationRule[];
}

/**
 * Memory of how discrepancies were resolved by humans
 */
export interface ResolutionMemory extends Memory {
  /** Type of discrepancy that was resolved */
  discrepancyType: DiscrepancyType;
  
  /** How the discrepancy was ultimately resolved */
  resolutionOutcome: ResolutionOutcome;
  
  /** Human decision made during resolution */
  humanDecision: HumanDecision;
  
  /** Contextual factors that influenced the resolution */
  contextFactors: ContextFactor[];
}

// ============================================================================
// Invoice Data Models
// ============================================================================

/**
 * Raw invoice data as received from external systems
 * Contains unprocessed information that needs normalization
 */
export interface RawInvoice {
  /** Unique identifier for the invoice */
  id: string;
  
  /** Identifier for the vendor/supplier */
  vendorId: string;
  
  /** Invoice number as provided by the vendor */
  invoiceNumber: string;
  
  /** Raw text content of the invoice (OCR output, etc.) */
  rawText: string;
  
  /** Fields extracted from the raw invoice */
  extractedFields: ExtractedField[];
  
  /** Additional metadata about the invoice */
  metadata: InvoiceMetadata;
}

/**
 * Normalized invoice after memory system processing
 * Contains standardized fields and memory-based corrections
 */
export interface NormalizedInvoice {
  /** Unique identifier for the invoice */
  id: string;
  
  /** Identifier for the vendor/supplier */
  vendorId: string;
  
  /** Invoice number as provided by the vendor */
  invoiceNumber: string;
  
  /** Service date (when services were provided) */
  serviceDate?: Date;
  
  /** Date the invoice was issued */
  invoiceDate: Date;
  
  /** Date payment is due */
  dueDate?: Date;
  
  /** Total amount of the invoice */
  totalAmount: Money;
  
  /** VAT/tax amount if applicable */
  vatAmount?: Money;
  
  /** Currency code (ISO 4217) */
  currency: string;
  
  /** Individual line items on the invoice */
  lineItems: LineItem[];
  
  /** Payment terms and conditions */
  paymentTerms?: PaymentTerms;
  
  /** Purchase order number if referenced */
  purchaseOrderNumber?: string;
  
  /** Fields that were normalized by the memory system */
  normalizedFields: NormalizedField[];
}

/**
 * Individual line item on an invoice
 */
export interface LineItem {
  /** Description of the item or service */
  description: string;
  
  /** Quantity of the item */
  quantity: number;
  
  /** Price per unit */
  unitPrice: Money;
  
  /** Total price for this line item */
  totalPrice: Money;
  
  /** Stock keeping unit identifier */
  sku?: string;
  
  /** VAT rate applied to this item */
  vatRate?: number;
}

/**
 * Monetary amount with currency information
 */
export interface Money {
  /** Numeric amount */
  amount: number;
  
  /** Currency code (ISO 4217) */
  currency: string;
}

// ============================================================================
// Memory Pattern and Context Types
// ============================================================================

/**
 * Pattern that defines when and how a memory should be applied
 */
export interface MemoryPattern {
  /** Type of pattern matching to use */
  patternType: PatternType;
  
  /** Specific pattern data (regex, keywords, etc.) */
  patternData: Record<string, unknown>;
  
  /** Confidence threshold for applying this pattern */
  threshold: number;
}

/**
 * Context information for memory matching and application
 */
export interface MemoryContext {
  /** Vendor identifier for vendor-specific memories */
  vendorId?: string;
  
  /** Invoice characteristics for pattern matching */
  invoiceCharacteristics: InvoiceCharacteristics;
  
  /** Historical context from previous processing */
  historicalContext: HistoricalContext;
  
  /** Environmental factors affecting processing */
  environmentalFactors: EnvironmentalFactor[];
}

/**
 * Characteristics of an invoice used for memory matching
 */
export interface InvoiceCharacteristics {
  /** Estimated invoice complexity */
  complexity: ComplexityLevel;
  
  /** Language detected in the invoice */
  language: string;
  
  /** Document format (PDF, image, etc.) */
  documentFormat: string;
  
  /** Quality of text extraction */
  extractionQuality: QualityLevel;
}

// ============================================================================
// Supporting Enums and Types
// ============================================================================

export enum PatternType {
  REGEX = 'regex',
  KEYWORD = 'keyword',
  FIELD_MAPPING = 'field_mapping',
  STRUCTURAL = 'structural',
  CONTEXTUAL = 'contextual'
}

export enum ComplexityLevel {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  VERY_COMPLEX = 'very_complex'
}

export enum QualityLevel {
  POOR = 'poor',
  FAIR = 'fair',
  GOOD = 'good',
  EXCELLENT = 'excellent'
}

// ============================================================================
// Field Mapping and Transformation Types
// ============================================================================

/**
 * Mapping between vendor-specific field names and standardized field names
 */
export interface FieldMapping {
  /** Original field name from the vendor */
  sourceField: string;
  
  /** Standardized target field name */
  targetField: string;
  
  /** Optional transformation rule to apply during mapping */
  transformationRule?: TransformationRule;
  
  /** Confidence in this mapping (0.0-1.0) */
  confidence: number;
  
  /** Example mappings that support this rule */
  examples: MappingExample[];
}

/**
 * Rule for transforming data during field mapping
 */
export interface TransformationRule {
  /** Type of transformation to apply */
  type: TransformationType;
  
  /** Parameters specific to the transformation type */
  parameters: Record<string, unknown>;
  
  /** Optional regex pattern for validation */
  validationPattern?: RegExp;
}

/**
 * Types of transformations that can be applied to field data
 */
export enum TransformationType {
  /** Direct mapping without transformation */
  DIRECT_MAPPING = 'direct',
  
  /** Parse date from various formats */
  DATE_PARSING = 'date_parse',
  
  /** Extract currency information */
  CURRENCY_EXTRACTION = 'currency_extract',
  
  /** Normalize text (trim, case, etc.) */
  TEXT_NORMALIZATION = 'text_normalize',
  
  /** Extract using regular expressions */
  REGEX_EXTRACTION = 'regex_extract'
}

/**
 * Example of a successful field mapping
 */
export interface MappingExample {
  /** Original value from vendor */
  sourceValue: string;
  
  /** Transformed target value */
  targetValue: string;
  
  /** Context where this mapping was successful */
  context: string;
}

// ============================================================================
// Vendor-Specific Pattern Types
// ============================================================================

/**
 * VAT handling behavior patterns for a specific vendor
 */
export interface VATBehavior {
  /** Whether VAT is typically included in prices */
  vatIncludedInPrices: boolean;
  
  /** Default VAT rate used by this vendor */
  defaultVatRate?: number;
  
  /** Patterns for detecting VAT inclusion indicators */
  vatInclusionIndicators: string[];
  
  /** Patterns for detecting VAT exclusion indicators */
  vatExclusionIndicators: string[];
}

/**
 * Currency extraction patterns for vendor invoices
 */
export interface CurrencyPattern {
  /** Regular expression for finding currency */
  pattern: RegExp;
  
  /** Currency code this pattern extracts */
  currencyCode: string;
  
  /** Confidence in this pattern (0.0-1.0) */
  confidence: number;
  
  /** Context where this pattern applies */
  context: string;
}

/**
 * Date format patterns used by vendors
 */
export interface DateFormat {
  /** Format string (e.g., "DD.MM.YYYY") */
  format: string;
  
  /** Regular expression for matching this format */
  pattern: RegExp;
  
  /** Confidence in this format (0.0-1.0) */
  confidence: number;
  
  /** Examples of dates in this format */
  examples: string[];
}

// ============================================================================
// Correction and Resolution Types
// ============================================================================

/**
 * Types of corrections the system can learn
 */
export enum CorrectionType {
  /** Quantity adjustments */
  QUANTITY_CORRECTION = 'quantity_correction',
  
  /** Price adjustments */
  PRICE_CORRECTION = 'price_correction',
  
  /** Date corrections */
  DATE_CORRECTION = 'date_correction',
  
  /** Currency corrections */
  CURRENCY_CORRECTION = 'currency_correction',
  
  /** VAT corrections */
  VAT_CORRECTION = 'vat_correction',
  
  /** Field mapping corrections */
  FIELD_MAPPING_CORRECTION = 'field_mapping_correction'
}

/**
 * Condition that triggers a correction
 */
export interface Condition {
  /** Field or context to check */
  field: string;
  
  /** Operator for comparison */
  operator: ConditionOperator;
  
  /** Value to compare against */
  value: unknown;
  
  /** Optional additional context */
  context?: string;
}

/**
 * Operators for condition evaluation
 */
export enum ConditionOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than',
  CONTAINS = 'contains',
  MATCHES_REGEX = 'matches_regex',
  EXISTS = 'exists',
  NOT_EXISTS = 'not_exists'
}

/**
 * Action to take when correction conditions are met
 */
export interface CorrectionAction {
  /** Type of action to perform */
  actionType: CorrectionActionType;
  
  /** Target field to modify */
  targetField: string;
  
  /** New value or transformation to apply */
  newValue: unknown;
  
  /** Optional explanation for the correction */
  explanation?: string;
}

/**
 * Types of correction actions
 */
export enum CorrectionActionType {
  SET_VALUE = 'set_value',
  MULTIPLY_BY = 'multiply_by',
  ADD_VALUE = 'add_value',
  REPLACE_TEXT = 'replace_text',
  APPLY_TRANSFORMATION = 'apply_transformation'
}

/**
 * Rule for validating that a correction is appropriate
 */
export interface ValidationRule {
  /** Type of validation to perform */
  validationType: ValidationType;
  
  /** Parameters for the validation */
  parameters: Record<string, unknown>;
  
  /** Error message if validation fails */
  errorMessage: string;
}

/**
 * Types of validation that can be performed
 */
export enum ValidationType {
  RANGE_CHECK = 'range_check',
  FORMAT_CHECK = 'format_check',
  BUSINESS_RULE_CHECK = 'business_rule_check',
  CONSISTENCY_CHECK = 'consistency_check'
}

/**
 * Types of discrepancies that can be resolved
 */
export enum DiscrepancyType {
  QUANTITY_MISMATCH = 'quantity_mismatch',
  PRICE_DISCREPANCY = 'price_discrepancy',
  DATE_INCONSISTENCY = 'date_inconsistency',
  CURRENCY_MISMATCH = 'currency_mismatch',
  VAT_CALCULATION_ERROR = 'vat_calculation_error',
  MISSING_FIELD = 'missing_field',
  DUPLICATE_INVOICE = 'duplicate_invoice'
}

/**
 * Outcome of resolving a discrepancy
 */
export interface ResolutionOutcome {
  /** Whether the discrepancy was resolved */
  resolved: boolean;
  
  /** Action taken to resolve the discrepancy */
  resolutionAction: ResolutionAction;
  
  /** Final value after resolution */
  finalValue: unknown;
  
  /** Explanation of the resolution */
  explanation: string;
}

/**
 * Actions that can be taken to resolve discrepancies
 */
export enum ResolutionAction {
  APPROVE_AS_IS = 'approve_as_is',
  APPLY_CORRECTION = 'apply_correction',
  ESCALATE_TO_HUMAN = 'escalate_to_human',
  REJECT_INVOICE = 'reject_invoice',
  REQUEST_CLARIFICATION = 'request_clarification'
}

/**
 * Human decision made during discrepancy resolution
 */
export interface HumanDecision {
  /** Type of decision made */
  decisionType: HumanDecisionType;
  
  /** Timestamp of the decision */
  timestamp: Date;
  
  /** User who made the decision */
  userId: string;
  
  /** Reasoning provided by the human */
  reasoning: string;
  
  /** Confidence in the decision (0.0-1.0) */
  confidence: number;
}

/**
 * Types of decisions humans can make
 */
export enum HumanDecisionType {
  APPROVE = 'approve',
  REJECT = 'reject',
  MODIFY = 'modify',
  ESCALATE = 'escalate',
  DEFER = 'defer'
}

/**
 * Contextual factor that influenced a resolution
 */
export interface ContextFactor {
  /** Type of contextual factor */
  factorType: ContextFactorType;
  
  /** Value or description of the factor */
  value: unknown;
  
  /** Weight of this factor in the decision (0.0-1.0) */
  weight: number;
}

/**
 * Types of contextual factors
 */
export enum ContextFactorType {
  VENDOR_HISTORY = 'vendor_history',
  INVOICE_AMOUNT = 'invoice_amount',
  TIME_PRESSURE = 'time_pressure',
  REGULATORY_REQUIREMENT = 'regulatory_requirement',
  BUSINESS_RELATIONSHIP = 'business_relationship',
  SEASONAL_FACTOR = 'seasonal_factor'
}

// ============================================================================
// Processing and Decision Types
// ============================================================================

/**
 * Context for invoice processing and memory matching
 */
export interface InvoiceContext {
  /** The invoice being processed */
  invoice: RawInvoice;
  
  /** Vendor information */
  vendorInfo: VendorInfo;
  
  /** Processing environment */
  environment: ProcessingEnvironment;
  
  /** Historical processing data */
  history: ProcessingHistory;
}

/**
 * Information about a vendor
 */
export interface VendorInfo {
  /** Vendor identifier */
  id: string;
  
  /** Vendor name */
  name: string;
  
  /** Country of origin */
  country: string;
  
  /** Primary language */
  language: string;
  
  /** Business relationship type */
  relationshipType: VendorRelationshipType;
}

/**
 * Types of vendor relationships
 */
export enum VendorRelationshipType {
  PREFERRED = 'preferred',
  STANDARD = 'standard',
  OCCASIONAL = 'occasional',
  NEW = 'new',
  PROBLEMATIC = 'problematic'
}

/**
 * Processing environment information
 */
export interface ProcessingEnvironment {
  /** Current timestamp */
  timestamp: Date;
  
  /** Processing priority */
  priority: ProcessingPriority;
  
  /** Available processing time */
  timeConstraints: TimeConstraints;
  
  /** Regulatory requirements */
  regulatoryContext: RegulatoryContext;
}

/**
 * Processing priority levels
 */
export enum ProcessingPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent'
}

/**
 * Time constraints for processing
 */
export interface TimeConstraints {
  /** Maximum processing time allowed */
  maxProcessingTime: number;
  
  /** Deadline for completion */
  deadline?: Date;
  
  /** Whether real-time processing is required */
  realTimeRequired: boolean;
}

/**
 * Regulatory context affecting processing
 */
export interface RegulatoryContext {
  /** Applicable regulations */
  regulations: string[];
  
  /** Compliance requirements */
  complianceRequirements: ComplianceRequirement[];
  
  /** Audit trail requirements */
  auditRequirements: AuditRequirement[];
}

/**
 * Compliance requirement
 */
export interface ComplianceRequirement {
  /** Requirement identifier */
  id: string;
  
  /** Description of the requirement */
  description: string;
  
  /** Whether this requirement is mandatory */
  mandatory: boolean;
}

/**
 * Audit requirement
 */
export interface AuditRequirement {
  /** Type of audit trail required */
  auditType: AuditType;
  
  /** Retention period for audit data */
  retentionPeriod: number;
  
  /** Level of detail required */
  detailLevel: AuditDetailLevel;
}

/**
 * Types of audit trails
 */
export enum AuditType {
  BASIC = 'basic',
  DETAILED = 'detailed',
  COMPREHENSIVE = 'comprehensive',
  REGULATORY = 'regulatory'
}

/**
 * Levels of audit detail
 */
export enum AuditDetailLevel {
  MINIMAL = 'minimal',
  STANDARD = 'standard',
  VERBOSE = 'verbose',
  COMPLETE = 'complete'
}

/**
 * Historical processing information
 */
export interface ProcessingHistory {
  /** Previous invoices from this vendor */
  vendorHistory: VendorHistoryEntry[];
  
  /** Similar invoices processed recently */
  similarInvoices: SimilarInvoiceEntry[];
  
  /** Recent processing performance */
  performanceMetrics: ProcessingPerformanceMetrics;
}

/**
 * Historical entry for vendor processing
 */
export interface VendorHistoryEntry {
  /** Invoice identifier */
  invoiceId: string;
  
  /** Processing timestamp */
  timestamp: Date;
  
  /** Processing outcome */
  outcome: ProcessingOutcomeType;
  
  /** Confidence score achieved */
  confidenceScore: number;
}

/**
 * Entry for similar invoice processing
 */
export interface SimilarInvoiceEntry {
  /** Invoice identifier */
  invoiceId: string;
  
  /** Similarity score (0.0-1.0) */
  similarityScore: number;
  
  /** Processing outcome */
  outcome: ProcessingOutcomeType;
  
  /** Memories that were applied */
  appliedMemories: string[];
}

/**
 * Processing performance metrics
 */
export interface ProcessingPerformanceMetrics {
  /** Average processing time */
  averageProcessingTime: number;
  
  /** Success rate (0.0-1.0) */
  successRate: number;
  
  /** Automation rate (0.0-1.0) */
  automationRate: number;
  
  /** Human review rate (0.0-1.0) */
  humanReviewRate: number;
}

/**
 * Types of processing outcomes
 */
export enum ProcessingOutcomeType {
  SUCCESS_AUTO = 'success_auto',
  SUCCESS_HUMAN_REVIEW = 'success_human_review',
  FAILED_VALIDATION = 'failed_validation',
  ESCALATED = 'escalated',
  REJECTED = 'rejected'
}

/**
 * Decision made by the memory system
 */
export interface Decision {
  /** Type of decision made */
  decisionType: DecisionType;
  
  /** Confidence in the decision (0.0-1.0) */
  confidence: number;
  
  /** Reasoning for the decision */
  reasoning: string;
  
  /** Recommended actions */
  recommendedActions: RecommendedAction[];
  
  /** Risk assessment */
  riskAssessment: RiskAssessment;
}

/**
 * Types of decisions the system can make
 */
export enum DecisionType {
  AUTO_APPROVE = 'auto_approve',
  HUMAN_REVIEW_REQUIRED = 'human_review_required',
  ESCALATE_TO_EXPERT = 'escalate_to_expert',
  REJECT_INVOICE = 'reject_invoice',
  REQUEST_ADDITIONAL_INFO = 'request_additional_info'
}

/**
 * Recommended action for processing
 */
export interface RecommendedAction {
  /** Type of action */
  actionType: ActionType;
  
  /** Priority of the action */
  priority: ActionPriority;
  
  /** Description of the action */
  description: string;
  
  /** Expected outcome */
  expectedOutcome: string;
}

/**
 * Types of recommended actions
 */
export enum ActionType {
  APPLY_CORRECTION = 'apply_correction',
  VALIDATE_FIELD = 'validate_field',
  CONTACT_VENDOR = 'contact_vendor',
  ESCALATE_ISSUE = 'escalate_issue',
  UPDATE_MEMORY = 'update_memory'
}

/**
 * Priority levels for actions
 */
export enum ActionPriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

/**
 * Risk assessment for a decision
 */
export interface RiskAssessment {
  /** Overall risk level */
  riskLevel: RiskLevel;
  
  /** Specific risk factors */
  riskFactors: RiskFactor[];
  
  /** Mitigation strategies */
  mitigationStrategies: string[];
}

/**
 * Risk levels
 */
export enum RiskLevel {
  VERY_LOW = 'very_low',
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  VERY_HIGH = 'very_high'
}

/**
 * Risk factor in processing
 */
export interface RiskFactor {
  /** Type of risk */
  riskType: RiskType;
  
  /** Severity of the risk (0.0-1.0) */
  severity: number;
  
  /** Description of the risk */
  description: string;
}

/**
 * Types of risks in invoice processing
 */
export enum RiskType {
  FINANCIAL = 'financial',
  COMPLIANCE = 'compliance',
  OPERATIONAL = 'operational',
  REPUTATIONAL = 'reputational',
  TECHNICAL = 'technical'
}

/**
 * Complete outcome of invoice processing
 */
export interface ProcessingOutcome {
  /** Final processing result */
  result: ProcessingResult;
  
  /** Human feedback if provided */
  humanFeedback?: HumanFeedback;
  
  /** Actual outcome type */
  outcomeType: ProcessingOutcomeType;
  
  /** Performance metrics for this processing */
  performanceMetrics: ProcessingPerformanceMetrics;
}

/**
 * Human feedback on processing results
 */
export interface HumanFeedback {
  /** User who provided feedback */
  userId: string;
  
  /** Timestamp of feedback */
  timestamp: Date;
  
  /** Type of feedback */
  feedbackType: FeedbackType;
  
  /** Specific corrections made */
  corrections: Correction[];
  
  /** Overall satisfaction rating (1-5) */
  satisfactionRating: number;
  
  /** Additional comments */
  comments?: string;
}

/**
 * Types of human feedback
 */
export enum FeedbackType {
  APPROVAL = 'approval',
  CORRECTION = 'correction',
  REJECTION = 'rejection',
  IMPROVEMENT_SUGGESTION = 'improvement_suggestion'
}

/**
 * Specific correction made to processing results
 */
export interface Correction {
  /** Field that was corrected */
  field: string;
  
  /** Original value */
  originalValue: unknown;
  
  /** Corrected value */
  correctedValue: unknown;
  
  /** Reason for the correction */
  reason: string;
  
  /** Confidence in the correction (0.0-1.0) */
  confidence: number;
  
  /** ID of the memory that generated this correction (optional) */
  memoryId?: string;
}

/**
 * Update made to a memory during processing
 */
export interface MemoryUpdate {
  /** Memory that was updated */
  memoryId: string;
  
  /** Type of update performed */
  updateType: MemoryUpdateType;
  
  /** Previous state of the memory */
  previousState: Partial<Memory>;
  
  /** New state of the memory */
  newState: Partial<Memory>;
  
  /** Reason for the update */
  reason: string;
  
  /** Timestamp of the update */
  timestamp: Date;
}

/**
 * Types of memory updates
 */
export enum MemoryUpdateType {
  CONFIDENCE_INCREASE = 'confidence_increase',
  CONFIDENCE_DECREASE = 'confidence_decrease',
  USAGE_COUNT_INCREMENT = 'usage_count_increment',
  SUCCESS_RATE_UPDATE = 'success_rate_update',
  PATTERN_REFINEMENT = 'pattern_refinement',
  CONTEXT_EXPANSION = 'context_expansion'
}

/**
 * Step in the audit trail
 */
export interface AuditStep {
  /** Unique identifier for the step */
  id: string;
  
  /** Timestamp of the step */
  timestamp: Date;
  
  /** Type of operation performed */
  operation: AuditOperation;
  
  /** Description of what was done */
  description: string;
  
  /** Input data for the step */
  input: Record<string, unknown>;
  
  /** Output data from the step */
  output: Record<string, unknown>;
  
  /** User or system that performed the step */
  actor: string;
  
  /** Duration of the step in milliseconds */
  duration: number;
}

/**
 * Types of operations that can be audited
 */
export enum AuditOperation {
  MEMORY_RECALL = 'memory_recall',
  MEMORY_APPLICATION = 'memory_application',
  DECISION_MAKING = 'decision_making',
  MEMORY_LEARNING = 'memory_learning',
  CONFIDENCE_CALCULATION = 'confidence_calculation',
  FIELD_NORMALIZATION = 'field_normalization',
  VALIDATION = 'validation',
  ERROR_HANDLING = 'error_handling'
}

// ============================================================================
// Supporting Data Types
// ============================================================================

/**
 * Field extracted from raw invoice
 */
export interface ExtractedField {
  /** Name of the field */
  name: string;
  
  /** Extracted value */
  value: unknown;
  
  /** Confidence in extraction (0.0-1.0) */
  confidence: number;
  
  /** Source location in the document */
  sourceLocation?: SourceLocation;
}

/**
 * Location information for extracted data
 */
export interface SourceLocation {
  /** Page number (for multi-page documents) */
  page: number;
  
  /** Bounding box coordinates */
  boundingBox: BoundingBox;
  
  /** Text that was extracted */
  extractedText: string;
}

/**
 * Bounding box coordinates
 */
export interface BoundingBox {
  /** X coordinate of top-left corner */
  x: number;
  
  /** Y coordinate of top-left corner */
  y: number;
  
  /** Width of the bounding box */
  width: number;
  
  /** Height of the bounding box */
  height: number;
}

/**
 * Metadata about an invoice
 */
export interface InvoiceMetadata {
  /** Source system that provided the invoice */
  sourceSystem: string;
  
  /** Timestamp when invoice was received */
  receivedAt: Date;
  
  /** File format of the original document */
  fileFormat: string;
  
  /** File size in bytes */
  fileSize: number;
  
  /** Language detected in the document */
  detectedLanguage: string;
  
  /** Quality of text extraction */
  extractionQuality: QualityLevel;
  
  /** Additional metadata */
  additionalMetadata: Record<string, unknown>;
}

/**
 * Field that was normalized by the memory system
 */
export interface NormalizedField {
  /** Original field name */
  originalField: string;
  
  /** Normalized field name */
  normalizedField: string;
  
  /** Original value */
  originalValue: unknown;
  
  /** Normalized value */
  normalizedValue: unknown;
  
  /** Memory that performed the normalization */
  memoryId: string;
  
  /** Confidence in the normalization (0.0-1.0) */
  confidence: number;
}

/**
 * Payment terms and conditions
 */
export interface PaymentTerms {
  /** Payment due date */
  dueDate: Date;
  
  /** Payment method */
  paymentMethod: PaymentMethod;
  
  /** Discount terms (e.g., Skonto) */
  discountTerms?: DiscountTerms;
  
  /** Late payment penalties */
  latePenalties?: LatePenalty[];
  
  /** Additional terms */
  additionalTerms: string[];
}

/**
 * Payment methods
 */
export enum PaymentMethod {
  BANK_TRANSFER = 'bank_transfer',
  CREDIT_CARD = 'credit_card',
  CHECK = 'check',
  CASH = 'cash',
  DIRECT_DEBIT = 'direct_debit',
  ELECTRONIC_PAYMENT = 'electronic_payment'
}

/**
 * Discount terms (e.g., Skonto in German invoices)
 */
export interface DiscountTerms {
  /** Discount percentage */
  discountPercentage: number;
  
  /** Days within which discount applies */
  discountDays: number;
  
  /** Description of discount terms */
  description: string;
}

/**
 * Late payment penalty
 */
export interface LatePenalty {
  /** Days after due date when penalty applies */
  daysAfterDue: number;
  
  /** Penalty percentage or fixed amount */
  penalty: number;
  
  /** Whether penalty is percentage or fixed amount */
  penaltyType: PenaltyType;
}

/**
 * Types of payment penalties
 */
export enum PenaltyType {
  PERCENTAGE = 'percentage',
  FIXED_AMOUNT = 'fixed_amount'
}

/**
 * Historical context for memory operations
 */
export interface HistoricalContext {
  /** Recent processing results */
  recentResults: ProcessingResult[];
  
  /** Trending patterns */
  trendingPatterns: TrendingPattern[];
  
  /** Seasonal adjustments */
  seasonalFactors: SeasonalFactor[];
}

/**
 * Trending pattern in processing
 */
export interface TrendingPattern {
  /** Pattern identifier */
  patternId: string;
  
  /** Trend direction */
  trendDirection: TrendDirection;
  
  /** Strength of the trend (0.0-1.0) */
  trendStrength: number;
  
  /** Time period of the trend */
  timePeriod: TimePeriod;
}

/**
 * Trend directions
 */
export enum TrendDirection {
  INCREASING = 'increasing',
  DECREASING = 'decreasing',
  STABLE = 'stable',
  VOLATILE = 'volatile'
}

/**
 * Time period for trends
 */
export interface TimePeriod {
  /** Start date of the period */
  startDate: Date;
  
  /** End date of the period */
  endDate: Date;
  
  /** Duration in days */
  durationDays: number;
}

/**
 * Seasonal factor affecting processing
 */
export interface SeasonalFactor {
  /** Season identifier */
  season: Season;
  
  /** Adjustment factor (multiplier) */
  adjustmentFactor: number;
  
  /** Confidence in the seasonal adjustment (0.0-1.0) */
  confidence: number;
}

/**
 * Seasons for seasonal adjustments
 */
export enum Season {
  SPRING = 'spring',
  SUMMER = 'summer',
  FALL = 'fall',
  WINTER = 'winter',
  YEAR_END = 'year_end',
  QUARTER_END = 'quarter_end'
}

/**
 * Environmental factor affecting processing
 */
export interface EnvironmentalFactor {
  /** Type of environmental factor */
  factorType: EnvironmentalFactorType;
  
  /** Current value of the factor */
  currentValue: unknown;
  
  /** Impact on processing (0.0-1.0) */
  impact: number;
  
  /** Description of the factor */
  description: string;
}

/**
 * Types of environmental factors
 */
export enum EnvironmentalFactorType {
  SYSTEM_LOAD = 'system_load',
  NETWORK_LATENCY = 'network_latency',
  DATABASE_PERFORMANCE = 'database_performance',
  EXTERNAL_SERVICE_AVAILABILITY = 'external_service_availability',
  REGULATORY_CHANGE = 'regulatory_change',
  BUSINESS_CALENDAR = 'business_calendar'
}