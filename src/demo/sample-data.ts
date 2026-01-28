/**
 * Sample invoice data for demonstration purposes
 * 
 * This module provides realistic sample invoices from three different vendors:
 * - Supplier GmbH (German supplier with "Leistungsdatum" field)
 * - Parts AG (German parts supplier with VAT handling complexities)
 * - Freight & Co (Shipping company with Skonto terms and SKU mapping)
 */

import { 
  RawInvoice, 
  QualityLevel,
  VendorInfo,
  VendorRelationshipType
} from '../types';

// ============================================================================
// Supplier GmbH Sample Data
// ============================================================================

export const supplierGmbHInvoices: RawInvoice[] = [
  {
    id: 'SUP-001-2024',
    vendorId: 'supplier-gmbh',
    invoiceNumber: 'RG-2024-001',
    rawText: `
      Supplier GmbH
      Musterstraße 123
      12345 Berlin, Deutschland
      
      Rechnung Nr: RG-2024-001
      Rechnungsdatum: 15.03.2024
      Leistungsdatum: 10.03.2024
      Bestellnummer: PO-2024-456
      
      Leistungen:
      - Beratungsleistungen    8 Std.    150,00 EUR    1.200,00 EUR
      - Projektmanagement      4 Std.    120,00 EUR      480,00 EUR
      
      Nettobetrag:                                      1.680,00 EUR
      MwSt. 19%:                                          319,20 EUR
      Gesamtbetrag:                                     1.999,20 EUR
      
      Zahlungsziel: 30 Tage netto
    `,
    extractedFields: [
      { name: 'invoiceNumber', value: 'RG-2024-001', confidence: 0.95 },
      { name: 'invoiceDate', value: '15.03.2024', confidence: 0.90 },
      { name: 'Leistungsdatum', value: '10.03.2024', confidence: 0.85 },
      { name: 'purchaseOrderNumber', value: 'PO-2024-456', confidence: 0.88 },
      { name: 'totalAmount', value: '1999.20', confidence: 0.92 },
      { name: 'currency', value: 'EUR', confidence: 0.98 },
      { name: 'vatAmount', value: '319.20', confidence: 0.87 }
    ],
    metadata: {
      sourceSystem: 'email-processor',
      receivedAt: new Date('2024-03-15T10:30:00Z'),
      fileFormat: 'PDF',
      fileSize: 245760,
      detectedLanguage: 'de',
      extractionQuality: QualityLevel.GOOD,
      additionalMetadata: {
        emailSubject: 'Rechnung RG-2024-001 von Supplier GmbH',
        senderEmail: 'billing@supplier-gmbh.de'
      }
    }
  },
  {
    id: 'SUP-002-2024',
    vendorId: 'supplier-gmbh',
    invoiceNumber: 'RG-2024-002',
    rawText: `
      Supplier GmbH
      Musterstraße 123
      12345 Berlin, Deutschland
      
      Rechnung Nr: RG-2024-002
      Rechnungsdatum: 22.03.2024
      Leistungsdatum: 20.03.2024
      Bestellnummer: PO-2024-789
      
      Leistungen:
      - Softwareentwicklung    16 Std.   180,00 EUR    2.880,00 EUR
      - Code Review            2 Std.    150,00 EUR      300,00 EUR
      
      Nettobetrag:                                      3.180,00 EUR
      MwSt. 19%:                                          604,20 EUR
      Gesamtbetrag:                                     3.784,20 EUR
      
      Zahlungsziel: 30 Tage netto
    `,
    extractedFields: [
      { name: 'invoiceNumber', value: 'RG-2024-002', confidence: 0.96 },
      { name: 'invoiceDate', value: '22.03.2024', confidence: 0.91 },
      { name: 'Leistungsdatum', value: '20.03.2024', confidence: 0.86 },
      { name: 'purchaseOrderNumber', value: 'PO-2024-789', confidence: 0.89 },
      { name: 'totalAmount', value: '3784.20', confidence: 0.93 },
      { name: 'currency', value: 'EUR', confidence: 0.98 },
      { name: 'vatAmount', value: '604.20', confidence: 0.88 }
    ],
    metadata: {
      sourceSystem: 'email-processor',
      receivedAt: new Date('2024-03-22T14:15:00Z'),
      fileFormat: 'PDF',
      fileSize: 251840,
      detectedLanguage: 'de',
      extractionQuality: QualityLevel.GOOD,
      additionalMetadata: {
        emailSubject: 'Rechnung RG-2024-002 von Supplier GmbH',
        senderEmail: 'billing@supplier-gmbh.de'
      }
    }
  }
];

