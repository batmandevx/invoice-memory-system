/**
 * Metrics Tracking for Learning Progression
 * 
 * This module tracks and visualizes the learning progression of the memory system
 * over time, showing improvements in automation rates and confidence scores.
 */

import { ProcessingResult, ProcessingOutcome } from '../types';

// ============================================================================
// Metrics Types
// ============================================================================

export interface LearningMetrics {
  timestamp: Date;
  totalInvoices: number;
  automatedInvoices: number;
  humanReviewInvoices: number;
  averageConfidence: number;
  automationRate: number;
  humanReviewRate: number;
  processingTime: number;
  memoryUtilization: number;
}

export interface VendorMetrics {
  vendorId: string;
  vendorName: string;
  totalInvoices: number;
  automationRate: number;
  averageConfidence: number;
  learningVelocity: number; // Rate of improvement over time
  keyLearnings: string[];
}

export interface ProgressionSnapshot {
  timestamp: Date;
  overallMetrics: LearningMetrics;
  vendorMetrics: VendorMetrics[];
  memoryStats: MemoryStats;
  performanceTrends: PerformanceTrend[];
}

export interface MemoryStats {
  totalMemories: number;
  vendorMemories: number;
  correctionMemories: number;
  resolutionMemories: number;
  averageConfidence: number;
  memoryUtilizationRate: number;
}

export interface PerformanceTrend {
  metric: string;
  direction: 'increasing' | 'decreasing' | 'stable';
  changeRate: number; // Percentage change per time period
  significance: 'low' | 'medium' | 'high';
}

// ============================================================================
// Metrics Tracker Implementation
// ============================================================================

export class MetricsTracker {
  private snapshots: ProgressionSnapshot[] = [];
  private processingHistory: ProcessingResult[] = [];

  /**
   * Record a processing result for metrics tracking
   */
  recordProcessingResult(result: ProcessingResult): void {
    this.processingHistory.push(result);
    
    // Keep only recent history (last 1000 results)
    if (this.processingHistory.length > 1000) {
      this.processingHistory = this.processingHistory.slice(-1000);
    }
  }

  /**
   * Take a snapshot of current metrics
   */
  takeSnapshot(): ProgressionSnapshot {
    const timestamp = new Date();
    const overallMetrics = this.calculateOverallMetrics();
    const vendorMetrics = this.calculateVendorMetrics();
    const memoryStats = this.calculateMemoryStats();
    const performanceTrends = this.calculatePerformanceTrends();

    const snapshot: ProgressionSnapshot = {
      timestamp,
      overallMetrics,
      vendorMetrics,
      memoryStats,
      performanceTrends
    };

    this.snapshots.push(snapshot);
    
    // Keep only recent snapshots (last 100)
    if (this.snapshots.length > 100) {
      this.snapshots = this.snapshots.slice(-100);
    }

    return snapshot;
  }

  /**
   * Calculate overall learning metrics
   */
  private calculateOverallMetrics(): LearningMetrics {
    const recentResults = this.processingHistory.slice(-50); // Last 50 results
    
    if (recentResults.length === 0) {
      return {
        timestamp: new Date(),
        totalInvoices: 0,
        automatedInvoices: 0,
        humanReviewInvoices: 0,
        averageConfidence: 0,
        automationRate: 0,
        humanReviewRate: 0,
        processingTime: 0,
        memoryUtilization: 0
      };
    }

    const totalInvoices = recentResults.length;
    const automatedInvoices = recentResults.filter(r => !r.requiresHumanReview).length;
    const humanReviewInvoices = recentResults.filter(r => r.requiresHumanReview).length;
    const averageConfidence = recentResults.reduce((sum, r) => sum + r.confidenceScore, 0) / totalInvoices;
    const automationRate = automatedInvoices / totalInvoices;
    const humanReviewRate = humanReviewInvoices / totalInvoices;
    
    const processingTime = recentResults.reduce((sum, r) => {
      const processingStep = r.auditTrail.find(step => step.operation === 'MEMORY_APPLICATION');
      return sum + (processingStep?.duration || 0);
    }, 0) / totalInvoices;

    const memoryUtilization = recentResults.reduce((sum, r) => {
      return sum + r.memoryUpdates.length;
    }, 0) / totalInvoices;

    return {
      timestamp: new Date(),
      totalInvoices,
      automatedInvoices,
      humanReviewInvoices,
      averageConfidence,
      automationRate,
      humanReviewRate,
      processingTime,
      memoryUtilization
    };
  }

  /**
   * Calculate vendor-specific metrics
   */
  private calculateVendorMetrics(): VendorMetrics[] {
    const vendorGroups = this.groupResultsByVendor();
    const metrics: VendorMetrics[] = [];

    for (const [vendorId, results] of vendorGroups.entries()) {
      const totalInvoices = results.length;
      const automatedInvoices = results.filter(r => !r.requiresHumanReview).length;
      const automationRate = automatedInvoices / totalInvoices;
      const averageConfidence = results.reduce((sum, r) => sum + r.confidenceScore, 0) / totalInvoices;
      
      // Calculate learning velocity (improvement rate over time)
      const learningVelocity = this.calculateLearningVelocity(results);
      
      // Extract key learnings from memory updates
      const keyLearnings = this.extractKeyLearnings(results);

      metrics.push({
        vendorId,
        vendorName: this.getVendorName(vendorId),
        totalInvoices,
        automationRate,
        averageConfidence,
        learningVelocity,
        keyLearnings
      });
    }

    return metrics;
  }

