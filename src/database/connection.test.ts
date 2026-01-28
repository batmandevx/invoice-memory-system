/**
 * Database Connection Tests
 * 
 * Tests for database connection, initialization, and basic operations
 */

import { DatabaseConnection } from './connection';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('DatabaseConnection', () => {
  const testDbPath = join(process.cwd(), `test_connection_${Date.now()}.db`);
  let connection: DatabaseConnection;

  beforeEach(() => {
    // Clean up any existing test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
    
    connection = new DatabaseConnection({
      filename: testDbPath,
      verbose: false,
      create: true
    });
  });

  afterEach(async () => {
    if (connection) {
      await connection.close();
    }
    
    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('initialization', () => {
    it('should initialize database and schema successfully', async () => {
      await connection.initialize();
      
      const stats = await connection.getStats();
      expect(stats.isConnected).toBe(true);
      expect(stats.isInitialized).toBe(true);
      expect(stats.schemaVersion).toBe(1);
    });

    it('should handle multiple initialization calls gracefully', async () => {
      await connection.initialize();
      await connection.initialize(); // Should not throw
      
      const stats = await connection.getStats();
      expect(stats.isInitialized).toBe(true);
    });

    it('should create all required tables', async () => {
      await connection.initialize();
      
      const tables = await connection.query<{ name: string }>(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('memories');
      expect(tableNames).toContain('vendor_memories');
      expect(tableNames).toContain('correction_memories');
      expect(tableNames).toContain('resolution_memories');
      expect(tableNames).toContain('audit_trail');
      expect(tableNames).toContain('confidence_evolution');
      expect(tableNames).toContain('memory_performance');
      expect(tableNames).toContain('processed_invoices');
      expect(tableNames).toContain('system_config');
      expect(tableNames).toContain('schema_version');
    });
  });

  describe('database operations', () => {
    beforeEach(async () => {
      await connection.initialize();
    });

    it('should execute queries successfully', async () => {
      const result = await connection.query('SELECT 1 as test');
      expect(result).toHaveLength(1);
      expect(result[0]).toEqual({ test: 1 });
    });

    it('should execute single queries successfully', async () => {
      const result = await connection.queryOne<{ test: number }>('SELECT 1 as test');
      expect(result).toEqual({ test: 1 });
    });

    it('should handle empty query results', async () => {
      const result = await connection.queryOne('SELECT * FROM memories WHERE id = ?', ['nonexistent']);
      expect(result).toBeNull();
    });

    it('should execute statements and return metadata', async () => {
      const result = await connection.execute(
        'INSERT INTO memories (id, type, confidence, pattern_type, pattern_data, context_data) VALUES (?, ?, ?, ?, ?, ?)',
        ['test-1', 'vendor', 0.8, 'field_mapping', '{}', '{}']
      );
      
      expect(result.changes).toBe(1);
      expect(result.lastID).toBeGreaterThan(0);
    });
  });

  describe('transactions', () => {
    beforeEach(async () => {
      await connection.initialize();
    });

    it('should handle successful transactions', async () => {
      const result = await connection.withTransaction(async () => {
        await connection.execute(
          'INSERT INTO memories (id, type, confidence, pattern_type, pattern_data, context_data) VALUES (?, ?, ?, ?, ?, ?)',
          ['test-1', 'vendor', 0.8, 'field_mapping', '{}', '{}']
        );
        return 'success';
      });
      
      expect(result).toBe('success');
      
      const memory = await connection.queryOne('SELECT * FROM memories WHERE id = ?', ['test-1']);
      expect(memory).toBeTruthy();
    });

    it('should rollback failed transactions', async () => {
      try {
        await connection.withTransaction(async () => {
          await connection.execute(
            'INSERT INTO memories (id, type, confidence, pattern_type, pattern_data, context_data) VALUES (?, ?, ?, ?, ?, ?)',
            ['test-1', 'vendor', 0.8, 'field_mapping', '{}', '{}']
          );
          throw new Error('Test error');
        });
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
      }
      
      const memory = await connection.queryOne('SELECT * FROM memories WHERE id = ?', ['test-1']);
      expect(memory).toBeNull();
    });
  });

  describe('health check', () => {
    it('should return false for uninitialized connection', async () => {
      const health = await connection.healthCheck();
      expect(health).toBe(false);
    });

    it('should return true for healthy connection', async () => {
      await connection.initialize();
      const health = await connection.healthCheck();
      expect(health).toBe(true);
    });
  });

  describe('configuration', () => {
    beforeEach(async () => {
      await connection.initialize();
    });

    it('should have default system configuration', async () => {
      const configs = await connection.query<{ key: string; value: string; data_type: string }>(
        'SELECT key, value, data_type FROM system_config'
      );
      
      expect(configs.length).toBeGreaterThan(0);
      
      const configMap = new Map(configs.map(c => [c.key, { value: c.value, type: c.data_type }]));
      
      expect(configMap.has('escalation_threshold')).toBe(true);
      expect(configMap.has('memory_decay_rate')).toBe(true);
      expect(configMap.has('minimum_confidence')).toBe(true);
      expect(configMap.has('reinforcement_factor')).toBe(true);
      expect(configMap.has('failure_penalty')).toBe(true);
      expect(configMap.has('max_memory_age_days')).toBe(true);
      
      expect(configMap.get('escalation_threshold')?.value).toBe('0.7');
      expect(configMap.get('escalation_threshold')?.type).toBe('number');
    });
  });
});