// ============================================================================
// Parts AG Sample Data
// ============================================================================

export const partsAGInvoices: RawInvoice[] = [
  {
    id: 'PARTS-001-2024',
    vendorId: 'parts-ag',
    invoiceNumber: 'PA-INV-2024-001',
    rawText: `
      Parts AG
      Industriestraße 45
      80331 München, Deutschland
      
      Rechnung PA-INV-2024-001
      Datum: 18.03.2024
      Kunden-Nr: K-12345
      
      Artikel:
      - Hydraulikpumpe HP-200    1 Stk.    MwSt. inkl.    850,00
      - Dichtungsset DS-45       3 Stk.    MwSt. inkl.     75,00
      - Schlauchverbindung SV-12 5 Stk.    MwSt. inkl.    125,00
      
      Gesamtbetrag: 1.050,00
      Prices incl. VAT 19%
      
      Zahlbar innerhalb 14 Tage
    `,
    extractedFields: [
      { name: 'invoiceNumber', value: 'PA-INV-2024-001', confidence: 0.94 },
      { name: 'invoiceDate', value: '18.03.2024', confidence: 0.89 },
      { name: 'customerNumber', value: 'K-12345', confidence: 0.92 },
      { name: 'totalAmount', value: '1050.00', confidence: 0.91 },
      { name: 'vatIncluded', value: 'MwSt. inkl.', confidence: 0.85 },
      { name: 'vatNote', value: 'Prices incl. VAT 19%', confidence: 0.88 }
    ],
    metadata: {
      sourceSystem: 'ftp-import',
      receivedAt: new Date('2024-03-18T16:45:00Z'),
      fileFormat: 'PDF',
      fileSize: 198432,
      detectedLanguage: 'de',
      extractionQuality: QualityLevel.FAIR,
      additionalMetadata: {
        ftpPath: '/incoming/parts-ag/PA-INV-2024-001.pdf',
        processingBatch: 'BATCH-2024-03-18-001'
      }
    }
  },
  {
    id: 'PARTS-002-2024',
    vendorId: 'parts-ag',
    invoiceNumber: 'PA-INV-2024-002',
    rawText: `
      Parts AG
      Industriestraße 45
      80331 München, Deutschland
      
      Rechnung PA-INV-2024-002
      Datum: 25.03.2024
      Kunden-Nr: K-12345
      
      Artikel:
      - Motoröl 5W-30           4 Liter   Prices incl. VAT    240,00
      - Ölfilter OF-BMW-320     2 Stk.    Prices incl. VAT     45,00
      - Luftfilter LF-BMW-320   1 Stk.    Prices incl. VAT     35,00
      
      Gesamtbetrag: 320,00 EUR
      Alle Preise inkl. 19% MwSt.
      
      Zahlbar innerhalb 14 Tage
    `,
    extractedFields: [
      { name: 'invoiceNumber', value: 'PA-INV-2024-002', confidence: 0.95 },
      { name: 'invoiceDate', value: '25.03.2024', confidence: 0.90 },
      { name: 'customerNumber', value: 'K-12345', confidence: 0.93 },
      { name: 'totalAmount', value: '320.00', confidence: 0.92 },
      { name: 'currency', value: 'EUR', confidence: 0.97 },
      { name: 'vatIncluded', value: 'Prices incl. VAT', confidence: 0.87 },
      { name: 'vatNote', value: 'Alle Preise inkl. 19% MwSt.', confidence: 0.89 }
    ],
    metadata: {
      sourceSystem: 'ftp-import',
      receivedAt: new Date('2024-03-25T09:20:00Z'),
      fileFormat: 'PDF',
      fileSize: 203776,
      detectedLanguage: 'de',
      extractionQuality: QualityLevel.GOOD,
      additionalMetadata: {
        ftpPath: '/incoming/parts-ag/PA-INV-2024-002.pdf',
        processingBatch: 'BATCH-2024-03-25-001'
      }
    }
  }
];

