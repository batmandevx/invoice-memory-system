/**
 * Database connection and initialization module
 * 
 * Manages SQLite database connections, schema initialization,
 * and provides connection pooling for the memory system.
 */

import * as sqlite3 from 'sqlite3';
import { readFileSync } from 'fs';
import { join } from 'path';

/**
 * Database connection configuration
 */
export interface DatabaseConfig {
  /** Path to the SQLite database file */
  filename: string;
  
  /** Whether to enable verbose logging */
  verbose?: boolean;
  
  /** Connection timeout in milliseconds */
  timeout?: number;
  
  /** Whether to create the database if it doesn't exist */
  create?: boolean;
}

/**
 * Database connection manager for the memory system
 */
export class DatabaseConnection {
  private db: sqlite3.Database | null = null;
  private config: DatabaseConfig;
  private isInitialized: boolean = false;

  constructor(config: DatabaseConfig) {
    this.config = {
      verbose: false,
      timeout: 30000,
      create: true,
      ...config
    };
  }

  /**
   * Initialize the database connection and schema
   */
  public async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.connect();
      await this.initializeSchema();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize database: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Connect to the SQLite database
   */
  private async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      const mode = this.config.create 
        ? sqlite3.OPEN_READWRITE | sqlite3.OPEN_CREATE
        : sqlite3.OPEN_READWRITE;

      this.db = new sqlite3.Database(
        this.config.filename,
        mode,
        (err) => {
          if (err) {
            reject(new Error(`Failed to connect to database: ${err.message}`));
          } else {
            if (this.config.verbose) {
              console.log(`Connected to SQLite database: ${this.config.filename}`);
            }
            resolve();
          }
        }
      );

      // Set timeout
      if (this.config.timeout) {
        this.db?.configure('busyTimeout', this.config.timeout);
      }

      // Enable foreign key constraints
      this.db?.run('PRAGMA foreign_keys = ON');
    });
  }

  /**
   * Initialize database schema from SQL file
   */
  private async initializeSchema(): Promise<void> {
    if (!this.db) {
      throw new Error('Database not connected');
    }

    try {
      // Check if schema is already initialized
      const isInitialized = await this.checkSchemaInitialized();
      if (isInitialized) {
        if (this.config.verbose) {
          console.log('Database schema already initialized');
        }
        return;
      }

      // Read and execute schema SQL
      const schemaPath = join(__dirname, 'schema.sql');
      const schemaSql = readFileSync(schemaPath, 'utf8');
      
      await this.executeScript(schemaSql);
      
      if (this.config.verbose) {
        console.log('Database schema initialized successfully');
      }
    } catch (error) {
      throw new Error(`Failed to initialize schema: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Check if the database schema is already initialized
   */
  private async checkSchemaInitialized(): Promise<boolean> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.get(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='memories'",
        (err, row) => {
          if (err) {
            reject(err);
          } else {
            resolve(!!row);
          }
        }
      );
    });
  }

  /**
   * Execute a SQL script (multiple statements)
   */
  private async executeScript(sql: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.exec(sql, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Get the database instance
   */
  public getDatabase(): sqlite3.Database {
    if (!this.db || !this.isInitialized) {
      throw new Error('Database not initialized. Call initialize() first.');
    }
    return this.db;
  }

  /**
   * Execute a SQL query and return results
   */
  public async query<T = unknown>(sql: string, params: unknown[] = []): Promise<T[]> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(err);
        } else {
          resolve(rows as T[]);
        }
      });
    });
  }

  /**
   * Execute a SQL query and return the first result
   */
  public async queryOne<T = unknown>(sql: string, params: unknown[] = []): Promise<T | null> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.get(sql, params, (err, row) => {
        if (err) {
          reject(err);
        } else {
          resolve((row as T) || null);
        }
      });
    });
  }

  /**
   * Execute a SQL statement (INSERT, UPDATE, DELETE)
   */
  public async execute(sql: string, params: unknown[] = []): Promise<{ lastID: number; changes: number }> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not connected'));
        return;
      }

      this.db.run(sql, params, function(err) {
        if (err) {
          reject(err);
        } else {
          resolve({
            lastID: this.lastID,
            changes: this.changes
          });
        }
      });
    });
  }

  /**
   * Begin a database transaction
   */
  public async beginTransaction(): Promise<void> {
    await this.execute('BEGIN TRANSACTION');
  }

  /**
   * Commit a database transaction
   */
  public async commitTransaction(): Promise<void> {
    await this.execute('COMMIT');
  }

  /**
   * Rollback a database transaction
   */
  public async rollbackTransaction(): Promise<void> {
    await this.execute('ROLLBACK');
  }

  /**
   * Execute a function within a database transaction
   */
  public async withTransaction<T>(fn: () => Promise<T>): Promise<T> {
    await this.beginTransaction();
    try {
      const result = await fn();
      await this.commitTransaction();
      return result;
    } catch (error) {
      await this.rollbackTransaction();
      throw error;
    }
  }

  /**
   * Close the database connection
   */
  public async close(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          reject(err);
        } else {
          this.db = null;
          this.isInitialized = false;
          if (this.config.verbose) {
            console.log('Database connection closed');
          }
          resolve();
        }
      });
    });
  }

  /**
   * Get the database filename
   */
  public getFilename(): string {
    return this.config.filename;
  }

  /**
   * Check if the database connection is healthy
   */
  public async healthCheck(): Promise<boolean> {
    try {
      await this.queryOne('SELECT 1 as health');
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Get database statistics
   */
  public async getStats(): Promise<DatabaseStats> {
    const [
      memoryCount,
      auditCount,
      schemaVersion
    ] = await Promise.all([
      this.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM memories'),
      this.queryOne<{ count: number }>('SELECT COUNT(*) as count FROM audit_trail'),
      this.queryOne<{ version: number }>('SELECT MAX(version) as version FROM schema_version')
    ]);

    return {
      memoryCount: memoryCount?.count || 0,
      auditTrailCount: auditCount?.count || 0,
      schemaVersion: schemaVersion?.version || 0,
      filename: this.config.filename,
      isConnected: !!this.db,
      isInitialized: this.isInitialized
    };
  }
}

/**
 * Database statistics interface
 */
export interface DatabaseStats {
  memoryCount: number;
  auditTrailCount: number;
  schemaVersion: number;
  filename: string;
  isConnected: boolean;
  isInitialized: boolean;
}

/**
 * Create a default database connection for the memory system
 */
export function createDefaultConnection(filename: string = 'memory_system.db'): DatabaseConnection {
  return new DatabaseConnection({
    filename,
    verbose: process.env['NODE_ENV'] === 'development',
    create: true
  });
}