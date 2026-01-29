/**
 * Duplicate Invoice Detection Service
 * 
 * Implements duplicate detection algorithms using vendor, invoice number,
 * and date proximity matching to identify potential duplicate invoices.
 */

import {
  RawInvoice,
  NormalizedInvoice,
  AuditStep,
  AuditOperation
} from '../types';
import { ValidationIssue, IssueSeverity, ValidationIssueType } from './decision-engine';
import { DatabaseConnection } from '../database/connection';

/**
 * Configuration for duplicate detection
 */
export interface DuplicateDetectionConfig {
  /** Maximum days difference to consider invoices as potential duplicates */
  dateProximityDays: number;

  /** Enable fuzzy matching for invoice numbers */
  enableFuzzyMatching: boolean;

  /** Similarity threshold for fuzzy matching (0.0-1.0) */
  fuzzyMatchThreshold: number;

  /** Enable amount comparison for duplicate detection */
  enableAmountComparison: boolean;

  /** Maximum percentage difference in amounts to consider duplicates */
  amountTolerancePercent: number;
}

/**
 * Result of duplicate detection
 */
export interface DuplicateDetectionResult {
  /** Whether potential duplicates were found */
  duplicatesFound: boolean;

  /** Array of potential duplicate invoices */
  potentialDuplicates: DuplicateMatch[];

  /** Validation issues generated from duplicate detection */
  validationIssues: ValidationIssue[];

  /** Confidence score for duplicate detection (0.0-1.0) */
  confidence: number;

  /** Reasoning for duplicate detection results */
  reasoning: string;
}
/**
 * Information about a potential duplicate match
 */
export interface DuplicateMatch {
  /** ID of the potentially duplicate invoice */
  duplicateInvoiceId: string;

  /** Vendor ID of the duplicate */
  vendorId: string;

  /** Invoice number of the duplicate */
  invoiceNumber: string;

  /** Date of the duplicate invoice */
  invoiceDate: Date;

  /** Similarity score (0.0-1.0) */
  similarityScore: number;

  /** Specific matching criteria that triggered the duplicate detection */
  matchingCriteria: MatchingCriteria[];

  /** Days difference between invoice dates */
  daysDifference: number;

  /** Amount difference if amounts were compared */
  amountDifference?: number;
}

/**
 * Criteria used for matching duplicates
 */
export interface MatchingCriteria {
  /** Type of criteria */
  criteriaType: DuplicateCriteriaType;

  /** Whether this criteria matched */
  matched: boolean;

  /** Confidence in this criteria match (0.0-1.0) */
  confidence: number;

  /** Details about the match */
  details: string;
}

/**
 * Types of criteria for duplicate detection
 */
export enum DuplicateCriteriaType {
  EXACT_INVOICE_NUMBER = 'exact_invoice_number',
  FUZZY_INVOICE_NUMBER = 'fuzzy_invoice_number',
  DATE_PROXIMITY = 'date_proximity',
  AMOUNT_SIMILARITY = 'amount_similarity',
  VENDOR_MATCH = 'vendor_match'
}
/**
 * Interface for duplicate detection service
 */
export interface DuplicateDetectionService {
  /**
   * Detect potential duplicates for a given invoice
   * @param invoice Invoice to check for duplicates
   * @returns Duplicate detection result
   */
  detectDuplicates(invoice: RawInvoice | NormalizedInvoice): Promise<DuplicateDetectionResult>;

  /**
   * Check if an invoice is a duplicate of any previously processed invoice
   * @param invoice Invoice to check
   * @returns True if duplicate is found
   */
  isDuplicate(invoice: RawInvoice | NormalizedInvoice): Promise<boolean>;

  /**
   * Get audit steps for duplicate detection operations
   * @returns Array of audit steps
   */
  getAuditSteps(): AuditStep[];

  /**
   * Clear audit steps (for testing)
   */
  clearAuditSteps(): void;
}

/**
 * Implementation of duplicate detection service
 */
export class DuplicateDetectionServiceImpl implements DuplicateDetectionService {
  private config: DuplicateDetectionConfig;
  private auditSteps: AuditStep[] = [];

  constructor(
    private db: DatabaseConnection,
    config?: Partial<DuplicateDetectionConfig>
  ) {
    this.config = {
      dateProximityDays: 7, // Default: 7 days proximity
      enableFuzzyMatching: true,
      fuzzyMatchThreshold: 0.85,
      enableAmountComparison: true,
      amountTolerancePercent: 5, // 5% tolerance
      ...config
    };
  }

