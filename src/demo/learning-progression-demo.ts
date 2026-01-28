/**
 * Learning Progression Demonstration
 * 
 * This module creates a comprehensive demonstration showing how the memory system
 * improves over time, with metrics tracking and visualization of learning progression.
 */

import { 
  MemorySystem, 
  ProcessingResult, 
  ProcessingOutcome,
  ProcessingOutcomeType,
  HumanFeedback,
  FeedbackType,
  Correction
} from '../types';
import { 
  MetricsTracker, 
  LearningMetrics, 
  VendorMetrics,
  ProgressionSnapshot,
  createMetricsTracker,
  generateProgressionReport
} from './metrics-tracker';
import { 
  DemoRunner, 
  DemoResult,
  demoScenarios
} from './demo-runner';
import { getAllSampleInvoices } from './sample-data';

// ============================================================================
// Learning Progression Types
// ============================================================================

export interface ProgressionDemoConfig {
  /** Number of learning cycles to run */
  learningCycles: number;
  
  /** Interval between snapshots (in processed invoices) */
  snapshotInterval: number;
  
  /** Whether to include detailed logging */
  verboseLogging: boolean;
  
  /** Whether to simulate realistic processing delays */
  simulateProcessingTime: boolean;
}

export interface LearningCycle {
  cycleNumber: number;
  invoicesProcessed: number;
  learningEvents: LearningEvent[];
  metricsSnapshot: ProgressionSnapshot;
  improvements: ProgressionImprovement[];
}

export interface LearningEvent {
  timestamp: Date;
  eventType: 'correction' | 'reinforcement' | 'pattern_discovery' | 'confidence_boost';
  description: string;
  vendorId: string;
  impactScore: number; // 0.0-1.0
}

export interface ProgressionImprovement {
  metric: string;
  previousValue: number;
  currentValue: number;
  improvementPercentage: number;
  significance: 'minor' | 'moderate' | 'significant' | 'major';
}

export interface ProgressionVisualization {
  title: string;
  timeSeriesData: TimeSeriesPoint[];
  vendorComparison: VendorComparisonPoint[];
  learningMilestones: LearningMilestone[];
  summary: ProgressionSummary;
}

export interface TimeSeriesPoint {
  timestamp: Date;
  automationRate: number;
  averageConfidence: number;
  processingTime: number;
  memoryCount: number;
}

export interface VendorComparisonPoint {
  vendorId: string;
  vendorName: string;
  initialAutomationRate: number;
  finalAutomationRate: number;
  improvementRate: number;
  keyLearnings: string[];
}

export interface LearningMilestone {
  timestamp: Date;
  description: string;
  significance: 'minor' | 'major';
  metricsImpact: Record<string, number>;
}

export interface ProgressionSummary {
  totalInvoicesProcessed: number;
  totalLearningEvents: number;
  overallAutomationImprovement: number;
  overallConfidenceImprovement: number;
  topLearningOutcomes: string[];
  recommendedNextSteps: string[];
}

// ============================================================================
// Learning Progression Demo Implementation
// ============================================================================

export class LearningProgressionDemo {
  private metricsTracker: MetricsTracker;
  private learningCycles: LearningCycle[] = [];
  private learningEvents: LearningEvent[] = [];

  constructor(
    private memorySystem: MemorySystem,
    private config: ProgressionDemoConfig = {
      learningCycles: 5,
      snapshotInterval: 3,
      verboseLogging: true,
      simulateProcessingTime: false
    }
  ) {
    this.metricsTracker = createMetricsTracker();
  }

  /**
   * Run the complete learning progression demonstration
   */
  async runProgressionDemo(): Promise<ProgressionVisualization> {
    console.log('🚀 Starting Learning Progression Demonstration');
    console.log('=' .repeat(60));
    
    // Initialize baseline metrics
    await this.establishBaseline();
    
    // Run learning cycles
    for (let cycle = 1; cycle <= this.config.learningCycles; cycle++) {
      console.log(`\n📚 Learning Cycle ${cycle}/${this.config.learningCycles}`);
      await this.runLearningCycle(cycle);
      
      if (this.config.verboseLogging) {
        this.printCycleResults(cycle);
      }
    }
    
    // Generate final visualization
    const visualization = this.generateVisualization();
    
    console.log('\n✅ Learning Progression Demo Completed');
    this.printFinalSummary(visualization.summary);
    
    return visualization;
  }

