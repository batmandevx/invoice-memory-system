/**
 * Audit Repository Implementation
 * 
 * Provides comprehensive audit trail management for the memory system.
 * Handles persistent storage of all operations, decisions, and changes
 * for compliance and debugging purposes.
 */

import { DatabaseConnection } from './connection';
import {
  AuditStep,
  AuditOperation
} from '../types';

/**
 * Criteria for generating audit reports
 */
export interface AuditCriteria {
  /** Start date for audit period */
  startDate?: Date;
  
  /** End date for audit period */
  endDate?: Date;
  
  /** Filter by specific invoice ID */
  invoiceId?: string;
  
  /** Filter by specific memory ID */
  memoryId?: string;
  
  /** Filter by operation type */
  operationType?: AuditOperation;
  
  /** Filter by user/actor */
  actor?: string;
  
  /** Maximum number of records to return */
  limit?: number;
  
  /** Offset for pagination */
  offset?: number;
}

/**
 * Audit report containing filtered audit trail data
 */
export interface AuditReport {
  /** Criteria used to generate the report */
  criteria: AuditCriteria;
  
  /** Total number of matching audit steps */
  totalCount: number;
  
  /** Audit steps matching the criteria */
  auditSteps: AuditStep[];
  
  /** Summary statistics */
  summary: AuditSummary;
  
  /** Report generation timestamp */
  generatedAt: Date;
}

/**
 * Summary statistics for audit reports
 */
export interface AuditSummary {
  /** Count by operation type */
  operationCounts: Record<AuditOperation, number>;
  
  /** Count by actor */
  actorCounts: Record<string, number>;
  
  /** Average operation duration */
  averageDuration: number;
  
  /** Total processing time */
  totalDuration: number;
  
  /** Date range covered */
  dateRange: {
    earliest: Date;
    latest: Date;
  };
}

/**
 * Repository interface for audit trail operations
 */
export interface AuditRepository {
  /**
   * Record a single audit step
   * @param step Audit step to record
   */
  recordAuditStep(step: AuditStep): Promise<void>;

  /**
   * Record multiple audit steps in a batch
   * @param steps Array of audit steps to record
   */
  recordAuditSteps(steps: AuditStep[]): Promise<void>;

  /**
   * Get complete audit trail for a specific invoice
   * @param invoiceId Invoice identifier
   * @returns Array of audit steps for the invoice
   */
  getAuditTrail(invoiceId: string): Promise<AuditStep[]>;

  /**
   * Get audit steps for a specific memory
   * @param memoryId Memory identifier
   * @returns Array of audit steps involving the memory
   */
  getMemoryAuditTrail(memoryId: string): Promise<AuditStep[]>;

  /**
   * Generate audit report based on criteria
   * @param criteria Filtering and selection criteria
   * @returns Comprehensive audit report
   */
  generateAuditReport(criteria: AuditCriteria): Promise<AuditReport>;

  /**
   * Get audit steps within a date range
   * @param startDate Start of date range
   * @param endDate End of date range
   * @param limit Maximum number of records
   * @returns Array of audit steps
   */
  getAuditStepsByDateRange(
    startDate: Date,
    endDate: Date,
    limit?: number
  ): Promise<AuditStep[]>;

  /**
   * Get audit steps by operation type
   * @param operationType Type of operation to filter by
   * @param limit Maximum number of records
   * @returns Array of audit steps
   */
  getAuditStepsByOperation(
    operationType: AuditOperation,
    limit?: number
  ): Promise<AuditStep[]>;

  /**
   * Get audit steps by actor (user or system)
   * @param actor Actor identifier
   * @param limit Maximum number of records
   * @returns Array of audit steps
   */
  getAuditStepsByActor(
    actor: string,
    limit?: number
  ): Promise<AuditStep[]>;

  /**
   * Clean up old audit records based on retention policy
   * @param retentionDays Number of days to retain audit records
   * @returns Number of records cleaned up
   */
  cleanupOldAuditRecords(retentionDays: number): Promise<number>;

  /**
   * Get audit trail statistics
   * @returns Summary statistics about the audit trail
   */
  getAuditStatistics(): Promise<AuditSummary>;
}

/**
 * SQLite-based implementation of AuditRepository
 */
export class SQLiteAuditRepository implements AuditRepository {
  constructor(private db: DatabaseConnection) {}

