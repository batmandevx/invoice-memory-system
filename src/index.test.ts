/**
 * Main Entry Point Integration Tests
 * 
 * Tests for the main module exports and factory functions
 */

import { 
  createMemorySystem, 
  createDefaultConnection, 
  VERSION, 
  SYSTEM_INFO,
  MemoryType,
  PatternType,
  ComplexityLevel,
  QualityLevel
} from './index';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

describe('Main Entry Point', () => {
  const testDbPath = join(process.cwd(), 'test_main.db');

  afterEach(() => {
    // Clean up test database
    if (existsSync(testDbPath)) {
      unlinkSync(testDbPath);
    }
  });

  describe('exports', () => {
    it('should export version information', () => {
      expect(VERSION).toBe('1.0.0');
      expect(SYSTEM_INFO.name).toBe('AI Agent Memory System');
      expect(SYSTEM_INFO.version).toBe(VERSION);
      expect(SYSTEM_INFO.description).toContain('learning layer');
    });

    it('should export type enums', () => {
      expect(MemoryType.VENDOR).toBe('vendor');
      expect(MemoryType.CORRECTION).toBe('correction');
      expect(MemoryType.RESOLUTION).toBe('resolution');

      expect(PatternType.REGEX).toBe('regex');
      expect(PatternType.FIELD_MAPPING).toBe('field_mapping');

      expect(ComplexityLevel.SIMPLE).toBe('simple');
      expect(QualityLevel.GOOD).toBe('good');
    });

    it('should export database connection functions', () => {
      expect(typeof createDefaultConnection).toBe('function');
    });

    it('should export memory system factory function', () => {
      expect(typeof createMemorySystem).toBe('function');
    });
  });

  describe('createDefaultConnection', () => {
    it('should create a database connection with default settings', () => {
      const connection = createDefaultConnection(testDbPath);
      expect(connection).toBeDefined();
      expect(typeof connection.initialize).toBe('function');
      expect(typeof connection.close).toBe('function');
    });

    it('should use default filename when none provided', () => {
      const connection = createDefaultConnection();
      expect(connection).toBeDefined();
    });
  });

  describe('createMemorySystem', () => {
    it('should create a memory system instance', async () => {
      const memorySystem = await createMemorySystem(testDbPath);
      
      expect(memorySystem).toBeDefined();
      expect(typeof memorySystem.processInvoice).toBe('function');
      expect(typeof memorySystem.recallMemories).toBe('function');
      expect(typeof memorySystem.applyMemories).toBe('function');
      expect(typeof memorySystem.makeDecision).toBe('function');
      expect(typeof memorySystem.learnFromOutcome).toBe('function');

      // Clean up
      await memorySystem.close();
    });

    it('should initialize database automatically', async () => {
      const memorySystem = await createMemorySystem(testDbPath);
      
      // Verify database is initialized by checking we can access it
      const dbConnection = (memorySystem as any).getDatabaseConnection();
      const stats = await dbConnection.getStats();
      
      expect(stats.isInitialized).toBe(true);
      expect(stats.schemaVersion).toBe(1);

      // Clean up
      await memorySystem.close();
    });

    it('should handle custom database path', async () => {
      const customPath = join(process.cwd(), 'custom_test.db');
      const memorySystem = await createMemorySystem(customPath);
      
      expect(memorySystem).toBeDefined();
      
      // Verify custom path is used
      const dbConnection = (memorySystem as any).getDatabaseConnection();
      const stats = await dbConnection.getStats();
      expect(stats.filename).toBe(customPath);

      // Clean up
      await memorySystem.close();
      if (existsSync(customPath)) {
        unlinkSync(customPath);
      }
    });

    it('should use default path when none provided', async () => {
      const memorySystem = await createMemorySystem();
      
      expect(memorySystem).toBeDefined();

      // Clean up
      await memorySystem.close();
      
      // Clean up default database file
      const defaultPath = 'memory_system.db';
      if (existsSync(defaultPath)) {
        unlinkSync(defaultPath);
      }
    });
  });
});