  /**
   * Establish baseline metrics before learning
   */
  private async establishBaseline(): Promise<void> {
    console.log('📊 Establishing baseline metrics...');
    
    const sampleInvoices = getAllSampleInvoices().slice(0, 3); // Small sample for baseline
    
    for (const invoice of sampleInvoices) {
      const result = await this.memorySystem.processInvoice(invoice);
      this.metricsTracker.recordProcessingResult(result);
      
      if (this.config.simulateProcessingTime) {
        await this.delay(100); // Simulate processing time
      }
    }
    
    const baselineSnapshot = this.metricsTracker.takeSnapshot();
    console.log(`  Baseline automation rate: ${(baselineSnapshot.overallMetrics.automationRate * 100).toFixed(1)}%`);
    console.log(`  Baseline confidence: ${(baselineSnapshot.overallMetrics.averageConfidence * 100).toFixed(1)}%`);
  }

  /**
   * Run a single learning cycle
   */
  private async runLearningCycle(cycleNumber: number): Promise<void> {
    const cycleStart = Date.now();
    const invoices = getAllSampleInvoices();
    const cycleEvents: LearningEvent[] = [];
    let invoicesProcessed = 0;

    // Process invoices with learning
    for (const invoice of invoices) {
      const result = await this.memorySystem.processInvoice(invoice);
      this.metricsTracker.recordProcessingResult(result);
      invoicesProcessed++;

      // Simulate human feedback and learning
      if (result.requiresHumanReview && Math.random() > 0.3) { // 70% chance of human feedback
        const learningEvent = await this.simulateHumanLearning(result, invoice.vendorId);
        cycleEvents.push(learningEvent);
        this.learningEvents.push(learningEvent);
      }

      // Take snapshot at intervals
      if (invoicesProcessed % this.config.snapshotInterval === 0) {
        this.metricsTracker.takeSnapshot();
      }

      if (this.config.simulateProcessingTime) {
        await this.delay(50);
      }
    }

    // Calculate cycle improvements
    const currentSnapshot = this.metricsTracker.takeSnapshot();
    const previousSnapshot = this.metricsTracker.getLearningProgression().slice(-2)[0];
    const improvements = this.calculateImprovements(previousSnapshot, currentSnapshot);

    // Store cycle results
    const cycle: LearningCycle = {
      cycleNumber,
      invoicesProcessed,
      learningEvents: cycleEvents,
      metricsSnapshot: currentSnapshot,
      improvements
    };

    this.learningCycles.push(cycle);
  }

  /**
   * Simulate human learning feedback
   */
  private async simulateHumanLearning(
    result: ProcessingResult, 
    vendorId: string
  ): Promise<LearningEvent> {
    const corrections = this.generateRealisticCorrections(result, vendorId);
    
    const humanFeedback: HumanFeedback = {
      userId: 'demo-user',
      timestamp: new Date(),
      feedbackType: corrections.length > 0 ? FeedbackType.CORRECTION : FeedbackType.APPROVAL,
      corrections,
      satisfactionRating: Math.floor(Math.random() * 2) + 4, // 4-5 rating
      comments: this.generateFeedbackComment(vendorId, corrections)
    };

    const outcome: ProcessingOutcome = {
      result,
      humanFeedback,
      outcomeType: ProcessingOutcomeType.SUCCESS_HUMAN_REVIEW,
      performanceMetrics: {
        averageProcessingTime: 5000,
        successRate: 0.85,
        automationRate: 0.60,
        humanReviewRate: 0.40
      }
    };

    await this.memorySystem.learnFromOutcome(outcome);

    // Determine event type and impact
    let eventType: LearningEvent['eventType'] = 'reinforcement';
    let impactScore = 0.1;

    if (corrections.length > 0) {
      eventType = 'correction';
      impactScore = 0.3 + (corrections.length * 0.1);
    } else if (result.confidenceScore < 0.7) {
      eventType = 'confidence_boost';
      impactScore = 0.2;
    }

    return {
      timestamp: new Date(),
      eventType,
      description: this.generateEventDescription(eventType, vendorId, corrections),
      vendorId,
      impactScore: Math.min(impactScore, 1.0)
    };
  }

