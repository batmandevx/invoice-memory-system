-- AI Agent Memory System Database Schema
-- SQLite schema for persistent memory storage

-- Enable foreign key constraints
PRAGMA foreign_keys = ON;

-- ============================================================================
-- Core Memory Tables
-- ============================================================================

-- Base memory table storing common memory attributes
CREATE TABLE memories (
    id TEXT PRIMARY KEY,
    type TEXT NOT NULL CHECK (type IN ('vendor', 'correction', 'resolution')),
    confidence REAL NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_used DATETIME,
    usage_count INTEGER NOT NULL DEFAULT 0,
    success_rate REAL NOT NULL DEFAULT 0.0 CHECK (success_rate >= 0.0 AND success_rate <= 1.0),
    pattern_type TEXT NOT NULL,
    pattern_data TEXT NOT NULL, -- JSON serialized pattern data
    context_data TEXT NOT NULL, -- JSON serialized context data
    archived BOOLEAN NOT NULL DEFAULT FALSE,
    created_by TEXT, -- System or user identifier
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient memory retrieval
CREATE INDEX idx_memories_type ON memories(type);
CREATE INDEX idx_memories_confidence ON memories(confidence);
CREATE INDEX idx_memories_last_used ON memories(last_used);
CREATE INDEX idx_memories_archived ON memories(archived);

-- ============================================================================
-- Vendor-Specific Memory Tables
-- ============================================================================

-- Vendor memories storing vendor-specific patterns and behaviors
CREATE TABLE vendor_memories (
    memory_id TEXT PRIMARY KEY,
    vendor_id TEXT NOT NULL,
    field_mappings TEXT, -- JSON array of field mappings
    vat_behavior TEXT, -- JSON object describing VAT behavior
    currency_patterns TEXT, -- JSON array of currency patterns
    date_formats TEXT, -- JSON array of date formats
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Index for vendor-specific queries
CREATE INDEX idx_vendor_memories_vendor_id ON vendor_memories(vendor_id);

-- ============================================================================
-- Correction Memory Tables
-- ============================================================================

-- Correction memories learned from human feedback
CREATE TABLE correction_memories (
    memory_id TEXT PRIMARY KEY,
    correction_type TEXT NOT NULL,
    trigger_conditions TEXT NOT NULL, -- JSON array of conditions
    correction_action TEXT NOT NULL, -- JSON object describing action
    validation_rules TEXT, -- JSON array of validation rules
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Index for correction type queries
CREATE INDEX idx_correction_memories_type ON correction_memories(correction_type);

-- ============================================================================
-- Resolution Memory Tables
-- ============================================================================

-- Resolution memories tracking how discrepancies were resolved
CREATE TABLE resolution_memories (
    memory_id TEXT PRIMARY KEY,
    discrepancy_type TEXT NOT NULL,
    resolution_outcome TEXT NOT NULL, -- JSON object describing outcome
    human_decision TEXT NOT NULL, -- JSON object describing human decision
    context_factors TEXT, -- JSON array of context factors
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Index for discrepancy type queries
CREATE INDEX idx_resolution_memories_discrepancy ON resolution_memories(discrepancy_type);

-- ============================================================================
-- Confidence Evolution Tracking
-- ============================================================================

-- Track confidence score changes over time for analysis
CREATE TABLE confidence_evolution (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id TEXT NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    previous_confidence REAL NOT NULL,
    new_confidence REAL NOT NULL,
    trigger_type TEXT NOT NULL CHECK (trigger_type IN ('success', 'failure', 'validation', 'decay', 'reinforcement')),
    reasoning TEXT,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Index for confidence evolution queries
CREATE INDEX idx_confidence_evolution_memory_id ON confidence_evolution(memory_id);
CREATE INDEX idx_confidence_evolution_timestamp ON confidence_evolution(timestamp);

-- ============================================================================
-- Audit Trail Tables
-- ============================================================================

-- Complete audit trail of all memory system operations
CREATE TABLE audit_trail (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id TEXT NOT NULL,
    operation_type TEXT NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    memory_id TEXT, -- NULL for operations not involving specific memories
    operation_data TEXT NOT NULL, -- JSON object with operation details
    reasoning TEXT,
    confidence_score REAL,
    user_id TEXT, -- NULL for system operations
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE SET NULL
);

-- Indexes for audit trail queries
CREATE INDEX idx_audit_trail_invoice_id ON audit_trail(invoice_id);
CREATE INDEX idx_audit_trail_timestamp ON audit_trail(timestamp);
CREATE INDEX idx_audit_trail_operation_type ON audit_trail(operation_type);
CREATE INDEX idx_audit_trail_memory_id ON audit_trail(memory_id);

-- ============================================================================
-- Memory Performance Tracking
-- ============================================================================

-- Track memory performance metrics for analysis and optimization
CREATE TABLE memory_performance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    memory_id TEXT NOT NULL,
    evaluation_date DATE NOT NULL,
    applications_count INTEGER NOT NULL DEFAULT 0,
    successes_count INTEGER NOT NULL DEFAULT 0,
    failures_count INTEGER NOT NULL DEFAULT 0,
    average_confidence REAL,
    performance_score REAL, -- Calculated performance metric
    notes TEXT,
    FOREIGN KEY (memory_id) REFERENCES memories(id) ON DELETE CASCADE
);

-- Index for performance tracking
CREATE INDEX idx_memory_performance_memory_id ON memory_performance(memory_id);
CREATE INDEX idx_memory_performance_date ON memory_performance(evaluation_date);

-- ============================================================================
-- Invoice Processing History
-- ============================================================================

-- Track processed invoices for learning and analysis
CREATE TABLE processed_invoices (
    id TEXT PRIMARY KEY,
    vendor_id TEXT NOT NULL,
    invoice_number TEXT NOT NULL,
    invoice_date DATE,
    processing_timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    confidence_score REAL NOT NULL,
    required_human_review BOOLEAN NOT NULL,
    memories_applied TEXT, -- JSON array of memory IDs applied
    corrections_made TEXT, -- JSON array of corrections
    processing_time_ms INTEGER,
    outcome TEXT, -- 'success', 'escalated', 'failed'
    human_feedback TEXT -- JSON object with human feedback if available
);

-- Indexes for invoice processing queries
CREATE INDEX idx_processed_invoices_vendor_id ON processed_invoices(vendor_id);
CREATE INDEX idx_processed_invoices_processing_timestamp ON processed_invoices(processing_timestamp);
CREATE INDEX idx_processed_invoices_outcome ON processed_invoices(outcome);

-- Unique constraint to prevent duplicate invoice processing
CREATE UNIQUE INDEX idx_processed_invoices_unique ON processed_invoices(vendor_id, invoice_number, invoice_date);

-- ============================================================================
-- System Configuration
-- ============================================================================

-- Store system configuration and thresholds
CREATE TABLE system_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    data_type TEXT NOT NULL CHECK (data_type IN ('string', 'number', 'boolean', 'json')),
    description TEXT,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_by TEXT
);

-- Insert default configuration values
INSERT INTO system_config (key, value, data_type, description) VALUES
    ('escalation_threshold', '0.7', 'number', 'Confidence threshold below which human review is required'),
    ('memory_decay_rate', '0.01', 'number', 'Rate at which unused memories decay per day'),
    ('minimum_confidence', '0.1', 'number', 'Minimum confidence below which memories are archived'),
    ('reinforcement_factor', '0.1', 'number', 'Factor by which successful memories are reinforced'),
    ('failure_penalty', '0.2', 'number', 'Penalty applied to confidence when memory fails'),
    ('max_memory_age_days', '365', 'number', 'Maximum age in days before memories are considered for archival');

-- ============================================================================
-- Database Triggers for Maintenance
-- ============================================================================

-- Trigger to update the updated_at timestamp on memory changes
CREATE TRIGGER update_memories_timestamp 
    AFTER UPDATE ON memories
    FOR EACH ROW
BEGIN
    UPDATE memories SET updated_at = CURRENT_TIMESTAMP WHERE id = NEW.id;
END;

-- Trigger to automatically archive very old, unused memories
CREATE TRIGGER archive_old_memories
    AFTER UPDATE ON memories
    FOR EACH ROW
    WHEN NEW.confidence < 0.1 AND 
         (julianday('now') - julianday(NEW.last_used)) > 365
BEGIN
    UPDATE memories SET archived = TRUE WHERE id = NEW.id;
END;

-- ============================================================================
-- Views for Common Queries
-- ============================================================================

-- View for active (non-archived) memories with performance metrics
CREATE VIEW active_memories AS
SELECT 
    m.*,
    COALESCE(vm.vendor_id, '') as vendor_id,
    COALESCE(cm.correction_type, '') as correction_type,
    COALESCE(rm.discrepancy_type, '') as discrepancy_type
FROM memories m
LEFT JOIN vendor_memories vm ON m.id = vm.memory_id
LEFT JOIN correction_memories cm ON m.id = cm.memory_id
LEFT JOIN resolution_memories rm ON m.id = rm.memory_id
WHERE m.archived = FALSE;

-- View for memory performance summary
CREATE VIEW memory_performance_summary AS
SELECT 
    m.id,
    m.type,
    m.confidence,
    m.usage_count,
    m.success_rate,
    COUNT(ce.id) as confidence_changes,
    AVG(CASE WHEN ce.trigger_type = 'success' THEN 1.0 ELSE 0.0 END) as success_ratio
FROM memories m
LEFT JOIN confidence_evolution ce ON m.id = ce.memory_id
WHERE m.archived = FALSE
GROUP BY m.id, m.type, m.confidence, m.usage_count, m.success_rate;

-- ============================================================================
-- Database Version and Metadata
-- ============================================================================

-- Store database schema version for migration management
CREATE TABLE schema_version (
    version INTEGER PRIMARY KEY,
    applied_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    description TEXT
);

INSERT INTO schema_version (version, description) VALUES 
    (1, 'Initial AI Agent Memory System schema');