<img width="1481" height="1370" alt="image" src="https://github.com/user-attachments/assets/a12a0028-2f5d-4aed-b305-02cbcc9bc0b9" />
<img width="1345" height="1180" alt="image" src="https://github.com/user-attachments/assets/ede44c26-7f29-48fe-90ff-aa4e8d86bb21" />



# AI Agent Memory System for Invoice Processing

A TypeScript-based memory-driven learning layer that enhances invoice processing automation by storing and applying insights from past processing experiences. The system learns from vendor patterns, human corrections, and resolution outcomes to progressively reduce manual review requirements while maintaining explainability and auditability.

## 🎯 Problem Statement

Companies process hundreds of invoices daily with many corrections repeating (vendor-specific labels, recurring tax issues, quantity mismatches). Currently, these corrections are wasted—the system does not learn. This memory layer stores reusable insights from past invoices and applies them to future invoices to improve automation rates.

## 🏗️ Architecture & Design

### Core Memory Types
1. **Vendor Memory**: Patterns tied to specific vendors (e.g., "Leistungsdatum" = service date, VAT behavior)
2. **Correction Memory**: Learning from repeated corrections (e.g., "Qty mismatch → adjust to DN qty")
3. **Resolution Memory**: Track how discrepancies were resolved (Human rejected vs. Human approved)

### Decision Logic
- Uses memory confidence scores before making final decisions
- Avoids auto-applying low-confidence memory
- Provides reasoning for every suggested correction or escalation
- Tracks confidence evolution over time (reinforcement + decay)
- Prevents bad learnings from dominating decisions

### Memory Processing Flow
```
Raw Invoice → Memory Recall → Memory Application → Decision Logic → Memory Learning
     ↓              ↓               ↓               ↓              ↓
  Extract      Find Relevant    Apply High      Auto-accept/    Store New
  Context      Past Learnings   Confidence      Escalate/       Insights &
                               Memories        Auto-correct    Update Confidence
```

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
git clone https://github.com/batmandevx/invoice-memory-system.git
cd invoice-memory-system
npm install
```

### Build & Test
```bash
# Build the project
npm run build

# Run all tests
npm test

# Run property-based tests specifically
npm run test:property

# Run demo
npm run demo
```

## 📋 Output Contract

For each invoice, the system outputs this JSON structure:
```json
{
  "normalizedInvoice": { "...": "..." },
  "proposedCorrections": [ "..." ],
  "requiresHumanReview": true,
  "reasoning": "Explain why memory was applied and why actions were taken",
  "confidenceScore": 0.0,
  "memoryUpdates": [ "..." ],
  "auditTrail": [
    {
      "step": "recall|apply|decide|learn",
      "timestamp": "...",
      "details": "..."
    }
  ]
}
```

## 🎬 Demo & Learning Progression

The system demonstrates learning over time:

1. **Invoice #1** → System flags issues / asks for review
2. **Apply human correction** → Store memory update  
3. **Invoice #2** from same vendor/pattern → Show fewer flags / smarter decisions

### Expected Learning Outcomes

- **Supplier GmbH**: After learning from INV-A-001, reliably fills serviceDate from "Leistungsdatum"
- **Supplier GmbH**: INV-A-003 auto-suggests PO-A-051 match after learning
- **Parts AG**: "MwSt. inkl." / "Prices incl. VAT" triggers correction strategy with clear reasoning
- **Parts AG**: Missing currency recovered from rawText with vendor-specific confidence
- **Freight & Co**: Skonto terms detected and recorded; later invoices flagged less often
- **Freight & Co**: "Seefracht/Shipping" maps to SKU FREIGHT with increasing confidence
- **Duplicates**: INV-A-004 and INV-B-004 flagged as duplicates (same vendor + invoiceNumber + close dates)

## 🧪 Testing Strategy

### Dual Testing Approach
- **Unit Tests**: Specific vendor examples, edge cases, error handling
- **Property-Based Tests**: Universal properties using fast-check (100+ iterations)

### Key Properties Tested
1. Memory Persistence Round-Trip Consistency
2. Vendor Memory Isolation  
3. Confidence-Based Decision Consistency
4. Confidence Evolution Based on Outcomes
5. Memory Learning from Corrections
6. Highest Confidence Memory Selection
7. Complete Audit Trail Generation
8. Output Contract Compliance
9. Reasoning Provision for All Decisions
10. Memory Retrieval Relevance
11. Duplicate Invoice Detection
12. Learning Progression Over Time
13. Error Handling Graceful Degradation
14. Concurrent Access Data Integrity
15. Poor Performance Memory Suppression

## 🗄️ Persistence

- **SQLite Database**: Persistent memory storage across application restarts
- **Audit Trail**: Complete record of all memory operations and decisions
- **Schema**: Optimized for memory queries and confidence tracking
- **Backup**: File-based backup mechanisms for data safety

## 📁 Project Structure

```
src/
├── core/                    # Core memory system components
│   ├── memory-system.ts     # Main orchestrator
│   ├── memory-recall.ts     # Memory retrieval engine
│   ├── memory-application.ts # Memory application engine
│   ├── decision-engine.ts   # Decision logic
│   ├── confidence-manager.ts # Confidence calculations
│   └── *.property.test.ts   # Property-based tests
├── database/                # Persistence layer
│   ├── memory-repository.ts # Memory CRUD operations
│   ├── audit-repository.ts  # Audit trail storage
│   └── schema.sql          # Database schema
├── demo/                   # Demo system
│   ├── demo-runner.ts      # Main demo script
│   ├── sample-data.ts      # Test invoice data
│   └── learning-progression-demo.ts
├── types/                  # TypeScript interfaces
└── test/                   # Test utilities
```

## 🔧 Technical Stack

- **Language**: TypeScript (strict mode)
- **Runtime**: Node.js
- **Database**: SQLite with file persistence
- **Testing**: Jest + fast-check for property-based testing
- **Build**: TypeScript compiler with strict type checking

## 📊 Key Features

✅ **Memory-Driven Learning**: Stores and applies insights from past invoices  
✅ **Confidence Management**: Reinforcement and decay algorithms  
✅ **Vendor Isolation**: Separate memory spaces per vendor  
✅ **Audit Trail**: Complete transparency and explainability  
✅ **Property-Based Testing**: Formal correctness validation  
✅ **Error Handling**: Graceful degradation and recovery  
✅ **TypeScript Strict**: Full type safety and maintainability  
✅ **Demo System**: Learning progression visualization  

## 🎥 Demo Video

[Demo video link will be provided showing the system learning progression and memory application in action]

## 📝 License

MIT License - see LICENSE file for details

---

**GitHub Repository**: https://github.com/batmandevx/invoice-memory-system.git