  /**
   * Generate realistic corrections based on vendor and processing result
   */
  private generateRealisticCorrections(
    result: ProcessingResult, 
    vendorId: string
  ): Correction[] {
    const corrections: Correction[] = [];

    // Vendor-specific correction patterns
    switch (vendorId) {
      case 'supplier-gmbh':
        if (!result.normalizedInvoice.serviceDate && Math.random() > 0.5) {
          corrections.push({
            field: 'serviceDate',
            originalValue: null,
            correctedValue: new Date(),
            reason: 'Map "Leistungsdatum" to serviceDate field',
            confidence: 0.9
          });
        }
        break;

      case 'parts-ag':
        if (Math.random() > 0.6) {
          corrections.push({
            field: 'vatIncluded',
            originalValue: false,
            correctedValue: true,
            reason: 'Recognize VAT inclusion indicators',
            confidence: 0.85
          });
        }
        break;

      case 'freight-co':
        if (Math.random() > 0.7) {
          corrections.push({
            field: 'lineItems[0].sku',
            originalValue: null,
            correctedValue: 'FREIGHT',
            reason: 'Map shipping service to standard SKU',
            confidence: 0.88
          });
        }
        break;
    }

    return corrections;
  }

  /**
   * Generate feedback comment based on vendor and corrections
   */
  private generateFeedbackComment(vendorId: string, corrections: Correction[]): string {
    if (corrections.length === 0) {
      return `Processing looks good for ${vendorId}`;
    }

    const vendorNames: Record<string, string> = {
      'supplier-gmbh': 'Supplier GmbH',
      'parts-ag': 'Parts AG',
      'freight-co': 'Freight & Co'
    };

    const vendorName = vendorNames[vendorId] || vendorId;
    return `Applied ${corrections.length} correction(s) for ${vendorName} invoice patterns`;
  }

  /**
   * Generate event description
   */
  private generateEventDescription(
    eventType: LearningEvent['eventType'],
    vendorId: string,
    corrections: Correction[]
  ): string {
    const vendorNames: Record<string, string> = {
      'supplier-gmbh': 'Supplier GmbH',
      'parts-ag': 'Parts AG',
      'freight-co': 'Freight & Co'
    };

    const vendorName = vendorNames[vendorId] || vendorId;

    switch (eventType) {
      case 'correction':
        return `Applied ${corrections.length} correction(s) for ${vendorName}: ${corrections.map(c => c.field).join(', ')}`;
      case 'reinforcement':
        return `Reinforced existing patterns for ${vendorName}`;
      case 'confidence_boost':
        return `Boosted confidence for ${vendorName} processing`;
      case 'pattern_discovery':
        return `Discovered new pattern for ${vendorName}`;
      default:
        return `Learning event for ${vendorName}`;
    }
  }

  /**
   * Calculate improvements between snapshots
   */
  private calculateImprovements(
    previous: ProgressionSnapshot | undefined,
    current: ProgressionSnapshot
  ): ProgressionImprovement[] {
    if (!previous) return [];

    const improvements: ProgressionImprovement[] = [];

    // Automation rate improvement
    const automationImprovement = current.overallMetrics.automationRate - previous.overallMetrics.automationRate;
    if (Math.abs(automationImprovement) > 0.01) {
      improvements.push({
        metric: 'Automation Rate',
        previousValue: previous.overallMetrics.automationRate,
        currentValue: current.overallMetrics.automationRate,
        improvementPercentage: (automationImprovement / previous.overallMetrics.automationRate) * 100,
        significance: this.determineSignificance(Math.abs(automationImprovement))
      });
    }

    // Confidence improvement
    const confidenceImprovement = current.overallMetrics.averageConfidence - previous.overallMetrics.averageConfidence;
    if (Math.abs(confidenceImprovement) > 0.01) {
      improvements.push({
        metric: 'Average Confidence',
        previousValue: previous.overallMetrics.averageConfidence,
        currentValue: current.overallMetrics.averageConfidence,
        improvementPercentage: (confidenceImprovement / previous.overallMetrics.averageConfidence) * 100,
        significance: this.determineSignificance(Math.abs(confidenceImprovement))
      });
    }

    // Processing time improvement
    const timeImprovement = previous.overallMetrics.processingTime - current.overallMetrics.processingTime;
    if (Math.abs(timeImprovement) > 100) { // 100ms threshold
      improvements.push({
        metric: 'Processing Time',
        previousValue: previous.overallMetrics.processingTime,
        currentValue: current.overallMetrics.processingTime,
        improvementPercentage: (timeImprovement / previous.overallMetrics.processingTime) * 100,
        significance: this.determineSignificance(Math.abs(timeImprovement) / 1000) // Convert to seconds for significance
      });
    }

    return improvements;
  }