  /**
   * Detect potential duplicates for a given invoice
   */
  async detectDuplicates(invoice: RawInvoice | NormalizedInvoice): Promise<DuplicateDetectionResult> {
    const startTime = Date.now();

    try {
      // Query database for potential duplicates
      const potentialDuplicates = await this.queryPotentialDuplicates(invoice);

      // Analyze each potential duplicate
      const duplicateMatches: DuplicateMatch[] = [];
      const validationIssues: ValidationIssue[] = [];

      for (const candidate of potentialDuplicates) {
        const match = await this.analyzeDuplicateCandidate(invoice, candidate);
        if (match && match.similarityScore >= this.config.fuzzyMatchThreshold) {
          duplicateMatches.push(match);

          // Create validation issue for duplicate
          validationIssues.push({
            severity: IssueSeverity.WARNING,
            issueType: ValidationIssueType.BUSINESS_RULE_VIOLATION,
            affectedField: 'invoice',
            description: `Potential duplicate invoice detected: ${match.duplicateInvoiceId} (similarity: ${(match.similarityScore * 100).toFixed(1)}%)`,
            suggestedResolution: 'Review invoice for potential duplication and verify with vendor if necessary'
          });
        }
      }

      // Calculate overall confidence
      const confidence = this.calculateDetectionConfidence(duplicateMatches);

      // Generate reasoning
      const reasoning = this.generateDetectionReasoning(invoice, duplicateMatches, potentialDuplicates.length);

      // Record audit step
      const auditStep: AuditStep = {
        id: `duplicate-detection-${Date.now()}`,
        timestamp: new Date(),
        operation: AuditOperation.VALIDATION,
        description: 'Duplicate invoice detection',
        input: {
          invoiceId: invoice.id,
          vendorId: invoice.vendorId,
          invoiceNumber: invoice.invoiceNumber,
          candidatesChecked: potentialDuplicates.length
        },
        output: {
          duplicatesFound: duplicateMatches.length > 0,
          duplicateCount: duplicateMatches.length,
          confidence,
          validationIssues: validationIssues.length
        },
        actor: 'DuplicateDetectionService',
        duration: Date.now() - startTime
      };

      this.auditSteps.push(auditStep);

      return {
        duplicatesFound: duplicateMatches.length > 0,
        potentialDuplicates: duplicateMatches,
        validationIssues,
        confidence,
        reasoning
      };

    } catch (error) {
      // Handle errors gracefully
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      const errorAuditStep: AuditStep = {
        id: `duplicate-detection-error-${Date.now()}`,
        timestamp: new Date(),
        operation: AuditOperation.ERROR_HANDLING,
        description: 'Duplicate detection error',
        input: { invoiceId: invoice.id, error: errorMessage },
        output: { fallbackResult: true },
        actor: 'DuplicateDetectionService',
        duration: Date.now() - startTime
      };

      this.auditSteps.push(errorAuditStep);

      // Return safe fallback result
      return {
        duplicatesFound: false,
        potentialDuplicates: [],
        validationIssues: [{
          severity: IssueSeverity.WARNING,
          issueType: ValidationIssueType.BUSINESS_RULE_VIOLATION,
          affectedField: 'duplicate_detection',
          description: `Duplicate detection failed: ${errorMessage}`,
          suggestedResolution: 'Manual review recommended due to duplicate detection system error'
        }],
        confidence: 0.1,
        reasoning: `Duplicate detection encountered an error: ${errorMessage}. Manual review is recommended to ensure no duplicates exist.`
      };
    }
  }
  /**
   * Check if an invoice is a duplicate
   */
  async isDuplicate(invoice: RawInvoice | NormalizedInvoice): Promise<boolean> {
    const result = await this.detectDuplicates(invoice);
    return result.duplicatesFound;
  }

  /**
   * Get audit steps
   */
  getAuditSteps(): AuditStep[] {
    return [...this.auditSteps];
  }

  /**
   * Clear audit steps
   */
  clearAuditSteps(): void {
    this.auditSteps = [];
  }