  /**
   * Record a single audit step
   */
  public async recordAuditStep(step: AuditStep): Promise<void> {
    await this.db.execute(
      `INSERT INTO audit_trail (
        invoice_id, operation_type, timestamp, memory_id,
        operation_data, reasoning, confidence_score, user_id
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        this.extractInvoiceId(step),
        step.operation,
        step.timestamp.toISOString(),
        this.extractMemoryId(step),
        JSON.stringify({
          id: step.id,
          description: step.description,
          input: step.input,
          output: step.output,
          duration: step.duration
        }),
        this.extractReasoning(step),
        this.extractConfidenceScore(step),
        step.actor
      ]
    );
  }

  /**
   * Record multiple audit steps in a batch
   */
  public async recordAuditSteps(steps: AuditStep[]): Promise<void> {
    if (steps.length === 0) return;

    await this.db.withTransaction(async () => {
      for (const step of steps) {
        await this.recordAuditStep(step);
      }
    });
  }

  /**
   * Get complete audit trail for a specific invoice
   */
  public async getAuditTrail(invoiceId: string): Promise<AuditStep[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM audit_trail 
       WHERE invoice_id = ? 
       ORDER BY timestamp ASC`,
      [invoiceId]
    );

    return rows.map(row => this.hydrateAuditStep(row));
  }

  /**
   * Get audit steps for a specific memory
   */
  public async getMemoryAuditTrail(memoryId: string): Promise<AuditStep[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM audit_trail 
       WHERE memory_id = ? 
       ORDER BY timestamp ASC`,
      [memoryId]
    );

    return rows.map(row => this.hydrateAuditStep(row));
  }

  /**
   * Generate audit report based on criteria
   */
  public async generateAuditReport(criteria: AuditCriteria): Promise<AuditReport> {
    const { whereClause, params } = this.buildWhereClause(criteria);
    
    // Get total count
    const countResult = await this.db.queryOne<{ count: number }>(
      `SELECT COUNT(*) as count FROM audit_trail ${whereClause}`,
      params
    );
    const totalCount = countResult?.count || 0;

    // Get audit steps with pagination
    const limit = criteria.limit || 1000;
    const offset = criteria.offset || 0;
    
    const rows = await this.db.query<any>(
      `SELECT * FROM audit_trail ${whereClause} 
       ORDER BY timestamp DESC 
       LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );

    const auditSteps = rows.map(row => this.hydrateAuditStep(row));
    
    // Generate summary statistics
    const summary = await this.generateAuditSummary(criteria);

