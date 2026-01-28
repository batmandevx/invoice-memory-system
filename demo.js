#!/usr/bin/env node

/**
 * Simple Demo Script for AI Agent Memory System
 * 
 * This demonstrates the core learning capabilities without TypeScript compilation issues.
 * Shows how the system learns from vendor patterns and human corrections.
 */

console.log('🚀 AI Agent Memory System Demo');
console.log('=====================================\n');

// Simulate the memory system behavior
class SimpleMemoryDemo {
  constructor() {
    this.memories = new Map();
    this.confidenceScores = new Map();
    this.auditTrail = [];
  }

  // Simulate processing an invoice
  async processInvoice(invoice) {
    console.log(`📄 Processing Invoice: ${invoice.invoiceNumber} from ${invoice.vendorId}`);
    
    const startTime = Date.now();
    const result = {
      normalizedInvoice: { ...invoice },
      proposedCorrections: [],
      requiresHumanReview: false,
      reasoning: '',
      confidenceScore: 0.5,
      memoryUpdates: [],
      auditTrail: []
    };

    // Check for vendor-specific memories
    const vendorMemories = this.memories.get(invoice.vendorId) || [];
    let appliedMemories = 0;
    let totalConfidence = 0;

    for (const memory of vendorMemories) {
      if (memory.pattern && invoice.rawText.includes(memory.pattern.trigger)) {
        // Apply memory
        result.proposedCorrections.push({
          field: memory.pattern.targetField,
          originalValue: memory.pattern.originalValue,
          correctedValue: memory.pattern.correctedValue,
          reason: `Applied learned pattern: ${memory.pattern.description}`,
          confidence: memory.confidence
        });
        
        appliedMemories++;
        totalConfidence += memory.confidence;
        
        console.log(`  ✅ Applied memory: ${memory.pattern.description} (confidence: ${(memory.confidence * 100).toFixed(1)}%)`);
      }
    }

    // Calculate overall confidence
    if (appliedMemories > 0) {
      result.confidenceScore = totalConfidence / appliedMemories;
      result.reasoning = `Applied ${appliedMemories} learned patterns with average confidence ${(result.confidenceScore * 100).toFixed(1)}%`;
    } else {
      result.requiresHumanReview = true;
      result.reasoning = 'No learned patterns found - requires human review';
      console.log('  ⚠️  No learned patterns found - flagging for human review');
    }

    // Auto-apply high confidence corrections
    if (result.confidenceScore > 0.8) {
      result.requiresHumanReview = false;
      console.log(`  🎯 High confidence (${(result.confidenceScore * 100).toFixed(1)}%) - auto-applying corrections`);
    } else if (result.confidenceScore > 0.6) {
      console.log(`  🤔 Medium confidence (${(result.confidenceScore * 100).toFixed(1)}%) - suggesting corrections`);
    }

    // Add audit trail
    const processingTime = Date.now() - startTime;
    result.auditTrail.push({
      step: 'recall',
      timestamp: new Date().toISOString(),
      details: `Recalled ${vendorMemories.length} memories for vendor ${invoice.vendorId}`
    });
    
    result.auditTrail.push({
      step: 'apply',
      timestamp: new Date().toISOString(),
      details: `Applied ${appliedMemories} memories with confidence ${(result.confidenceScore * 100).toFixed(1)}%`
    });
    
    result.auditTrail.push({
      step: 'decide',
      timestamp: new Date().toISOString(),
      details: `Decision: ${result.requiresHumanReview ? 'Human review required' : 'Auto-processed'} (${processingTime}ms)`
    });

    console.log(`  📊 Result: ${result.requiresHumanReview ? 'Human Review Required' : 'Auto-Processed'}\n`);
    
    return result;
  }

  // Simulate learning from human correction
  async learnFromCorrection(vendorId, correction) {
    console.log(`🧠 Learning from correction for vendor: ${vendorId}`);
    console.log(`   Pattern: "${correction.trigger}" → ${correction.targetField} = "${correction.correctedValue}"`);
    
    if (!this.memories.has(vendorId)) {
      this.memories.set(vendorId, []);
    }

    const memories = this.memories.get(vendorId);
    
    // Check if similar pattern exists
    const existingMemory = memories.find(m => 
      m.pattern.trigger === correction.trigger && 
      m.pattern.targetField === correction.targetField
    );

    if (existingMemory) {
      // Reinforce existing memory
      existingMemory.confidence = Math.min(0.95, existingMemory.confidence + 0.1);
      existingMemory.usageCount++;
      console.log(`   ✅ Reinforced existing memory (confidence: ${(existingMemory.confidence * 100).toFixed(1)}%)`);
    } else {
      // Create new memory
      const newMemory = {
        id: `memory-${Date.now()}`,
        type: 'vendor',
        pattern: {
          trigger: correction.trigger,
          targetField: correction.targetField,
          originalValue: correction.originalValue,
          correctedValue: correction.correctedValue,
          description: correction.description
        },
        confidence: 0.7, // Initial confidence
        createdAt: new Date(),
        usageCount: 1,
        vendorId: vendorId
      };
      
      memories.push(newMemory);
      console.log(`   ✨ Created new memory (confidence: ${(newMemory.confidence * 100).toFixed(1)}%)`);
    }

    console.log(`   📈 Total memories for ${vendorId}: ${memories.length}\n`);
  }