  /**
   * Query database for potential duplicate candidates
   */
  private async queryPotentialDuplicates(invoice: RawInvoice | NormalizedInvoice): Promise<ProcessedInvoiceRecord[]> {
    const invoiceDate = 'invoiceDate' in invoice ? invoice.invoiceDate : new Date();
    const dateFrom = new Date(invoiceDate);
    const dateTo = new Date(invoiceDate);

    // Calculate date range based on proximity configuration
    dateFrom.setDate(dateFrom.getDate() - this.config.dateProximityDays);
    dateTo.setDate(dateTo.getDate() + this.config.dateProximityDays);

    const query = `
      SELECT 
        id,
        vendor_id,
        invoice_number,
        invoice_date,
        confidence_score,
        processing_timestamp,
        corrections_made
      FROM processed_invoices 
      WHERE vendor_id = ? 
        AND invoice_date BETWEEN ? AND ?
        AND id != ?
      ORDER BY processing_timestamp DESC
      LIMIT 50
    `;

    const params = [
      invoice.vendorId,
      dateFrom.toISOString().split('T')[0],
      dateTo.toISOString().split('T')[0],
      invoice.id
    ];

    const rows = await this.db.query<{
      id: string;
      vendor_id: string;
      invoice_number: string;
      invoice_date: string;
      confidence_score: number;
      processing_timestamp: string;
      corrections_made: string | null;
    }>(query, params);

    return rows.map((row) => ({
      id: row.id,
      vendorId: row.vendor_id,
      invoiceNumber: row.invoice_number,
      invoiceDate: new Date(row.invoice_date),
      confidenceScore: row.confidence_score,
      processingTimestamp: new Date(row.processing_timestamp),
      correctionsMade: row.corrections_made ? JSON.parse(row.corrections_made) : []
    }));
  }

  /**
   * Analyze a potential duplicate candidate
   */
  private async analyzeDuplicateCandidate(
    invoice: RawInvoice | NormalizedInvoice,
    candidate: ProcessedInvoiceRecord
  ): Promise<DuplicateMatch | null> {
    const matchingCriteria: MatchingCriteria[] = [];
    let totalScore = 0;
    let criteriaCount = 0;

    // 1. Vendor match (required)
    const vendorMatch: MatchingCriteria = {
      criteriaType: DuplicateCriteriaType.VENDOR_MATCH,
      matched: invoice.vendorId === candidate.vendorId,
      confidence: invoice.vendorId === candidate.vendorId ? 1.0 : 0.0,
      details: `Vendor IDs: ${invoice.vendorId} vs ${candidate.vendorId}`
    };
    matchingCriteria.push(vendorMatch);

    if (!vendorMatch.matched) {
      return null; // Different vendors cannot be duplicates
    }

    // 2. Invoice number matching
    const exactNumberMatch = invoice.invoiceNumber === candidate.invoiceNumber;
    let numberMatchScore = 0;

    if (exactNumberMatch) {
      matchingCriteria.push({
        criteriaType: DuplicateCriteriaType.EXACT_INVOICE_NUMBER,
        matched: true,
        confidence: 1.0,
        details: `Exact match: ${invoice.invoiceNumber}`
      });
      numberMatchScore = 1.0;
    } else if (this.config.enableFuzzyMatching) {
      const fuzzyScore = this.calculateStringSimilarity(invoice.invoiceNumber, candidate.invoiceNumber);
      matchingCriteria.push({
        criteriaType: DuplicateCriteriaType.FUZZY_INVOICE_NUMBER,
        matched: fuzzyScore >= this.config.fuzzyMatchThreshold,
        confidence: fuzzyScore,
        details: `Fuzzy match score: ${(fuzzyScore * 100).toFixed(1)}% (${invoice.invoiceNumber} vs ${candidate.invoiceNumber})`
      });
      numberMatchScore = fuzzyScore;
    }

    totalScore += numberMatchScore;
    criteriaCount++;

    // 3. Date proximity
    const invoiceDate = 'invoiceDate' in invoice ? invoice.invoiceDate : new Date();
    const daysDifference = Math.abs(
      (invoiceDate.getTime() - candidate.invoiceDate.getTime()) / (1000 * 60 * 60 * 24)
    );

    const dateProximityScore = Math.max(0, 1 - (daysDifference / this.config.dateProximityDays));
    matchingCriteria.push({
      criteriaType: DuplicateCriteriaType.DATE_PROXIMITY,
      matched: daysDifference <= this.config.dateProximityDays,
      confidence: dateProximityScore,
      details: `Date difference: ${daysDifference.toFixed(1)} days (threshold: ${this.config.dateProximityDays} days)`
    });

    totalScore += dateProximityScore;
    criteriaCount++;

    // 4. Amount comparison (if available and enabled)
    let amountDifference: number | undefined;
    if (this.config.enableAmountComparison && 'totalAmount' in invoice) {
      // For this implementation, we'll assume candidate has amount info
      // In a real system, you'd query additional invoice details
      const amountScore = 0.8; // Placeholder - would calculate based on actual amounts
      matchingCriteria.push({
        criteriaType: DuplicateCriteriaType.AMOUNT_SIMILARITY,
        matched: true,
        confidence: amountScore,
        details: 'Amount comparison (placeholder implementation)'
      });

      totalScore += amountScore;
      criteriaCount++;
      amountDifference = 0; // Placeholder
    }

    // Calculate overall similarity score
    const similarityScore = criteriaCount > 0 ? totalScore / criteriaCount : 0;

    const result: DuplicateMatch = {
      duplicateInvoiceId: candidate.id,
      vendorId: candidate.vendorId,
      invoiceNumber: candidate.invoiceNumber,
      invoiceDate: candidate.invoiceDate,
      similarityScore,
      matchingCriteria,
      daysDifference
    };
    if (amountDifference !== undefined) {
      result.amountDifference = amountDifference;
    }
    return result;
  }
  /**
   * Calculate string similarity using Levenshtein distance
   */
  private calculateStringSimilarity(str1: string, str2: string): number {
    if (str1 === str2) return 1.0;
    if (str1.length === 0 || str2.length === 0) return 0.0;

    // Normalize strings (remove spaces, convert to lowercase)
    const s1 = str1.replace(/\s+/g, '').toLowerCase();
    const s2 = str2.replace(/\s+/g, '').toLowerCase();

    if (s1 === s2) return 1.0;

    // Calculate Levenshtein distance
    const matrix: number[][] = [];
    const len1 = s1.length;
    const len2 = s2.length;

    // Initialize matrix
    for (let i = 0; i <= len1; i++) {
      matrix[i] = [];
      matrix[i]![0] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[0]![j] = j;
    }

    // Fill matrix
    for (let i = 1; i <= len1; i++) {
      for (let j = 1; j <= len2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        const deletion = matrix[i - 1]![j]! + 1;
        const insertion = matrix[i]![j - 1]! + 1;
        const substitution = matrix[i - 1]![j - 1]! + cost;
        matrix[i]![j] = Math.min(deletion, insertion, substitution);
      }
    }

    const distance = matrix[len1]![len2]!;
    const maxLength = Math.max(len1, len2);

    return maxLength === 0 ? 1.0 : 1 - (distance / maxLength);
  }

