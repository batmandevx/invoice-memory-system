/**
 * Integration tests for Memory System decision making
 * 
 * Tests the integration between the memory system and decision engine
 * to ensure the makeDecision method works correctly.
 */

import { MemorySystemImpl } from './memory-system';
import { DatabaseConnection } from '../database/connection';
import { 
  NormalizedInvoice, 
  DecisionType
} from '../types';

describe('MemorySystem Decision Integration', () => {
  let memorySystem: MemorySystemImpl;
  let mockDb: jest.Mocked<DatabaseConnection>;

  beforeEach(() => {
    // Create mock database connection
    mockDb = {
      queryOne: jest.fn(),
      query: jest.fn(),
      execute: jest.fn(),
      close: jest.fn(),
      beginTransaction: jest.fn(),
      commit: jest.fn(),
      rollback: jest.fn()
    } as any;

    // Mock escalation threshold query
    mockDb.queryOne.mockResolvedValue({ value: '0.7' });

    memorySystem = new MemorySystemImpl(mockDb);
  });

  afterEach(async () => {
    await memorySystem.close();
  });

  describe('makeDecision', () => {
    it('should make auto-approve decision for high confidence invoice', async () => {
      const invoice: NormalizedInvoice = {
        id: 'test-invoice-1',
        vendorId: 'test-vendor-1',
        invoiceNumber: 'INV-001',
        invoiceDate: new Date(),
        totalAmount: {
          amount: 1000,
          currency: 'USD'
        },
        currency: 'USD',
        lineItems: [
          {
            description: 'Test item',
            quantity: 1,
            unitPrice: { amount: 1000, currency: 'USD' },
            totalPrice: { amount: 1000, currency: 'USD' }
          }
        ],
        normalizedFields: []
      };

      const decision = await memorySystem.makeDecision(invoice, 0.9);

      expect(decision.decisionType).toBe(DecisionType.AUTO_APPROVE);
      expect(decision.confidence).toBeGreaterThan(0.8);
      expect(decision.reasoning).toContain('exceeds escalation threshold');
      expect(decision.recommendedActions.length).toBeGreaterThan(0);
      expect(decision.riskAssessment).toBeDefined();
    });

    it('should require human review for medium confidence invoice', async () => {
      const invoice: NormalizedInvoice = {
        id: 'test-invoice-2',
        vendorId: 'test-vendor-2',
        invoiceNumber: 'INV-002',
        invoiceDate: new Date(),
        totalAmount: {
          amount: 5000,
          currency: 'USD'
        },
        currency: 'USD',
        lineItems: [
          {
            description: 'Test item',
            quantity: 1,
            unitPrice: { amount: 5000, currency: 'USD' },
            totalPrice: { amount: 5000, currency: 'USD' }
          }
        ],
        normalizedFields: []
      };

      const decision = await memorySystem.makeDecision(invoice, 0.6);

      expect(decision.decisionType).toBe(DecisionType.HUMAN_REVIEW_REQUIRED);
      expect(decision.reasoning).toContain('below escalation threshold');
      expect(decision.recommendedActions.some(action => 
        action.actionType === 'escalate_issue'
      )).toBe(true);
    });

    it('should reject invoice with critical validation issues', async () => {
      const invoice: NormalizedInvoice = {
        id: 'test-invoice-3',
        vendorId: 'test-vendor-3',
        invoiceNumber: 'INV-003',
        invoiceDate: new Date(),
        totalAmount: {
          amount: 0, // Invalid amount - will trigger critical validation issue
          currency: 'USD'
        },
        currency: 'USD',
        lineItems: [],
        normalizedFields: []
      };

      const decision = await memorySystem.makeDecision(invoice, 0.8);

      expect(decision.decisionType).toBe(DecisionType.REJECT_INVOICE);
      expect(decision.reasoning).toContain('critical validation issues');
    });

    it('should handle high-value invoices with appropriate risk assessment', async () => {
      const invoice: NormalizedInvoice = {
        id: 'test-invoice-4',
        vendorId: 'test-vendor-4',
        invoiceNumber: 'INV-004',
        invoiceDate: new Date(),
        totalAmount: {
          amount: 25000, // High value
          currency: 'USD'
        },
        currency: 'USD',
        lineItems: [
          {
            description: 'High-value item',
            quantity: 1,
            unitPrice: { amount: 25000, currency: 'USD' },
            totalPrice: { amount: 25000, currency: 'USD' }
          }
        ],
        normalizedFields: []
      };

      const decision = await memorySystem.makeDecision(invoice, 0.8);

      expect(decision.riskAssessment.riskFactors.some(factor => 
        factor.riskType === 'financial'
      )).toBe(true);
      expect(decision.riskAssessment.mitigationStrategies.length).toBeGreaterThan(0);
    });

    it('should provide detailed reasoning for all decisions', async () => {
      const invoice: NormalizedInvoice = {
        id: 'test-invoice-5',
        vendorId: 'test-vendor-5',
        invoiceNumber: 'INV-005',
        invoiceDate: new Date(),
        totalAmount: {
          amount: 1500,
          currency: 'USD'
        },
        currency: 'USD',
        lineItems: [
          {
            description: 'Test item',
            quantity: 1,
            unitPrice: { amount: 1500, currency: 'USD' },
            totalPrice: { amount: 1500, currency: 'USD' }
          }
        ],
        normalizedFields: []
      };

      const decision = await memorySystem.makeDecision(invoice, 0.75);

      expect(decision.reasoning).toBeTruthy();
      expect(decision.reasoning.length).toBeGreaterThan(50);
      expect(decision.reasoning).toContain('Decision:');
      expect(decision.reasoning).toContain('confidence');
      expect(decision.reasoning).toContain('Risk assessment:');
    });

    it('should handle invoices with inconsistent data', async () => {
      const invoice: NormalizedInvoice = {
        id: 'test-invoice-6',
        vendorId: 'test-vendor-6',
        invoiceNumber: 'INV-006',
        invoiceDate: new Date(),
        totalAmount: {
          amount: 1000, // Total doesn't match line items
          currency: 'USD'
        },
        currency: 'USD',
        lineItems: [
          {
            description: 'Test item',
            quantity: 1,
            unitPrice: { amount: 500, currency: 'USD' },
            totalPrice: { amount: 500, currency: 'USD' } // Only 500, but total is 1000
          }
        ],
        normalizedFields: []
      };

      const decision = await memorySystem.makeDecision(invoice, 0.8);

      // Should detect the inconsistency and require human review or escalation
      expect([
        DecisionType.HUMAN_REVIEW_REQUIRED,
        DecisionType.ESCALATE_TO_EXPERT
      ]).toContain(decision.decisionType);
      
      expect(decision.riskAssessment.riskFactors.some(factor =>
        factor.description.includes('inconsistent') || 
        factor.description.includes('validation')
      )).toBe(true);
    });
  });

  describe('invoice validation', () => {
    it('should identify missing required fields', async () => {
      const invoice: NormalizedInvoice = {
        id: 'test-invoice-7',
        vendorId: 'test-vendor-7',
        invoiceNumber: 'INV-007',
        invoiceDate: undefined as any, // Missing required field
        totalAmount: {
          amount: 1000,
          currency: 'USD'
        },
        currency: 'USD',
        lineItems: [
          {
            description: 'Test item',
            quantity: 1,
            unitPrice: { amount: 1000, currency: 'USD' },
            totalPrice: { amount: 1000, currency: 'USD' }
          }
        ],
        normalizedFields: []
      };

      const decision = await memorySystem.makeDecision(invoice, 0.8);

      // Should detect missing invoice date and handle appropriately
      expect(decision.riskAssessment.riskFactors.some(factor =>
        factor.riskType === 'compliance'
      )).toBe(true);
    });
  });

  describe('complexity estimation', () => {
    it('should estimate complexity correctly for simple invoices', async () => {
      const invoice: NormalizedInvoice = {
        id: 'test-invoice-8',
        vendorId: 'test-vendor-8',
        invoiceNumber: 'INV-008',
        invoiceDate: new Date(),
        totalAmount: {
          amount: 100,
          currency: 'USD'
        },
        currency: 'USD',
        lineItems: [
          {
            description: 'Simple item',
            quantity: 1,
            unitPrice: { amount: 100, currency: 'USD' },
            totalPrice: { amount: 100, currency: 'USD' }
          }
        ],
        normalizedFields: []
      };

      const decision = await memorySystem.makeDecision(invoice, 0.8);

      // Simple invoice should have lower risk
      expect(decision.riskAssessment.riskLevel).toBeOneOf(['very_low', 'low', 'medium']);
    });

    it('should estimate complexity correctly for complex invoices', async () => {
      const invoice: NormalizedInvoice = {
        id: 'test-invoice-9',
        vendorId: 'test-vendor-9',
        invoiceNumber: 'INV-009',
        invoiceDate: new Date(),
        totalAmount: {
          amount: 5000,
          currency: 'USD'
        },
        vatAmount: {
          amount: 500,
          currency: 'USD'
        },
        currency: 'USD',
        lineItems: Array.from({ length: 10 }, (_, i) => ({
          description: `Item ${i + 1}`,
          quantity: 1,
          unitPrice: { amount: 450, currency: 'USD' },
          totalPrice: { amount: 450, currency: 'USD' }
        })),
        paymentTerms: {
          dueDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          paymentMethod: 'bank_transfer' as any,
          discountTerms: {
            discountPercentage: 2,
            discountDays: 10,
            description: '2% discount if paid within 10 days'
          },
          additionalTerms: []
        },
        purchaseOrderNumber: 'PO-12345',
        normalizedFields: []
      };

      const decision = await memorySystem.makeDecision(invoice, 0.8);

      // Complex invoice should be handled appropriately
      expect(decision).toBeDefined();
      expect(decision.reasoning).toContain('confidence');
    });
  });
});

// Custom Jest matcher for testing enum values
expect.extend({
  toBeOneOf(received, expected) {
    const pass = expected.includes(received);
    if (pass) {
      return {
        message: () => `expected ${received} not to be one of ${expected.join(', ')}`,
        pass: true,
      };
    } else {
      return {
        message: () => `expected ${received} to be one of ${expected.join(', ')}`,
        pass: false,
      };
    }
  },
});

declare global {
  namespace jest {
    interface Matchers<R> {
      toBeOneOf(expected: any[]): R;
    }
  }
}