// ============================================================================
// Freight & Co Sample Data
// ============================================================================

export const freightCoInvoices: RawInvoice[] = [
  {
    id: 'FREIGHT-001-2024',
    vendorId: 'freight-co',
    invoiceNumber: 'FC-2024-001',
    rawText: `
      Freight & Co International
      Hafenstraße 88
      20459 Hamburg, Deutschland
      
      Invoice: FC-2024-001
      Date: March 20, 2024
      Customer: CUST-789
      
      Services:
      - Seefracht/Shipping Container 20ft    1 Unit    1,250.00 EUR
      - Handling & Documentation             1 Service   150.00 EUR
      - Insurance                            1 Service    75.00 EUR
      
      Subtotal:                                        1,475.00 EUR
      VAT 19%:                                           280.25 EUR
      Total Amount:                                    1,755.25 EUR
      
      Payment Terms:
      - 2% Skonto bei Zahlung innerhalb 10 Tage
      - Netto 30 Tage
      
      Bank Details: DE89 3704 0044 0532 0130 00
    `,
    extractedFields: [
      { name: 'invoiceNumber', value: 'FC-2024-001', confidence: 0.96 },
      { name: 'invoiceDate', value: 'March 20, 2024', confidence: 0.88 },
      { name: 'customerNumber', value: 'CUST-789', confidence: 0.91 },
      { name: 'shippingService', value: 'Seefracht/Shipping', confidence: 0.84 },
      { name: 'containerType', value: 'Container 20ft', confidence: 0.87 },
      { name: 'subtotal', value: '1475.00', confidence: 0.93 },
      { name: 'vatAmount', value: '280.25', confidence: 0.90 },
      { name: 'totalAmount', value: '1755.25', confidence: 0.94 },
      { name: 'currency', value: 'EUR', confidence: 0.98 },
      { name: 'skontoTerms', value: '2% Skonto bei Zahlung innerhalb 10 Tage', confidence: 0.82 },
      { name: 'paymentTerms', value: 'Netto 30 Tage', confidence: 0.86 }
    ],
    metadata: {
      sourceSystem: 'api-integration',
      receivedAt: new Date('2024-03-20T11:30:00Z'),
      fileFormat: 'JSON',
      fileSize: 156789,
      detectedLanguage: 'en',
      extractionQuality: QualityLevel.EXCELLENT,
      additionalMetadata: {
        apiEndpoint: '/invoices/freight-co',
        apiVersion: 'v2.1',
        trackingNumber: 'FC-TRACK-2024-001'
      }
    }
  },
  {
    id: 'FREIGHT-002-2024',
    vendorId: 'freight-co',
    invoiceNumber: 'FC-2024-002',
    rawText: `
      Freight & Co International
      Hafenstraße 88
      20459 Hamburg, Deutschland
      
      Invoice: FC-2024-002
      Date: March 28, 2024
      Customer: CUST-789
      
      Services:
      - Luftfracht/Air Freight 50kg         1 Shipment   850.00 EUR
      - Express Handling                     1 Service    120.00 EUR
      - Customs Clearance                    1 Service     80.00 EUR
      
      Subtotal:                                        1,050.00 EUR
      VAT 19%:                                           199.50 EUR
      Total Amount:                                    1,249.50 EUR
      
      Payment Terms:
      - 3% Skonto bei Zahlung innerhalb 7 Tage
      - Netto 30 Tage
      
      SKU Mapping:
      - Luftfracht/Air Freight → FREIGHT
      - Express Handling → HANDLING
      - Customs Clearance → CUSTOMS
    `,
    extractedFields: [
      { name: 'invoiceNumber', value: 'FC-2024-002', confidence: 0.97 },
      { name: 'invoiceDate', value: 'March 28, 2024', confidence: 0.89 },
      { name: 'customerNumber', value: 'CUST-789', confidence: 0.92 },
      { name: 'airFreightService', value: 'Luftfracht/Air Freight', confidence: 0.85 },
      { name: 'weight', value: '50kg', confidence: 0.88 },
      { name: 'subtotal', value: '1050.00', confidence: 0.94 },
      { name: 'vatAmount', value: '199.50', confidence: 0.91 },
      { name: 'totalAmount', value: '1249.50', confidence: 0.95 },
      { name: 'currency', value: 'EUR', confidence: 0.98 },
      { name: 'skontoTerms', value: '3% Skonto bei Zahlung innerhalb 7 Tage', confidence: 0.83 },
      { name: 'paymentTerms', value: 'Netto 30 Tage', confidence: 0.87 },
      { name: 'skuMapping', value: 'Luftfracht/Air Freight → FREIGHT', confidence: 0.79 }
    ],
    metadata: {
      sourceSystem: 'api-integration',
      receivedAt: new Date('2024-03-28T15:45:00Z'),
      fileFormat: 'JSON',
      fileSize: 167234,
      detectedLanguage: 'en',
      extractionQuality: QualityLevel.EXCELLENT,
      additionalMetadata: {
        apiEndpoint: '/invoices/freight-co',
        apiVersion: 'v2.1',
        trackingNumber: 'FC-TRACK-2024-002'
      }
    }
  }
];

