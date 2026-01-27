/**
 * PDF Service for Quotation Service
 * Generates PDF documents for quotations
 */

import PDFDocument from 'pdfkit';
import { QuotationPlan } from '../models/quotation';

interface GenerateQuotationPDFParams {
  referenceId: string;
  customerName: string;
  customerEmail: string;
  lineOfBusiness: string;
  businessType: string;
  totalPremium: number;
  currency: string;
  validUntil: Date | string;
  createdAt: Date | string;
  plans: QuotationPlan[];
}

class PDFService {
  async generateQuotationPDF(params: GenerateQuotationPDFParams): Promise<Buffer> {
    const {
      referenceId,
      customerName,
      customerEmail,
      lineOfBusiness,
      businessType,
      totalPremium,
      currency,
      validUntil,
      createdAt,
      plans,
    } = params;

    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const buffers: Buffer[] = [];

      doc.on('data', buffers.push.bind(buffers));
      doc.on('end', () => {
        const pdfBuffer = Buffer.concat(buffers);
        resolve(pdfBuffer);
      });
      doc.on('error', reject);

      // Header
      doc.fontSize(20).text('Insurance Quotation', { align: 'center' });
      doc.moveDown();

      // Quotation Details
      doc.fontSize(14).text(`Quotation Reference: ${referenceId}`);
      doc.text(`Date: ${new Date(createdAt).toLocaleDateString()}`);
      doc.text(`Valid Until: ${new Date(validUntil).toLocaleDateString()}`);
      doc.moveDown();

      // Customer Information
      doc.fontSize(16).text('Customer Information', { underline: true });
      doc.fontSize(12);
      doc.text(`Name: ${customerName}`);
      doc.text(`Email: ${customerEmail}`);
      doc.text(`Line of Business: ${lineOfBusiness}`);
      doc.text(`Business Type: ${businessType}`);
      doc.moveDown();

      // Plans
      doc.fontSize(16).text('Selected Plans', { underline: true });
      doc.moveDown(0.5);

      plans.forEach((plan, index) => {
        doc.fontSize(14).text(`${index + 1}. ${plan.planName}`, { continued: false });
        doc.fontSize(12);
        doc.text(`   Vendor: ${plan.vendorName}`);
        doc.text(`   Annual Premium: ${plan.currency} ${plan.annualPremium.toLocaleString()}`);
        if (plan.monthlyPremium) {
          doc.text(`   Monthly Premium: ${plan.currency} ${plan.monthlyPremium.toLocaleString()}`);
        }
        doc.moveDown(0.5);
      });

      doc.moveDown();

      // Total
      doc.fontSize(16).text(`Total Premium: ${currency} ${totalPremium.toLocaleString()}`, { align: 'right' });

      // Footer
      doc.moveDown(2);
      doc.fontSize(10).fillColor('#666666').text('This is a computer-generated quotation. Please contact us for any questions.', {
        align: 'center',
      });

      doc.end();
    });
  }
}

export const pdfService = new PDFService();