  /**
   * Group processing results by vendor
   */
  private groupResultsByVendor(): Map<string, ProcessingResult[]> {
    const groups = new Map<string, ProcessingResult[]>();
    
    for (const result of this.processingHistory) {
      const vendorId = result.normalizedInvoice.vendorId;
      if (!groups.has(vendorId)) {
        groups.set(vendorId, []);
      }
      groups.get(vendorId)!.push(result);
    }
    
    return groups;
  }

  /**
   * Calculate learning velocity for a vendor
   */
  private calculateLearningVelocity(results: ProcessingResult[]): number {
    if (results.length < 2) return 0;

    // Sort by processing time (using audit trail timestamps)
    const sortedResults = results.sort((a, b) => {
      const aTime = a.auditTrail[0]?.timestamp || new Date(0);
      const bTime = b.auditTrail[0]?.timestamp || new Date(0);
      return aTime.getTime() - bTime.getTime();
    });

    // Calculate confidence improvement over time
    const firstHalf = sortedResults.slice(0, Math.floor(sortedResults.length / 2));
    const secondHalf = sortedResults.slice(Math.floor(sortedResults.length / 2));

    const firstHalfAvgConfidence = firstHalf.reduce((sum, r) => sum + r.confidenceScore, 0) / firstHalf.length;
    const secondHalfAvgConfidence = secondHalf.reduce((sum, r) => sum + r.confidenceScore, 0) / secondHalf.length;

    return secondHalfAvgConfidence - firstHalfAvgConfidence;
  }

  /**
   * Extract key learnings from memory updates
   */
  private extractKeyLearnings(results: ProcessingResult[]): string[] {
    const learnings = new Set<string>();
    
    for (const result of results) {
      for (const update of result.memoryUpdates) {
        if (update.reason) {
          learnings.add(update.reason);
        }
      }
    }
    
    return Array.from(learnings).slice(0, 5); // Top 5 learnings
  }

  /**
   * Get vendor name from ID
   */
  private getVendorName(vendorId: string): string {
    const vendorNames: Record<string, string> = {
      'supplier-gmbh': 'Supplier GmbH',
      'parts-ag': 'Parts AG',
      'freight-co': 'Freight & Co International'
    };
    return vendorNames[vendorId] || vendorId;
  }

  /**
   * Calculate memory statistics
   */
  private calculateMemoryStats(): MemoryStats {
    // This would typically query the memory repository
    // For demo purposes, we'll simulate based on processing history
    const recentResults = this.processingHistory.slice(-50);
    
    const totalMemoryUpdates = recentResults.reduce((sum, r) => sum + r.memoryUpdates.length, 0);
    const vendorMemoryUpdates = recentResults.reduce((sum, r) => 
      sum + r.memoryUpdates.filter(u => u.updateType.includes('vendor')).length, 0);
    const correctionMemoryUpdates = recentResults.reduce((sum, r) => 
      sum + r.memoryUpdates.filter(u => u.updateType.includes('correction')).length, 0);

    return {
      totalMemories: totalMemoryUpdates,
      vendorMemories: vendorMemoryUpdates,
      correctionMemories: correctionMemoryUpdates,
      resolutionMemories: totalMemoryUpdates - vendorMemoryUpdates - correctionMemoryUpdates,
      averageConfidence: 0.75, // Simulated
      memoryUtilizationRate: totalMemoryUpdates / Math.max(recentResults.length, 1)
    };
  }

  /**
   * Calculate performance trends
   */
  private calculatePerformanceTrends(): PerformanceTrend[] {
    if (this.snapshots.length < 2) {
      return [];
    }

    const trends: PerformanceTrend[] = [];
    const recent = this.snapshots.slice(-5); // Last 5 snapshots

    // Automation rate trend
    const automationRates = recent.map(s => s.overallMetrics.automationRate);
    trends.push(this.calculateTrend('Automation Rate', automationRates));

    // Confidence trend
    const confidenceScores = recent.map(s => s.overallMetrics.averageConfidence);
    trends.push(this.calculateTrend('Average Confidence', confidenceScores));

    // Processing time trend
    const processingTimes = recent.map(s => s.overallMetrics.processingTime);
    trends.push(this.calculateTrend('Processing Time', processingTimes));

    return trends;
  }