  /**
   * Determine significance of improvement
   */
  private determineSignificance(absoluteChange: number): ProgressionImprovement['significance'] {
    if (absoluteChange < 0.05) return 'minor';
    if (absoluteChange < 0.15) return 'moderate';
    if (absoluteChange < 0.30) return 'significant';
    return 'major';
  }

  /**
   * Print cycle results
   */
  private printCycleResults(cycleNumber: number): void {
    const cycle = this.learningCycles[cycleNumber - 1];
    
    console.log(`\n  📈 Cycle ${cycleNumber} Results:`);
    console.log(`    Invoices Processed: ${cycle.invoicesProcessed}`);
    console.log(`    Learning Events: ${cycle.learningEvents.length}`);
    console.log(`    Automation Rate: ${(cycle.metricsSnapshot.overallMetrics.automationRate * 100).toFixed(1)}%`);
    console.log(`    Average Confidence: ${(cycle.metricsSnapshot.overallMetrics.averageConfidence * 100).toFixed(1)}%`);
    
    if (cycle.improvements.length > 0) {
      console.log(`    Key Improvements:`);
      cycle.improvements.forEach(imp => {
        const sign = imp.improvementPercentage > 0 ? '+' : '';
        console.log(`      ${imp.metric}: ${sign}${imp.improvementPercentage.toFixed(1)}% (${imp.significance})`);
      });
    }
  }

  /**
   * Generate comprehensive visualization
   */
  private generateVisualization(): ProgressionVisualization {
    const snapshots = this.metricsTracker.getLearningProgression();
    
    // Time series data
    const timeSeriesData: TimeSeriesPoint[] = snapshots.map(snapshot => ({
      timestamp: snapshot.timestamp,
      automationRate: snapshot.overallMetrics.automationRate,
      averageConfidence: snapshot.overallMetrics.averageConfidence,
      processingTime: snapshot.overallMetrics.processingTime,
      memoryCount: snapshot.memoryStats.totalMemories
    }));

    // Vendor comparison
    const vendorComparison: VendorComparisonPoint[] = this.generateVendorComparison(snapshots);

    // Learning milestones
    const learningMilestones: LearningMilestone[] = this.identifyLearningMilestones();

    // Summary
    const summary: ProgressionSummary = this.generateProgressionSummary(snapshots);

    return {
      title: 'AI Agent Memory System - Learning Progression',
      timeSeriesData,
      vendorComparison,
      learningMilestones,
      summary
    };
  }

  /**
   * Generate vendor comparison data
   */
  private generateVendorComparison(snapshots: ProgressionSnapshot[]): VendorComparisonPoint[] {
    if (snapshots.length < 2) return [];

    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];

    const vendorIds = ['supplier-gmbh', 'parts-ag', 'freight-co'];
    const vendorNames: Record<string, string> = {
      'supplier-gmbh': 'Supplier GmbH',
      'parts-ag': 'Parts AG',
      'freight-co': 'Freight & Co International'
    };

