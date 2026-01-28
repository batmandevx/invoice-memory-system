/**
 * Test setup and configuration for the AI Agent Memory System
 * 
 * This module configures Jest testing environment and provides
 * utilities for testing the memory system components.
 */

import { DatabaseConnection } from '../database/connection';
import { unlinkSync, existsSync } from 'fs';
import { join } from 'path';

/**
 * Global test configuration
 */
export const TEST_CONFIG = {
  /** Timeout for property-based tests */
  PROPERTY_TEST_TIMEOUT: 30000,
  
  /** Number of iterations for property-based tests */
  PROPERTY_TEST_ITERATIONS: 100,
  
  /** Test database filename */
  TEST_DB_FILENAME: 'test_memory_system.db',
  
  /** Whether to clean up test databases after tests */
  CLEANUP_TEST_DB: true
};

/**
 * Test database connection instance
 */
let testDbConnection: DatabaseConnection | null = null;

/**
 * Create a test database connection with unique filename
 */
export async function createTestDatabase(): Promise<DatabaseConnection> {
  // Generate unique database filename for each test
  const uniqueId = Math.random().toString(36).substr(2, 9);
  const testDbPath = join(process.cwd(), `test_memory_system_${uniqueId}.db`);
  
  // Clean up existing test database
  if (existsSync(testDbPath)) {
    try {
      unlinkSync(testDbPath);
    } catch (error) {
      // Ignore deletion errors
    }
  }
  
  testDbConnection = new DatabaseConnection({
    filename: testDbPath,
    verbose: false,
    create: true
  });
  
  await testDbConnection.initialize();
  return testDbConnection;
}

/**
 * Get the current test database connection
 */
export function getTestDatabase(): DatabaseConnection {
  if (!testDbConnection) {
    throw new Error('Test database not initialized. Call createTestDatabase() first.');
  }
  return testDbConnection;
}

/**
 * Clean up test database
 */
export async function cleanupTestDatabase(): Promise<void> {
  if (testDbConnection) {
    const dbPath = testDbConnection.getFilename();
    try {
      await testDbConnection.close();
    } catch (error) {
      // Ignore close errors
    }
    testDbConnection = null;
    
    // Clean up the specific database file
    if (TEST_CONFIG.CLEANUP_TEST_DB && dbPath && existsSync(dbPath)) {
      try {
        unlinkSync(dbPath);
      } catch (error) {
        // Ignore file deletion errors (file might be locked)
        console.warn(`Warning: Could not delete test database file: ${error}`);
      }
    }
  }
}

/**
 * Setup function called before each test suite
 */
beforeEach(async () => {
  // Reset test database for each test - but only if we have an active connection
  if (testDbConnection) {
    try {
      await testDbConnection.close();
    } catch (error) {
      // Ignore close errors
    }
    testDbConnection = null;
  }
});

/**
 * Cleanup function called after all tests
 */
afterAll(async () => {
  await cleanupTestDatabase();
});

/**
 * Utility function to create sample test data
 */
export const TestDataFactory = {
  /**
   * Create a sample raw invoice for testing
   */
  createRawInvoice: (overrides: Partial<any> = {}): any => ({
    id: 'test-invoice-001',
    vendorId: 'test-vendor-001',
    invoiceNumber: 'INV-2024-001',
    rawText: 'Sample invoice text content',
    extractedFields: [],
    metadata: {},
    ...overrides
  }),

  /**
   * Create a sample memory for testing
   */
  createMemory: (overrides: Partial<any> = {}): any => ({
    id: 'test-memory-001',
    type: 'vendor',
    confidence: 0.8,
    createdAt: new Date(),
    lastUsed: new Date(),
    usageCount: 5,
    successRate: 0.9,
    pattern: {
      patternType: 'field_mapping',
      patternData: { sourceField: 'Leistungsdatum', targetField: 'serviceDate' },
      threshold: 0.7
    },
    context: {
      vendorId: 'test-vendor-001',
      invoiceCharacteristics: {
        complexity: 'simple',
        language: 'de',
        documentFormat: 'pdf',
        extractionQuality: 'good'
      },
      historicalContext: {},
      environmentalFactors: []
    },
    ...overrides
  }),

  /**
   * Create a sample processing result for testing
   */
  createProcessingResult: (overrides: Partial<any> = {}): any => ({
    normalizedInvoice: TestDataFactory.createNormalizedInvoice(),
    proposedCorrections: [],
    requiresHumanReview: false,
    reasoning: 'Test processing completed successfully',
    confidenceScore: 0.85,
    memoryUpdates: [],
    auditTrail: [],
    ...overrides
  }),

  /**
   * Create a sample normalized invoice for testing
   */
  createNormalizedInvoice: (overrides: Partial<any> = {}): any => ({
    id: 'test-invoice-001',
    vendorId: 'test-vendor-001',
    invoiceNumber: 'INV-2024-001',
    invoiceDate: new Date('2024-01-15'),
    totalAmount: { amount: 1000.00, currency: 'EUR' },
    currency: 'EUR',
    lineItems: [],
    normalizedFields: [],
    ...overrides
  })
};

/**
 * Property-based testing utilities
 */
export const PropertyTestUtils = {
  /**
   * Default configuration for property-based tests
   */
  defaultConfig: {
    numRuns: TEST_CONFIG.PROPERTY_TEST_ITERATIONS,
    timeout: TEST_CONFIG.PROPERTY_TEST_TIMEOUT,
    verbose: process.env['NODE_ENV'] === 'development'
  },

  /**
   * Create a test description with property validation format
   */
  createPropertyDescription: (propertyNumber: number, description: string): string => {
    return `**Feature: ai-agent-memory-system, Property ${propertyNumber}: ${description}**`;
  }
};

/**
 * Mock data generators for testing
 */
export const MockGenerators = {
  /**
   * Generate a random confidence score
   */
  randomConfidence: (): number => Math.random(),

  /**
   * Generate a random vendor ID
   */
  randomVendorId: (): string => `vendor-${Math.random().toString(36).substr(2, 9)}`,

  /**
   * Generate a random invoice ID
   */
  randomInvoiceId: (): string => `invoice-${Math.random().toString(36).substr(2, 9)}`,

  /**
   * Generate a random memory ID
   */
  randomMemoryId: (): string => `memory-${Math.random().toString(36).substr(2, 9)}`,

  /**
   * Generate a random date within the last year
   */
  randomRecentDate: (): Date => {
    const now = new Date();
    const yearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const randomTime = yearAgo.getTime() + Math.random() * (now.getTime() - yearAgo.getTime());
    return new Date(randomTime);
  }
};

// Set global test timeout
jest.setTimeout(TEST_CONFIG.PROPERTY_TEST_TIMEOUT);