  /**
   * Calculate trend for a specific metric
   */
  private calculateTrend(metric: string, values: number[]): PerformanceTrend {
    if (values.length < 2) {
      return {
        metric,
        direction: 'stable',
        changeRate: 0,
        significance: 'low'
      };
    }

    const first = values[0];
    const last = values[values.length - 1];
    const changeRate = ((last - first) / first) * 100;

    let direction: 'increasing' | 'decreasing' | 'stable';
    if (Math.abs(changeRate) < 1) {
      direction = 'stable';
    } else if (changeRate > 0) {
      direction = 'increasing';
    } else {
      direction = 'decreasing';
    }

    let significance: 'low' | 'medium' | 'high';
    if (Math.abs(changeRate) < 5) {
      significance = 'low';
    } else if (Math.abs(changeRate) < 15) {
      significance = 'medium';
    } else {
      significance = 'high';
    }

    return {
      metric,
      direction,
      changeRate,
      significance
    };
  }

  /**
   * Get learning progression over time
   */
  getLearningProgression(): ProgressionSnapshot[] {
    return [...this.snapshots];
  }

  /**
   * Generate metrics visualization (text-based)
   */
  generateVisualization(): string {
    const latest = this.snapshots[this.snapshots.length - 1];
    if (!latest) {
      return 'No metrics data available';
    }

    let viz = '📊 Learning Progression Metrics\n';
    viz += '═'.repeat(40) + '\n\n';

    // Overall metrics
    viz += '🎯 Overall Performance:\n';
    viz += `  Automation Rate: ${(latest.overallMetrics.automationRate * 100).toFixed(1)}%\n`;
    viz += `  Average Confidence: ${(latest.overallMetrics.averageConfidence * 100).toFixed(1)}%\n`;
    viz += `  Processing Time: ${latest.overallMetrics.processingTime.toFixed(0)}ms\n`;
    viz += `  Memory Utilization: ${latest.overallMetrics.memoryUtilization.toFixed(1)}\n\n`;

    // Vendor performance
    viz += '🏢 Vendor Performance:\n';
    latest.vendorMetrics.forEach(vendor => {
      viz += `  ${vendor.vendorName}:\n`;
      viz += `    Automation: ${(vendor.automationRate * 100).toFixed(1)}%\n`;
      viz += `    Confidence: ${(vendor.averageConfidence * 100).toFixed(1)}%\n`;
      viz += `    Learning Velocity: ${(vendor.learningVelocity * 100).toFixed(1)}%\n`;
      if (vendor.keyLearnings.length > 0) {
        viz += `    Key Learning: ${vendor.keyLearnings[0]}\n`;
      }
      viz += '\n';
    });

    // Performance trends
    viz += '📈 Performance Trends:\n';
    latest.performanceTrends.forEach(trend => {
      const arrow = trend.direction === 'increasing' ? '↗️' : 
                   trend.direction === 'decreasing' ? '↘️' : '→';
      viz += `  ${arrow} ${trend.metric}: ${trend.changeRate.toFixed(1)}% (${trend.significance})\n`;
    });

    return viz;
  }

  /**
   * Export metrics data for external analysis
   */
  exportMetrics(): {
    snapshots: ProgressionSnapshot[];
    summary: {
      totalSnapshots: number;
      timeRange: { start: Date; end: Date };
      overallImprovement: {
        automationRate: number;
        averageConfidence: number;
      };
    };
  } {
    const snapshots = this.getLearningProgression();
    
    if (snapshots.length === 0) {
      return {
        snapshots: [],
        summary: {
          totalSnapshots: 0,
          timeRange: { start: new Date(), end: new Date() },
          overallImprovement: { automationRate: 0, averageConfidence: 0 }
        }
      };
    }

    const first = snapshots[0];
    const last = snapshots[snapshots.length - 1];

    return {
      snapshots,
      summary: {
        totalSnapshots: snapshots.length,
        timeRange: {
          start: first.timestamp,
          end: last.timestamp
        },
        overallImprovement: {
          automationRate: last.overallMetrics.automationRate - first.overallMetrics.automationRate,
          averageConfidence: last.overallMetrics.averageConfidence - first.overallMetrics.averageConfidence
        }
      }
    };
  }
}

// ============================================================================
// Utility Functions
// ============================================================================

/**
 * Create a metrics tracker instance
 */
export function createMetricsTracker(): MetricsTracker {
  return new MetricsTracker();
}

/**
 * Generate a learning progression report
 */
export function generateProgressionReport(tracker: MetricsTracker): string {
  const data = tracker.exportMetrics();
  
  let report = '# Learning Progression Report\n\n';
  report += `**Generated:** ${new Date().toISOString()}\n`;
  report += `**Time Range:** ${data.summary.timeRange.start.toISOString()} to ${data.summary.timeRange.end.toISOString()}\n`;
  report += `**Total Snapshots:** ${data.summary.totalSnapshots}\n\n`;

  if (data.summary.totalSnapshots > 0) {
    report += '## Overall Improvement\n\n';
    report += `- **Automation Rate:** ${(data.summary.overallImprovement.automationRate * 100).toFixed(1)}%\n`;
    report += `- **Average Confidence:** ${(data.summary.overallImprovement.averageConfidence * 100).toFixed(1)}%\n\n`;

    report += '## Current Metrics\n\n';
    report += tracker.generateVisualization();
  } else {
    report += 'No metrics data available.\n';
  }

  return report;
}