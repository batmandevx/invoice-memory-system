/**
 * AI Agent Memory System - Main Entry Point
 * 
 * This module provides the main exports for the AI Agent Memory System,
 * including the core interfaces, types, and factory functions for creating
 * memory system instances.
 */

// Core type exports
export * from './types';

// Database exports
export { DatabaseConnection, DatabaseConfig, DatabaseStats, createDefaultConnection } from './database/connection';

// Main memory system implementation (will be implemented in future tasks)
// export { MemorySystemImpl } from './core/memory-system';

/**
 * Factory function to create a new memory system instance
 * with default configuration
 */
export async function createMemorySystem(databasePath?: string): Promise<import('./types').MemorySystem> {
  // const { MemorySystemImpl } = await import('./core/memory-system');
  const { createDefaultConnection } = await import('./database/connection');
  
  const dbConnection = createDefaultConnection(databasePath);
  await dbConnection.initialize();
  
  // return new MemorySystemImpl(dbConnection);
  throw new Error('MemorySystemImpl not yet implemented');
}

/**
 * Version information
 */
export const VERSION = '1.0.0';

/**
 * System metadata
 */
export const SYSTEM_INFO = {
  name: 'AI Agent Memory System',
  version: VERSION,
  description: 'A learning layer for invoice processing automation that stores reusable insights from past invoices',
  author: 'AI Agent Memory System Team',
  license: 'MIT'
} as const;