  /**
   * Calculate overall confidence in duplicate detection
   */
  private calculateDetectionConfidence(duplicateMatches: DuplicateMatch[]): number {
    if (duplicateMatches.length === 0) {
      return 0.9; // High confidence that no duplicates exist
    }

    // Calculate confidence based on the highest similarity score
    const maxSimilarity = Math.max(...duplicateMatches.map(m => m.similarityScore));

    // Higher similarity = higher confidence in duplicate detection
    return Math.min(0.95, maxSimilarity);
  }

  /**
   * Generate reasoning for duplicate detection results
   */
  private generateDetectionReasoning(
    invoice: RawInvoice | NormalizedInvoice,
    duplicateMatches: DuplicateMatch[],
    candidatesChecked: number
  ): string {
    if (duplicateMatches.length === 0) {
      return `No duplicate invoices detected. Checked ${candidatesChecked} potential candidates ` +
        `from vendor ${invoice.vendorId} within ${this.config.dateProximityDays} days of invoice date. ` +
        `Invoice number "${invoice.invoiceNumber}" appears to be unique.`;
    }

    const bestMatch = duplicateMatches.reduce((best, current) =>
      current.similarityScore > best.similarityScore ? current : best
    );

    const matchDetails = bestMatch.matchingCriteria
      .filter(c => c.matched)
      .map(c => c.details)
      .join('; ');

    return `Detected ${duplicateMatches.length} potential duplicate(s) for invoice ${invoice.invoiceNumber} ` +
      `from vendor ${invoice.vendorId}. Best match: ${bestMatch.duplicateInvoiceId} ` +
      `(similarity: ${(bestMatch.similarityScore * 100).toFixed(1)}%). ` +
      `Matching criteria: ${matchDetails}. ` +
      `Manual review recommended to confirm duplication.`;
  }
}

/**
 * Database record for processed invoices
 */
interface ProcessedInvoiceRecord {
  id: string;
  vendorId: string;
  invoiceNumber: string;
  invoiceDate: Date;
  confidenceScore: number;
  processingTimestamp: Date;
  correctionsMade: any[];
}

/**
 * Factory function to create duplicate detection service
 */
export function createDuplicateDetectionService(
  db: DatabaseConnection,
  config?: Partial<DuplicateDetectionConfig>
): DuplicateDetectionService {
  return new DuplicateDetectionServiceImpl(db, config);
}