    return vendorIds.map(vendorId => {
      const initialVendor = firstSnapshot.vendorMetrics.find(v => v.vendorId === vendorId);
      const finalVendor = lastSnapshot.vendorMetrics.find(v => v.vendorId === vendorId);

      const initialRate = initialVendor?.automationRate || 0;
      const finalRate = finalVendor?.automationRate || 0;
      const improvementRate = finalRate - initialRate;

      return {
        vendorId,
        vendorName: vendorNames[vendorId],
        initialAutomationRate: initialRate,
        finalAutomationRate: finalRate,
        improvementRate,
        keyLearnings: finalVendor?.keyLearnings || []
      };
    });
  }

  /**
   * Identify learning milestones
   */
  private identifyLearningMilestones(): LearningMilestone[] {
    const milestones: LearningMilestone[] = [];

    // Major learning events
    const majorEvents = this.learningEvents.filter(event => event.impactScore > 0.5);
    
    majorEvents.forEach(event => {
      milestones.push({
        timestamp: event.timestamp,
        description: event.description,
        significance: 'major',
        metricsImpact: {
          confidence: event.impactScore * 0.1,
          automation: event.impactScore * 0.05
        }
      });
    });

    // Cycle completion milestones
    this.learningCycles.forEach(cycle => {
      const significantImprovements = cycle.improvements.filter(
        imp => imp.significance === 'significant' || imp.significance === 'major'
      );

      if (significantImprovements.length > 0) {
        milestones.push({
          timestamp: cycle.metricsSnapshot.timestamp,
          description: `Completed learning cycle ${cycle.cycleNumber} with ${significantImprovements.length} significant improvements`,
          significance: 'major',
          metricsImpact: significantImprovements.reduce((acc, imp) => {
            acc[imp.metric.toLowerCase().replace(' ', '_')] = imp.improvementPercentage / 100;
            return acc;
          }, {} as Record<string, number>)
        });
      }
    });

    return milestones.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
  }

  /**
   * Generate progression summary
   */
  private generateProgressionSummary(snapshots: ProgressionSnapshot[]): ProgressionSummary {
    if (snapshots.length === 0) {
      return {
        totalInvoicesProcessed: 0,
        totalLearningEvents: 0,
        overallAutomationImprovement: 0,
        overallConfidenceImprovement: 0,
        topLearningOutcomes: [],
        recommendedNextSteps: []
      };
    }

    const firstSnapshot = snapshots[0];
    const lastSnapshot = snapshots[snapshots.length - 1];

    const totalInvoicesProcessed = this.learningCycles.reduce((sum, cycle) => sum + cycle.invoicesProcessed, 0);
    const totalLearningEvents = this.learningEvents.length;

    const overallAutomationImprovement = lastSnapshot.overallMetrics.automationRate - firstSnapshot.overallMetrics.automationRate;
    const overallConfidenceImprovement = lastSnapshot.overallMetrics.averageConfidence - firstSnapshot.overallMetrics.averageConfidence;

    // Top learning outcomes
    const eventDescriptions = this.learningEvents.map(event => event.description);
    const topLearningOutcomes = [...new Set(eventDescriptions)].slice(0, 5);

    // Recommended next steps
    const recommendedNextSteps = this.generateRecommendations(lastSnapshot);

    return {
      totalInvoicesProcessed,
      totalLearningEvents,
      overallAutomationImprovement,
      overallConfidenceImprovement,
      topLearningOutcomes,
      recommendedNextSteps
    };
  }

  /**
   * Generate recommendations based on current state
   */
  private generateRecommendations(snapshot: ProgressionSnapshot): string[] {
    const recommendations: string[] = [];

    // Automation rate recommendations
    if (snapshot.overallMetrics.automationRate < 0.7) {
      recommendations.push('Focus on increasing automation rate through more targeted learning');
    }

    // Confidence recommendations
    if (snapshot.overallMetrics.averageConfidence < 0.8) {
      recommendations.push('Improve confidence scores by providing more consistent feedback');
    }

    // Vendor-specific recommendations
    snapshot.vendorMetrics.forEach(vendor => {
      if (vendor.automationRate < 0.6) {
        recommendations.push(`Increase learning focus on ${vendor.vendorName} patterns`);
      }
    });

    // Memory utilization recommendations
    if (snapshot.memoryStats.memoryUtilizationRate < 0.5) {
      recommendations.push('Optimize memory utilization by refining memory selection algorithms');
    }

    return recommendations.slice(0, 5); // Top 5 recommendations
  }

  /**
   * Print final summary
   */
  private printFinalSummary(summary: ProgressionSummary): void {
    console.log('\n📊 Final Learning Progression Summary:');
    console.log('─'.repeat(50));
    console.log(`Total Invoices Processed: ${summary.totalInvoicesProcessed}`);
    console.log(`Total Learning Events: ${summary.totalLearningEvents}`);
    console.log(`Automation Improvement: ${(summary.overallAutomationImprovement * 100).toFixed(1)}%`);
    console.log(`Confidence Improvement: ${(summary.overallConfidenceImprovement * 100).toFixed(1)}%`);
    
    console.log('\n🎯 Top Learning Outcomes:');
    summary.topLearningOutcomes.forEach((outcome, index) => {
      console.log(`  ${index + 1}. ${outcome}`);
    });
    
    console.log('\n💡 Recommended Next Steps:');
    summary.recommendedNextSteps.forEach((step, index) => {
      console.log(`  ${index + 1}. ${step}`);
    });
  }

  /**
   * Utility function for delays
   */
  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Export progression data
   */
  exportProgressionData(): {
    cycles: LearningCycle[];
    events: LearningEvent[];
    metrics: ProgressionSnapshot[];
    visualization: ProgressionVisualization;
  } {
    return {
      cycles: this.learningCycles,
      events: this.learningEvents,
      metrics: this.metricsTracker.getLearningProgression(),
      visualization: this.generateVisualization()
    };
  }
}