// ============================================================================
// Vendor Information
// ============================================================================

export const vendorInformation: Record<string, VendorInfo> = {
  'supplier-gmbh': {
    id: 'supplier-gmbh',
    name: 'Supplier GmbH',
    country: 'DE',
    language: 'de',
    relationshipType: VendorRelationshipType.PREFERRED
  },
  'parts-ag': {
    id: 'parts-ag',
    name: 'Parts AG',
    country: 'DE',
    language: 'de',
    relationshipType: VendorRelationshipType.STANDARD
  },
  'freight-co': {
    id: 'freight-co',
    name: 'Freight & Co International',
    country: 'DE',
    language: 'en',
    relationshipType: VendorRelationshipType.PREFERRED
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get all sample invoices
 */
export function getAllSampleInvoices(): RawInvoice[] {
  return [
    ...supplierGmbHInvoices,
    ...partsAGInvoices,
    ...freightCoInvoices
  ];
}

/**
 * Get invoices by vendor
 */
export function getInvoicesByVendor(vendorId: string): RawInvoice[] {
  switch (vendorId) {
    case 'supplier-gmbh':
      return supplierGmbHInvoices;
    case 'parts-ag':
      return partsAGInvoices;
    case 'freight-co':
      return freightCoInvoices;
    default:
      return [];
  }
}

/**
 * Get vendor information
 */
export function getVendorInfo(vendorId: string): VendorInfo | undefined {
  return vendorInformation[vendorId];
}

/**
 * Create a sample invoice context for testing
 */
export function createSampleInvoiceContext(invoice: RawInvoice): any {
  const vendorInfo = getVendorInfo(invoice.vendorId);
  if (!vendorInfo) {
    throw new Error(`Unknown vendor: ${invoice.vendorId}`);
  }

  return {
    invoice,
    vendorInfo,
    environment: {
      timestamp: new Date(),
      priority: 'normal',
      timeConstraints: {
        maxProcessingTime: 30000,
        realTimeRequired: false
      },
      regulatoryContext: {
        regulations: ['GDPR', 'German Tax Law'],
        complianceRequirements: [],
        auditRequirements: []
      }
    },
    history: {
      vendorHistory: [],
      similarInvoices: [],
      performanceMetrics: {
        averageProcessingTime: 5000,
        successRate: 0.85,
        automationRate: 0.60,
        humanReviewRate: 0.40
      }
    }
  };
}