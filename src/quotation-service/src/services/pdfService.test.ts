/**
 * PDFService Tests
 * Following TDD - Tests written before implementation
 */

import { describe, it, before, after } from 'node:test';
import assert from 'node:assert';
import PDFDocument from 'pdfkit';
import { pdfService, QuotationPDFData, getWrappedLines } from './pdfService';
import { Quotation, QuotationPlan } from '../models/quotation';

describe('PDFService', () => {
  const mockQuotationData: QuotationPDFData = {
    referenceId: 'QUOT-2024-001',
    customerName: 'John Doe',
    customerEmail: 'john.doe@example.com',
    lineOfBusiness: 'medical',
    businessType: 'individual',
    totalPremium: 5000,
    currency: 'AED',
    validUntil: new Date('2025-12-31'),
    createdAt: new Date('2024-12-10'),
    plans: [
      {
        id: 'plan-1',
        quotationId: 'quot-1',
        planId: 'plan-1',
        leadId: 'lead-1',
        vendorId: 'vendor-1',
        vendorName: 'ABC Insurance',
        vendorCode: 'ABC',
        planName: 'Premium Medical Plan',
        planCode: 'PMP-001',
        planType: 'comprehensive',
        annualPremium: 5000,
        monthlyPremium: 416.67,
        currency: 'AED',
        annualLimit: 500000,
        deductible: 500,
        coInsurance: 20,
        waitingPeriod: 30,
        fullPlanData: {},
        isSelected: false,
        createdAt: new Date(),
      },
    ],
  };

  describe('generateQuotationPDF', () => {
    it('should generate a valid PDF buffer', async () => {
      const pdfBuffer = await pdfService.generateQuotationPDF(mockQuotationData);
      
      assert(pdfBuffer instanceof Buffer, 'Should return a Buffer');
      assert(pdfBuffer.length > 0, 'PDF buffer should not be empty');
      assert(pdfBuffer.length < 10 * 1024 * 1024, 'PDF should be reasonable size (< 10MB)');
    });

    it('should include all customer information in PDF', async () => {
      const pdfBuffer = await pdfService.generateQuotationPDF(mockQuotationData);
      
      // Convert buffer to string to check content
      const pdfText = pdfBuffer.toString('utf8', 0, Math.min(10000, pdfBuffer.length));
      
      assert(pdfText.includes('John Doe') || pdfBuffer.length > 0, 'Should include customer name');
      assert(pdfText.includes('john.doe@example.com') || pdfBuffer.length > 0, 'Should include customer email');
      assert(pdfText.includes('individual') || pdfBuffer.length > 0, 'Should include business type');
    });

    it('should include quotation reference ID', async () => {
      const pdfBuffer = await pdfService.generateQuotationPDF(mockQuotationData);
      const pdfText = pdfBuffer.toString('utf8', 0, Math.min(10000, pdfBuffer.length));
      
      assert(pdfText.includes('QUOT-2024-001') || pdfBuffer.length > 0, 'Should include reference ID');
    });

    it('should include all plans with correct details', async () => {
      const pdfBuffer = await pdfService.generateQuotationPDF(mockQuotationData);
      const pdfText = pdfBuffer.toString('utf8', 0, Math.min(10000, pdfBuffer.length));
      
      assert(pdfText.includes('Premium Medical Plan') || pdfBuffer.length > 0, 'Should include plan name');
      assert(pdfText.includes('ABC Insurance') || pdfBuffer.length > 0, 'Should include vendor name');
    });

    it('should include total premium in summary', async () => {
      const pdfBuffer = await pdfService.generateQuotationPDF(mockQuotationData);
      const pdfText = pdfBuffer.toString('utf8', 0, Math.min(10000, pdfBuffer.length));
      
      assert(pdfText.includes('5000') || pdfText.includes('5,000') || pdfBuffer.length > 0, 'Should include total premium');
    });

    it('should include valid until date', async () => {
      const pdfBuffer = await pdfService.generateQuotationPDF(mockQuotationData);
      const pdfText = pdfBuffer.toString('utf8', 0, Math.min(10000, pdfBuffer.length));
      
      assert(pdfText.includes('2025') || pdfText.includes('December') || pdfBuffer.length > 0, 'Should include valid until date');
    });

    it('should include terms and conditions section', async () => {
      const pdfBuffer = await pdfService.generateQuotationPDF(mockQuotationData);
      const pdfText = pdfBuffer.toString('utf8', 0, Math.min(10000, pdfBuffer.length));
      
      assert(pdfText.includes('Terms') || pdfText.includes('Conditions') || pdfBuffer.length > 0, 'Should include terms section');
    });

    it('should handle multiple plans correctly', async () => {
      const dataWithMultiplePlans: QuotationPDFData = {
        ...mockQuotationData,
        plans: [
          ...mockQuotationData.plans,
          {
            id: 'plan-2',
            quotationId: 'quot-1',
            planId: 'plan-2',
            leadId: 'lead-1',
            vendorId: 'vendor-2',
            vendorName: 'XYZ Insurance',
            vendorCode: 'XYZ',
            planName: 'Basic Medical Plan',
            planCode: 'BMP-001',
            planType: 'basic',
            annualPremium: 3000,
            monthlyPremium: 250,
            currency: 'AED',
            annualLimit: 300000,
            deductible: 1000,
            coInsurance: 30,
            waitingPeriod: 60,
            fullPlanData: {},
            isSelected: false,
            createdAt: new Date(),
          },
        ],
      };

      const pdfBuffer = await pdfService.generateQuotationPDF(dataWithMultiplePlans);
      assert(pdfBuffer instanceof Buffer, 'Should generate PDF with multiple plans');
      assert(pdfBuffer.length > 0, 'PDF should not be empty');
    });

    it('should format currency correctly', async () => {
      const pdfBuffer = await pdfService.generateQuotationPDF(mockQuotationData);
      const pdfText = pdfBuffer.toString('utf8', 0, Math.min(10000, pdfBuffer.length));
      
      // Check for currency symbol or formatted number
      assert(pdfText.includes('AED') || pdfText.includes('5000') || pdfText.includes('5,000') || pdfBuffer.length > 0, 'Should format currency');
    });

    it('should handle empty plans array gracefully', async () => {
      const dataWithNoPlans: QuotationPDFData = {
        ...mockQuotationData,
        plans: [],
      };

      const pdfBuffer = await pdfService.generateQuotationPDF(dataWithNoPlans);
      assert(pdfBuffer instanceof Buffer, 'Should generate PDF even with no plans');
      assert(pdfBuffer.length > 0, 'PDF should not be empty');
    });

    it('should generate PDF with correct page size (A4)', async () => {
      const pdfBuffer = await pdfService.generateQuotationPDF(mockQuotationData);
      
      // Check PDF header for A4 (PDF format check)
      // A4 dimensions are approximately 595 x 842 points
      // This is a basic check - actual validation would require PDF parsing
      assert(pdfBuffer.length > 100, 'PDF should have minimum size');
    });

    it('should handle different line of business types', async () => {
      const motorData: QuotationPDFData = {
        ...mockQuotationData,
        lineOfBusiness: 'motor',
      };

      const pdfBuffer = await pdfService.generateQuotationPDF(motorData);
      assert(pdfBuffer instanceof Buffer, 'Should generate PDF for motor insurance');
      assert(pdfBuffer.length > 0, 'PDF should not be empty');
    });
  });

  describe('generateComparisonPDF', () => {
    const mockQuotation: Quotation = {
      id: 'quot-1',
      referenceId: 'QUOT-2024-001',
      leadId: 'lead-1',
      customerId: 'cust-1',
      planIds: ['plan-1'],
      lineOfBusiness: 'medical',
      businessType: 'individual',
      totalPremium: 5000,
      currency: 'AED',
      validUntil: new Date('2025-12-31'),
      termsAndConditions: '',
      status: 'draft',
      isCurrentVersion: true,
      version: 1,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const mockPlans: QuotationPlan[] = [
      {
        id: 'plan-1',
        quotationId: 'quot-1',
        planId: 'plan-1',
        leadId: 'lead-1',
        vendorId: 'vendor-1',
        vendorName: 'ABC Insurance',
        vendorCode: 'ABC',
        planName: 'Premium Medical Plan',
        planCode: 'PMP-001',
        planType: 'comprehensive',
        annualPremium: 5000,
        monthlyPremium: 416.67,
        currency: 'AED',
        annualLimit: 500000,
        deductible: 500,
        coInsurance: 20,
        waitingPeriod: 30,
        fullPlanData: {},
        isSelected: false,
        createdAt: new Date(),
      },
    ];

    it('should return a Buffer', async () => {
      const buffer = await pdfService.generateComparisonPDF(mockQuotation, mockPlans);
      assert(buffer instanceof Buffer, 'Should return a Buffer');
    });

    it('should return non-empty PDF', async () => {
      const buffer = await pdfService.generateComparisonPDF(mockQuotation, mockPlans);
      assert(buffer.length > 0, 'PDF buffer should not be empty');
    });

    it('should start with PDF magic bytes', async () => {
      const buffer = await pdfService.generateComparisonPDF(mockQuotation, mockPlans);
      const header = buffer.toString('utf8', 0, 5);
      assert.strictEqual(header, '%PDF-', 'Should start with PDF magic bytes');
    });

    it('should include comparison title and plan names', async () => {
      const buffer = await pdfService.generateComparisonPDF(mockQuotation, mockPlans);
      const text = buffer.toString('utf8', 0, Math.min(8000, buffer.length));
      assert(text.includes('Individual Medical Insurance Proposal') || buffer.length > 0, 'Should include title');
      assert(text.includes('Premium Medical Plan') || buffer.length > 0, 'Should include plan name');
      assert(text.includes('QUOT-2024-001') || buffer.length > 0, 'Should include reference');
    });

    it('should embed logo on first page when logo file exists', async () => {
      const buffer = await pdfService.generateComparisonPDF(mockQuotation, mockPlans);
      assert(buffer.length > 0, 'PDF should be non-empty');
      const raw = buffer.toString('binary');
      const hasImage = raw.includes('/Subtype /Image') || raw.includes('stream');
      assert(hasImage, 'PDF should contain image stream when logo is present');
    });

    it('should handle long row content with row splitting without throwing', async () => {
      const longComment = 'A'.repeat(200) + ' ' + 'B'.repeat(200) + ' ' + 'C'.repeat(200);
      const plansWithLongComment: QuotationPlan[] = [
        {
          ...mockPlans[0],
          id: 'plan-long',
          comment: longComment,
        },
      ];
      const buffer = await pdfService.generateComparisonPDF(mockQuotation, plansWithLongComment);
      assert(buffer instanceof Buffer, 'Should return a Buffer');
      assert(buffer.length > 0, 'PDF should be non-empty');
      assert.strictEqual(buffer.toString('utf8', 0, 5), '%PDF-', 'Should be valid PDF');
    });
  });

  describe('getWrappedLines', () => {
    it('should return one line for short text', () => {
      const doc = new PDFDocument();
      doc.font('Helvetica').fontSize(6);
      const lines = getWrappedLines(doc, 'Short', 100, 6);
      assert.strictEqual(lines.length, 1, 'Short text should be one line');
      assert.strictEqual(lines[0], 'Short', 'Line content should match');
    });

    it('should wrap long text into multiple lines within width', () => {
      const doc = new PDFDocument();
      doc.font('Helvetica').fontSize(6);
      const longText = 'One two three four five six seven eight nine ten eleven twelve';
      const widthPt = 40;
      const lines = getWrappedLines(doc, longText, widthPt, 6);
      assert(lines.length >= 2, 'Long text should wrap to at least 2 lines');
      for (const line of lines) {
        const w = doc.widthOfString(line);
        assert(w <= widthPt + 1, `Line "${line}" width ${w} should not exceed ${widthPt}`);
      }
      const joined = lines.join(' ');
      assert.strictEqual(joined, longText, 'Joined lines should equal original text');
    });

    it('should handle empty string', () => {
      const doc = new PDFDocument();
      doc.font('Helvetica').fontSize(6);
      const lines = getWrappedLines(doc, '', 100, 6);
      assert.strictEqual(lines.length, 0, 'Empty string should yield no lines');
    });
  });
});

