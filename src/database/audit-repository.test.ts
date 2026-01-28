/**
 * Tests for AuditRepository
 * 
 * Comprehensive test suite for audit trail management functionality
 */

import { DatabaseConnection } from './connection';
import { 
  AuditRepository, 
  SQLiteAuditRepository, 
  AuditCriteria,
  createAuditRepository 
} from './audit-repository';
import {
  AuditStep,
  AuditOperation
} from '../types';
import { createTestDatabase, cleanupTestDatabase } from '../test/setup';

describe('AuditRepository', () => {
  let db: DatabaseConnection;
  let auditRepository: AuditRepository;

  beforeEach(async () => {
    db = await createTestDatabase();
    auditRepository = createAuditRepository(db);
  });

  afterEach(async () => {
    await cleanupTestDatabase();
  });

  describe('recordAuditStep', () => {
    it('should record a single audit step', async () => {
      const auditStep: AuditStep = {
        id: 'test-step-1',
        timestamp: new Date('2024-01-15T10:00:00Z'),
        operation: AuditOperation.MEMORY_RECALL,
        description: 'Recalled memories for vendor processing',
        input: {
          invoiceId: 'inv-123',
          vendorId: 'vendor-456'
        },
        output: {
          memoriesFound: 3,
          confidence: 0.85
        },
        actor: 'system',
        duration: 150
      };

      await auditRepository.recordAuditStep(auditStep);

      // Verify the step was recorded
      const auditTrail = await auditRepository.getAuditTrail('inv-123');
      expect(auditTrail).toHaveLength(1);
      expect(auditTrail[0]).toMatchObject({
        id: 'test-step-1',
        operation: AuditOperation.MEMORY_RECALL,
        description: 'Recalled memories for vendor processing',
        actor: 'system',
        duration: 150
      });
    });

    it('should handle audit steps with null memory ID', async () => {
      const auditStep: AuditStep = {
        id: 'test-step-2',
        timestamp: new Date(),
        operation: AuditOperation.DECISION_MAKING,
        description: 'Made processing decision',
        input: { invoiceId: 'inv-456' },
        output: { decision: 'auto_approve' },
        actor: 'system',
        duration: 75
      };

      await expect(auditRepository.recordAuditStep(auditStep)).resolves.not.toThrow();
    });
  });

  describe('recordAuditSteps', () => {
    it('should record multiple audit steps in a batch', async () => {
      const auditSteps: AuditStep[] = [
        {
          id: 'batch-step-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          operation: AuditOperation.MEMORY_RECALL,
          description: 'Step 1',
          input: { invoiceId: 'inv-batch' },
          output: {},
          actor: 'system',
          duration: 100
        },
        {
          id: 'batch-step-2',
          timestamp: new Date('2024-01-15T10:01:00Z'),
          operation: AuditOperation.MEMORY_APPLICATION,
          description: 'Step 2',
          input: { invoiceId: 'inv-batch' },
          output: {},
          actor: 'system',
          duration: 200
        }
      ];

      await auditRepository.recordAuditSteps(auditSteps);

      const auditTrail = await auditRepository.getAuditTrail('inv-batch');
      expect(auditTrail).toHaveLength(2);
      expect(auditTrail.map(step => step.id)).toContain('batch-step-1');
      expect(auditTrail.map(step => step.id)).toContain('batch-step-2');
    });

    it('should handle empty audit steps array', async () => {
      await expect(auditRepository.recordAuditSteps([])).resolves.not.toThrow();
    });
  });

  describe('getAuditTrail', () => {
    beforeEach(async () => {
      // Set up test data
      const auditSteps: AuditStep[] = [
        {
          id: 'trail-step-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          operation: AuditOperation.MEMORY_RECALL,
          description: 'First step',
          input: { invoiceId: 'inv-trail' },
          output: {},
          actor: 'system',
          duration: 100
        },
        {
          id: 'trail-step-2',
          timestamp: new Date('2024-01-15T10:01:00Z'),
          operation: AuditOperation.MEMORY_APPLICATION,
          description: 'Second step',
          input: { invoiceId: 'inv-trail' },
          output: {},
          actor: 'system',
          duration: 150
        },
        {
          id: 'other-step',
          timestamp: new Date('2024-01-15T10:02:00Z'),
          operation: AuditOperation.DECISION_MAKING,
          description: 'Different invoice',
          input: { invoiceId: 'inv-other' },
          output: {},
          actor: 'system',
          duration: 75
        }
      ];

      await auditRepository.recordAuditSteps(auditSteps);
    });

    it('should return audit trail for specific invoice', async () => {
      const auditTrail = await auditRepository.getAuditTrail('inv-trail');
      
      expect(auditTrail).toHaveLength(2);
      expect(auditTrail[0]?.id).toBe('trail-step-1');
      expect(auditTrail[1]?.id).toBe('trail-step-2');
      
      // Should be ordered by timestamp ascending
      expect(auditTrail[0]?.timestamp.getTime()).toBeLessThan(
        auditTrail[1]?.timestamp.getTime() || 0
      );
    });

    it('should return empty array for non-existent invoice', async () => {
      const auditTrail = await auditRepository.getAuditTrail('non-existent');
      expect(auditTrail).toHaveLength(0);
    });
  });

  describe('getMemoryAuditTrail', () => {
    beforeEach(async () => {
      // First create a memory in the database to satisfy foreign key constraint
      const mockMemory = {
        id: 'mem-456',
        type: 'vendor',
        confidence: 0.8,
        created_at: new Date().toISOString(),
        last_used: new Date().toISOString(),
        usage_count: 1,
        success_rate: 1.0,
        pattern_type: 'field_mapping',
        pattern_data: JSON.stringify({ threshold: 0.7 }),
        context_data: JSON.stringify({ vendorId: 'test-vendor' }),
        archived: false
      };

      await db.execute(
        `INSERT INTO memories (
          id, type, confidence, created_at, last_used, usage_count, 
          success_rate, pattern_type, pattern_data, context_data, archived
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          mockMemory.id,
          mockMemory.type,
          mockMemory.confidence,
          mockMemory.created_at,
          mockMemory.last_used,
          mockMemory.usage_count,
          mockMemory.success_rate,
          mockMemory.pattern_type,
          mockMemory.pattern_data,
          mockMemory.context_data,
          mockMemory.archived
        ]
      );

      const auditSteps: AuditStep[] = [
        {
          id: 'memory-step-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          operation: AuditOperation.MEMORY_APPLICATION,
          description: 'Applied memory',
          input: { 
            invoiceId: 'inv-123',
            memoryId: 'mem-456'
          },
          output: {},
          actor: 'system',
          duration: 100
        },
        {
          id: 'memory-step-2',
          timestamp: new Date('2024-01-15T10:01:00Z'),
          operation: AuditOperation.MEMORY_LEARNING,
          description: 'Updated memory',
          input: { 
            invoiceId: 'inv-123',
            memory: { id: 'mem-456' }
          },
          output: {},
          actor: 'system',
          duration: 50
        }
      ];

      await auditRepository.recordAuditSteps(auditSteps);
    });

    it('should return audit trail for specific memory', async () => {
      const memoryTrail = await auditRepository.getMemoryAuditTrail('mem-456');
      
      expect(memoryTrail).toHaveLength(2);
      expect(memoryTrail.every(step => 
        (step.input as any)?.memoryId === 'mem-456' || 
        (step.input as any)?.memory?.id === 'mem-456'
      )).toBe(true);
    });
  });

  describe('generateAuditReport', () => {
    beforeEach(async () => {
      // Set up comprehensive test data
      const auditSteps: AuditStep[] = [
        {
          id: 'report-step-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          operation: AuditOperation.MEMORY_RECALL,
          description: 'Memory recall',
          input: { invoiceId: 'inv-1' },
          output: {},
          actor: 'system',
          duration: 100
        },
        {
          id: 'report-step-2',
          timestamp: new Date('2024-01-15T11:00:00Z'),
          operation: AuditOperation.MEMORY_APPLICATION,
          description: 'Memory application',
          input: { invoiceId: 'inv-1' },
          output: {},
          actor: 'user-123',
          duration: 200
        },
        {
          id: 'report-step-3',
          timestamp: new Date('2024-01-16T10:00:00Z'),
          operation: AuditOperation.DECISION_MAKING,
          description: 'Decision making',
          input: { invoiceId: 'inv-2' },
          output: {},
          actor: 'system',
          duration: 150
        }
      ];

      await auditRepository.recordAuditSteps(auditSteps);
    });

    it('should generate comprehensive audit report', async () => {
      const criteria: AuditCriteria = {
        startDate: new Date('2024-01-15T00:00:00Z'),
        endDate: new Date('2024-01-16T23:59:59Z')
      };

      const report = await auditRepository.generateAuditReport(criteria);

      expect(report.totalCount).toBe(3);
      expect(report.auditSteps).toHaveLength(3);
      expect(report.criteria).toEqual(criteria);
      expect(report.generatedAt).toBeInstanceOf(Date);
      
      // Check summary statistics
      expect(report.summary.operationCounts).toBeDefined();
      expect(report.summary.actorCounts).toBeDefined();
      expect(report.summary.averageDuration).toBeGreaterThan(0);
      expect(report.summary.totalDuration).toBeGreaterThan(0);
    });

    it('should filter by invoice ID', async () => {
      const criteria: AuditCriteria = {
        invoiceId: 'inv-1'
      };

      const report = await auditRepository.generateAuditReport(criteria);

      expect(report.totalCount).toBe(2);
      expect(report.auditSteps).toHaveLength(2);
      expect(report.auditSteps.every(step => 
        (step.input as any)?.invoiceId === 'inv-1'
      )).toBe(true);
    });

    it('should filter by operation type', async () => {
      const criteria: AuditCriteria = {
        operationType: AuditOperation.MEMORY_RECALL
      };

      const report = await auditRepository.generateAuditReport(criteria);

      expect(report.totalCount).toBe(1);
      expect(report.auditSteps[0]?.operation).toBe(AuditOperation.MEMORY_RECALL);
    });

    it('should handle pagination', async () => {
      const criteria: AuditCriteria = {
        limit: 2,
        offset: 1
      };

      const report = await auditRepository.generateAuditReport(criteria);

      expect(report.totalCount).toBe(3);
      expect(report.auditSteps).toHaveLength(2);
    });
  });

  describe('getAuditStepsByDateRange', () => {
    beforeEach(async () => {
      const auditSteps: AuditStep[] = [
        {
          id: 'date-step-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          operation: AuditOperation.MEMORY_RECALL,
          description: 'Within range',
          input: { invoiceId: 'inv-1' },
          output: {},
          actor: 'system',
          duration: 100
        },
        {
          id: 'date-step-2',
          timestamp: new Date('2024-01-20T10:00:00Z'),
          operation: AuditOperation.MEMORY_APPLICATION,
          description: 'Outside range',
          input: { invoiceId: 'inv-2' },
          output: {},
          actor: 'system',
          duration: 150
        }
      ];

      await auditRepository.recordAuditSteps(auditSteps);
    });

    it('should return steps within date range', async () => {
      const startDate = new Date('2024-01-14T00:00:00Z');
      const endDate = new Date('2024-01-16T23:59:59Z');

      const steps = await auditRepository.getAuditStepsByDateRange(startDate, endDate);

      expect(steps).toHaveLength(1);
      expect(steps[0]?.id).toBe('date-step-1');
    });
  });

  describe('getAuditStepsByOperation', () => {
    beforeEach(async () => {
      const auditSteps: AuditStep[] = [
        {
          id: 'op-step-1',
          timestamp: new Date(),
          operation: AuditOperation.MEMORY_RECALL,
          description: 'Recall operation',
          input: { invoiceId: 'inv-1' },
          output: {},
          actor: 'system',
          duration: 100
        },
        {
          id: 'op-step-2',
          timestamp: new Date(),
          operation: AuditOperation.MEMORY_APPLICATION,
          description: 'Application operation',
          input: { invoiceId: 'inv-2' },
          output: {},
          actor: 'system',
          duration: 150
        }
      ];

      await auditRepository.recordAuditSteps(auditSteps);
    });

    it('should return steps for specific operation type', async () => {
      const steps = await auditRepository.getAuditStepsByOperation(AuditOperation.MEMORY_RECALL);

      expect(steps).toHaveLength(1);
      expect(steps[0]?.operation).toBe(AuditOperation.MEMORY_RECALL);
    });
  });

  describe('getAuditStepsByActor', () => {
    beforeEach(async () => {
      const auditSteps: AuditStep[] = [
        {
          id: 'actor-step-1',
          timestamp: new Date(),
          operation: AuditOperation.MEMORY_RECALL,
          description: 'System operation',
          input: { invoiceId: 'inv-1' },
          output: {},
          actor: 'system',
          duration: 100
        },
        {
          id: 'actor-step-2',
          timestamp: new Date(),
          operation: AuditOperation.MEMORY_APPLICATION,
          description: 'User operation',
          input: { invoiceId: 'inv-2' },
          output: {},
          actor: 'user-123',
          duration: 150
        }
      ];

      await auditRepository.recordAuditSteps(auditSteps);
    });

    it('should return steps for specific actor', async () => {
      const steps = await auditRepository.getAuditStepsByActor('user-123');

      expect(steps).toHaveLength(1);
      expect(steps[0]?.actor).toBe('user-123');
    });
  });

  describe('cleanupOldAuditRecords', () => {
    beforeEach(async () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days ago

      const recentDate = new Date();
      recentDate.setDate(recentDate.getDate() - 10); // 10 days ago

      const auditSteps: AuditStep[] = [
        {
          id: 'old-step',
          timestamp: oldDate,
          operation: AuditOperation.MEMORY_RECALL,
          description: 'Old step',
          input: { invoiceId: 'inv-old' },
          output: {},
          actor: 'system',
          duration: 100
        },
        {
          id: 'recent-step',
          timestamp: recentDate,
          operation: AuditOperation.MEMORY_APPLICATION,
          description: 'Recent step',
          input: { invoiceId: 'inv-recent' },
          output: {},
          actor: 'system',
          duration: 150
        }
      ];

      await auditRepository.recordAuditSteps(auditSteps);
    });

    it('should clean up old audit records', async () => {
      const deletedCount = await auditRepository.cleanupOldAuditRecords(30);

      expect(deletedCount).toBe(1);

      // Verify old record is gone
      const oldTrail = await auditRepository.getAuditTrail('inv-old');
      expect(oldTrail).toHaveLength(0);

      // Verify recent record remains
      const recentTrail = await auditRepository.getAuditTrail('inv-recent');
      expect(recentTrail).toHaveLength(1);
    });
  });

  describe('getAuditStatistics', () => {
    beforeEach(async () => {
      const auditSteps: AuditStep[] = [
        {
          id: 'stats-step-1',
          timestamp: new Date('2024-01-15T10:00:00Z'),
          operation: AuditOperation.MEMORY_RECALL,
          description: 'Stats step 1',
          input: { invoiceId: 'inv-1' },
          output: {},
          actor: 'system',
          duration: 100
        },
        {
          id: 'stats-step-2',
          timestamp: new Date('2024-01-15T11:00:00Z'),
          operation: AuditOperation.MEMORY_RECALL,
          description: 'Stats step 2',
          input: { invoiceId: 'inv-2' },
          output: {},
          actor: 'user-123',
          duration: 200
        }
      ];

      await auditRepository.recordAuditSteps(auditSteps);
    });

    it('should return comprehensive audit statistics', async () => {
      const stats = await auditRepository.getAuditStatistics();

      expect(stats.operationCounts).toBeDefined();
      expect(stats.operationCounts[AuditOperation.MEMORY_RECALL]).toBe(2);
      
      expect(stats.actorCounts).toBeDefined();
      expect(stats.actorCounts['system']).toBe(1);
      expect(stats.actorCounts['user-123']).toBe(1);
      
      expect(stats.averageDuration).toBe(150);
      expect(stats.totalDuration).toBe(300);
      
      expect(stats.dateRange.earliest).toBeInstanceOf(Date);
      expect(stats.dateRange.latest).toBeInstanceOf(Date);
    });
  });

  describe('createAuditRepository', () => {
    it('should create audit repository instance', () => {
      const repository = createAuditRepository(db);
      expect(repository).toBeInstanceOf(SQLiteAuditRepository);
    });
  });

  describe('error handling', () => {
    it('should handle malformed audit step data gracefully', async () => {
      const auditStep: AuditStep = {
        id: 'malformed-step',
        timestamp: new Date(),
        operation: AuditOperation.MEMORY_RECALL,
        description: 'Malformed step',
        input: { circular: {} },
        output: {},
        actor: 'system',
        duration: 100
      };

      // Create circular reference
      (auditStep.input as any).circular.self = auditStep.input;

      // Should handle JSON serialization error gracefully
      await expect(auditRepository.recordAuditStep(auditStep)).rejects.toThrow();
    });

    it('should handle database connection errors', async () => {
      await db.close();

      const auditStep: AuditStep = {
        id: 'error-step',
        timestamp: new Date(),
        operation: AuditOperation.MEMORY_RECALL,
        description: 'Error step',
        input: {},
        output: {},
        actor: 'system',
        duration: 100
      };

      await expect(auditRepository.recordAuditStep(auditStep)).rejects.toThrow();
    });
  });
});