// ============================================================================
// Demo Script Functions
// ============================================================================

/**
 * Create and run a learning progression demonstration
 */
export async function runLearningProgressionDemo(
  memorySystem: MemorySystem,
  config?: Partial<ProgressionDemoConfig>
): Promise<ProgressionVisualization> {
  const demo = new LearningProgressionDemo(memorySystem, {
    learningCycles: 5,
    snapshotInterval: 3,
    verboseLogging: true,
    simulateProcessingTime: false,
    ...config
  });

  return await demo.runProgressionDemo();
}

/**
 * Generate a comprehensive learning progression report
 */
export function generateLearningProgressionReport(
  visualization: ProgressionVisualization
): string {
  let report = `# ${visualization.title}\n\n`;
  report += `**Generated:** ${new Date().toISOString()}\n\n`;

  // Executive Summary
  report += '## Executive Summary\n\n';
  report += `This report demonstrates the learning progression of the AI Agent Memory System over ${visualization.summary.totalInvoicesProcessed} processed invoices with ${visualization.summary.totalLearningEvents} learning events.\n\n`;
  
  report += `**Key Improvements:**\n`;
  report += `- Automation Rate: ${(visualization.summary.overallAutomationImprovement * 100).toFixed(1)}%\n`;
  report += `- Average Confidence: ${(visualization.summary.overallConfidenceImprovement * 100).toFixed(1)}%\n\n`;

  // Vendor Performance
  report += '## Vendor Performance Comparison\n\n';
  visualization.vendorComparison.forEach(vendor => {
    report += `### ${vendor.vendorName}\n`;
    report += `- Initial Automation: ${(vendor.initialAutomationRate * 100).toFixed(1)}%\n`;
    report += `- Final Automation: ${(vendor.finalAutomationRate * 100).toFixed(1)}%\n`;
    report += `- Improvement: ${(vendor.improvementRate * 100).toFixed(1)}%\n`;
    if (vendor.keyLearnings.length > 0) {
      report += `- Key Learning: ${vendor.keyLearnings[0]}\n`;
    }
    report += '\n';
  });

  // Learning Milestones
  report += '## Learning Milestones\n\n';
  visualization.learningMilestones.forEach((milestone, index) => {
    report += `${index + 1}. **${milestone.timestamp.toISOString().split('T')[0]}** - ${milestone.description}\n`;
  });
  report += '\n';

  // Recommendations
  report += '## Recommendations\n\n';
  visualization.summary.recommendedNextSteps.forEach((step, index) => {
    report += `${index + 1}. ${step}\n`;
  });

  return report;
}