    return {
      criteria,
      totalCount,
      auditSteps,
      summary,
      generatedAt: new Date()
    };
  }

  /**
   * Get audit steps within a date range
   */
  public async getAuditStepsByDateRange(
    startDate: Date,
    endDate: Date,
    limit: number = 1000
  ): Promise<AuditStep[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM audit_trail 
       WHERE timestamp >= ? AND timestamp <= ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [startDate.toISOString(), endDate.toISOString(), limit]
    );

    return rows.map(row => this.hydrateAuditStep(row));
  }

  /**
   * Get audit steps by operation type
   */
  public async getAuditStepsByOperation(
    operationType: AuditOperation,
    limit: number = 1000
  ): Promise<AuditStep[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM audit_trail 
       WHERE operation_type = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [operationType, limit]
    );

    return rows.map(row => this.hydrateAuditStep(row));
  }

  /**
   * Get audit steps by actor
   */
  public async getAuditStepsByActor(
    actor: string,
    limit: number = 1000
  ): Promise<AuditStep[]> {
    const rows = await this.db.query<any>(
      `SELECT * FROM audit_trail 
       WHERE user_id = ? 
       ORDER BY timestamp DESC 
       LIMIT ?`,
      [actor, limit]
    );

    return rows.map(row => this.hydrateAuditStep(row));
  }

  /**
   * Clean up old audit records based on retention policy
   */
  public async cleanupOldAuditRecords(retentionDays: number): Promise<number> {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

    const result = await this.db.execute(
      'DELETE FROM audit_trail WHERE timestamp < ?',
      [cutoffDate.toISOString()]
    );

    return result.changes || 0;
  }

  /**
   * Get audit trail statistics
   */
  public async getAuditStatistics(): Promise<AuditSummary> {
    return this.generateAuditSummary({});
  }

  /**
   * Build WHERE clause for audit queries
   */
  private buildWhereClause(criteria: AuditCriteria): { whereClause: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    if (criteria.startDate) {
      conditions.push('timestamp >= ?');
      params.push(criteria.startDate.toISOString());
    }

    if (criteria.endDate) {
      conditions.push('timestamp <= ?');
      params.push(criteria.endDate.toISOString());
    }

    if (criteria.invoiceId) {
      conditions.push('invoice_id = ?');
      params.push(criteria.invoiceId);
    }

    if (criteria.memoryId) {
      conditions.push('memory_id = ?');
      params.push(criteria.memoryId);
    }

    if (criteria.operationType) {
      conditions.push('operation_type = ?');
      params.push(criteria.operationType);
    }

    if (criteria.actor) {
      conditions.push('user_id = ?');
      params.push(criteria.actor);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    
    return { whereClause, params };
  }

  /**
   * Generate summary statistics for audit data
   */
  private async generateAuditSummary(criteria: AuditCriteria): Promise<AuditSummary> {
    const { whereClause, params } = this.buildWhereClause(criteria);

    // Get operation counts
    const operationRows = await this.db.query<{ operation_type: string; count: number }>(
      `SELECT operation_type, COUNT(*) as count 
       FROM audit_trail ${whereClause} 
       GROUP BY operation_type`,
      params
    );

    const operationCounts = {} as Record<AuditOperation, number>;
    for (const row of operationRows) {
      operationCounts[row.operation_type as AuditOperation] = row.count;
    }

    // Get actor counts
    const actorRows = await this.db.query<{ user_id: string; count: number }>(
      `SELECT COALESCE(user_id, 'system') as user_id, COUNT(*) as count 
       FROM audit_trail ${whereClause} 
       GROUP BY user_id`,
      params
    );

    const actorCounts: Record<string, number> = {};
    for (const row of actorRows) {
      actorCounts[row.user_id || 'system'] = row.count;
    }

    // Get duration statistics
    const durationRows = await this.db.query<any>(
      `SELECT 
         AVG(CAST(JSON_EXTRACT(operation_data, '$.duration') AS REAL)) as avg_duration,
         SUM(CAST(JSON_EXTRACT(operation_data, '$.duration') AS REAL)) as total_duration,
         MIN(timestamp) as earliest,
         MAX(timestamp) as latest
       FROM audit_trail ${whereClause}`,
      params
    );

    const durationRow = durationRows[0];
    const averageDuration = durationRow?.avg_duration || 0;
    const totalDuration = durationRow?.total_duration || 0;
    const earliest = durationRow?.earliest ? new Date(durationRow.earliest) : new Date();
    const latest = durationRow?.latest ? new Date(durationRow.latest) : new Date();

    return {
      operationCounts,
      actorCounts,
      averageDuration,
      totalDuration,
      dateRange: {
        earliest,
        latest
      }
    };
  }

  /**
   * Hydrate audit step from database row
   */
  private hydrateAuditStep(row: any): AuditStep {
    const operationData = JSON.parse(row.operation_data);
    
    return {
      id: operationData.id,
      timestamp: new Date(row.timestamp),
      operation: row.operation_type as AuditOperation,
      description: operationData.description,
      input: operationData.input || {},
      output: operationData.output || {},
      actor: row.user_id || 'system',
      duration: operationData.duration || 0
    };
  }

  /**
   * Extract invoice ID from audit step input/output
   */
  private extractInvoiceId(step: AuditStep): string {
    // Try to extract invoice ID from input or output
    const input = step.input as any;
    const output = step.output as any;
    
    const invoiceId = input?.invoiceId || 
                     input?.invoice?.id || 
                     output?.invoiceId ||
                     output?.invoice?.id ||
                     input?.context?.invoice?.id;
    
    return invoiceId || 'unknown';
  }

  /**
   * Extract memory ID from audit step input/output
   */
  private extractMemoryId(step: AuditStep): string | null {
    // Try to extract memory ID from input or output
    const input = step.input as any;
    const output = step.output as any;
    
    const memoryId = input?.memoryId || 
                    input?.memory?.id || 
                    output?.memoryId ||
                    output?.memory?.id;
    
    return memoryId || null;
  }

  /**
   * Extract reasoning from audit step
   */
  private extractReasoning(step: AuditStep): string | null {
    // Try to extract reasoning from input or output
    const input = step.input as any;
    const output = step.output as any;
    
    const reasoning = input?.reasoning || 
                     output?.reasoning ||
                     step.description;
    
    return reasoning || null;
  }

  /**
   * Extract confidence score from audit step
   */
  private extractConfidenceScore(step: AuditStep): number | null {
    // Try to extract confidence score from input or output
    const input = step.input as any;
    const output = step.output as any;
    
    const confidence = input?.confidence || 
                      input?.confidenceScore ||
                      output?.confidence ||
                      output?.confidenceScore;
    
    return confidence || null;
  }
}

/**
 * Create an audit repository instance
 */
export function createAuditRepository(db: DatabaseConnection): AuditRepository {
  return new SQLiteAuditRepository(db);
}