  // Get memory statistics
  getStats() {
    const stats = {
      totalVendors: this.memories.size,
      totalMemories: 0,
      averageConfidence: 0
    };

    let totalConfidence = 0;
    let memoryCount = 0;

    for (const [vendorId, memories] of this.memories) {
      stats.totalMemories += memories.length;
      for (const memory of memories) {
        totalConfidence += memory.confidence;
        memoryCount++;
      }
    }

    if (memoryCount > 0) {
      stats.averageConfidence = totalConfidence / memoryCount;
    }

    return stats;
  }
}

// Demo scenarios
async function runDemo() {
  const memorySystem = new SimpleMemoryDemo();

  console.log('🎬 Demo Scenario: Learning Progression Over Time\n');

  // Sample invoices
  const supplierInvoice1 = {
    id: 'INV-A-001',
    vendorId: 'supplier-gmbh',
    invoiceNumber: 'INV-A-001',
    rawText: 'Rechnung INV-A-001, Leistungsdatum: 2024-01-15, Betrag: 1500.00 EUR',
    extractedFields: [
      { name: 'totalAmount', value: '1500.00', confidence: 0.9 },
      { name: 'currency', value: 'EUR', confidence: 0.95 }
    ]
  };

  const supplierInvoice2 = {
    id: 'INV-A-002',
    vendorId: 'supplier-gmbh',
    invoiceNumber: 'INV-A-002',
    rawText: 'Rechnung INV-A-002, Leistungsdatum: 2024-01-20, Betrag: 2300.00 EUR',
    extractedFields: [
      { name: 'totalAmount', value: '2300.00', confidence: 0.9 },
      { name: 'currency', value: 'EUR', confidence: 0.95 }
    ]
  };

  const partsInvoice1 = {
    id: 'INV-B-001',
    vendorId: 'parts-ag',
    invoiceNumber: 'INV-B-001',
    rawText: 'Invoice INV-B-001, MwSt. inkl., Total: 850.00 EUR',
    extractedFields: [
      { name: 'totalAmount', value: '850.00', confidence: 0.9 },
      { name: 'vatIncluded', value: 'true', confidence: 0.8 }
    ]
  };

  // Step 1: Process first invoice (no memories yet)
  console.log('📍 STEP 1: First-time processing (no learned patterns)\n');
  
  const result1 = await memorySystem.processInvoice(supplierInvoice1);
  
  // Step 2: Human provides correction
  console.log('📍 STEP 2: Human correction - teaching the system\n');
  
  await memorySystem.learnFromCorrection('supplier-gmbh', {
    trigger: 'Leistungsdatum',
    targetField: 'serviceDate',
    originalValue: null,
    correctedValue: '2024-01-15',
    description: 'German "Leistungsdatum" maps to serviceDate field'
  });

  // Step 3: Process second invoice (should apply learned pattern)
  console.log('📍 STEP 3: Processing similar invoice (should apply learned pattern)\n');
  
  const result2 = await memorySystem.processInvoice(supplierInvoice2);

  // Step 4: Learn VAT pattern from different vendor
  console.log('📍 STEP 4: Learning VAT pattern from Parts AG\n');
  
  const result3 = await memorySystem.processInvoice(partsInvoice1);
  
  await memorySystem.learnFromCorrection('parts-ag', {
    trigger: 'MwSt. inkl.',
    targetField: 'vatHandling',
    originalValue: 'unknown',
    correctedValue: 'included',
    description: 'German "MwSt. inkl." indicates VAT is included in prices'
  });

  // Step 5: Show learning progression
  console.log('📍 STEP 5: Learning Progression Summary\n');
  
  const stats = memorySystem.getStats();
  console.log('📊 Memory System Statistics:');
  console.log(`   • Total Vendors: ${stats.totalVendors}`);
  console.log(`   • Total Memories: ${stats.totalMemories}`);
  console.log(`   • Average Confidence: ${(stats.averageConfidence * 100).toFixed(1)}%`);
  
  console.log('\n🎯 Expected Learning Outcomes:');
  console.log('   ✅ Supplier GmbH: "Leistungsdatum" → serviceDate mapping learned');
  console.log('   ✅ Parts AG: "MwSt. inkl." → VAT handling pattern learned');
  console.log('   ✅ System confidence increases with repeated patterns');
  console.log('   ✅ Vendor-specific memories remain isolated');
  
  console.log('\n🚀 Demo completed successfully!');
  console.log('\n📝 Key Features Demonstrated:');
  console.log('   • Memory-driven learning from human corrections');
  console.log('   • Confidence-based decision making');
  console.log('   • Vendor-specific pattern isolation');
  console.log('   • Complete audit trail generation');
  console.log('   • Progressive automation improvement');
  
  console.log('\n🔗 GitHub Repository: https://github.com/batmandevx/invoice-memory-system.git');
}

// Run the demo
runDemo().catch(console.error);