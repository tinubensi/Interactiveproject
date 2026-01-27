import PDFDocument from 'pdfkit';
import { QuotationPlan } from '../models/quotation';

type PDFDocumentType = InstanceType<typeof PDFDocument>;

export interface QuotationPDFData {
  referenceId: string;
  customerName: string;
  customerEmail: string;
  lineOfBusiness: string;
  businessType: string;
  totalPremium: number;
  currency: string;
  validUntil: Date;
  createdAt: Date;
  plans: QuotationPlan[];
}

class PDFService {
  /**
   * Format currency amount
   */
  private formatCurrency(amount: number, currency: string): string {
    return `${currency} ${amount.toLocaleString()}`;
  }

  /**
   * Format date in readable format
   */
  private formatDate(date: Date): string {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }

  /**
   * Get display label for line of business
   */
  private getLOBDisplay(lob: string): string {
    const labels: { [key: string]: string } = {
      medical: 'Medical Insurance',
      motor: 'Motor Insurance',
      general: 'General Insurance',
      marine: 'Marine Insurance',
    };
    return labels[lob] || lob;
  }

  /**
   * Generate a PDF for a quotation using PDFKit
   */
  async generateQuotationPDF(data: QuotationPDFData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({
        size: 'A4',
        margins: { top: 72, bottom: 72, left: 54, right: 54 }
      });

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Build PDF sections
      this.addHeader(doc, data);
      this.addCustomerInfo(doc, data);
      this.addSummary(doc, data);
      this.addPlans(doc, data);
      this.addTerms(doc, data);
      this.addFooter(doc, data);

      doc.end();
    });
  }

  /**
   * Add header section with title and reference
   */
  private addHeader(doc: PDFDocumentType, data: QuotationPDFData): void {
    // Blue background rectangle
    doc.rect(0, 0, doc.page.width, 120)
       .fillColor('#1e40af')
       .fill();

    // White text
    doc.fillColor('#ffffff')
       .fontSize(28)
       .font('Helvetica-Bold')
       .text('Insurance Quotation', 54, 30, { align: 'center' });

    doc.fontSize(16)
       .font('Helvetica')
       .text(this.getLOBDisplay(data.lineOfBusiness), 54, 65, { align: 'center' });

    // Reference badge
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .text(data.referenceId, 54, 90, { align: 'center' });

    // Reset color and move down
    doc.fillColor('#000000')
       .moveDown(2);
  }

  /**
   * Add customer information section
   */
  private addCustomerInfo(doc: PDFDocumentType, data: QuotationPDFData): void {
    const startY = doc.y;
    const sectionHeight = 80;

    // Light gray background
    doc.rect(54, startY, doc.page.width - 108, sectionHeight)
       .fillColor('#f8fafc')
       .fill()
       .fillColor('#000000');

    // Section title
    doc.fontSize(16)
       .font('Helvetica-Bold')
       .text('Customer Information', 64, startY + 10);

    // Customer details in 2x2 grid
    const leftX = 64;
    const rightX = (doc.page.width - 54) / 2 + 20;
    const topY = startY + 35;
    const bottomY = startY + 60;

    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#64748b')
       .text('Customer Name', leftX, topY)
       .text('Email Address', leftX, bottomY)
       .text('Business Type', rightX, topY)
       .text('Quote Date', rightX, bottomY);

    doc.fillColor('#1e293b')
       .font('Helvetica-Bold')
       .text(data.customerName, leftX, topY + 15)
       .text(data.customerEmail, leftX, bottomY + 15)
       .text(data.businessType.charAt(0).toUpperCase() + data.businessType.slice(1), rightX, topY + 15)
       .text(this.formatDate(data.createdAt), rightX, bottomY + 15);

    doc.fillColor('#000000')
       .moveDown(2);
  }

  /**
   * Add summary section with total premium, plans count, and validity
   */
  private addSummary(doc: PDFDocumentType, data: QuotationPDFData): void {
    const startY = doc.y;
    const cardWidth = (doc.page.width - 108 - 40) / 3; // 3 cards with spacing
    const cardHeight = 60;

    // Card 1: Total Premium (highlighted green)
    doc.rect(54, startY, cardWidth, cardHeight)
       .fillColor('#10b981')
       .fill()
       .fillColor('#ffffff')
       .fontSize(12)
       .font('Helvetica')
       .text('Total Premium', 64, startY + 10, { width: cardWidth - 20, align: 'center' })
       .fontSize(24)
       .font('Helvetica-Bold')
       .text(this.formatCurrency(data.totalPremium, data.currency), 64, startY + 25, { width: cardWidth - 20, align: 'center' });

    // Card 2: Plans Count
    doc.fillColor('#f1f5f9')
       .rect(64 + cardWidth + 10, startY, cardWidth, cardHeight)
       .fill()
       .fillColor('#000000')
       .fontSize(12)
       .font('Helvetica')
       .text('Plans Included', 74 + cardWidth + 10, startY + 10, { width: cardWidth - 20, align: 'center' })
       .fontSize(24)
       .font('Helvetica-Bold')
       .text(data.plans.length.toString(), 74 + cardWidth + 10, startY + 25, { width: cardWidth - 20, align: 'center' });

    // Card 3: Valid Until
    doc.rect(74 + (cardWidth + 10) * 2, startY, cardWidth, cardHeight)
       .fill()
       .fontSize(12)
       .font('Helvetica')
       .text('Valid Until', 84 + (cardWidth + 10) * 2, startY + 10, { width: cardWidth - 20, align: 'center' })
       .fontSize(16)
       .font('Helvetica-Bold')
       .text(this.formatDate(data.validUntil), 84 + (cardWidth + 10) * 2, startY + 25, { width: cardWidth - 20, align: 'center' });

    doc.fillColor('#000000')
       .moveDown(2);
  }

  /**
   * Add plans section with all plan details
   */
  private addPlans(doc: PDFDocumentType, data: QuotationPDFData): void {
    doc.fontSize(20)
       .font('Helvetica-Bold')
       .text('Insurance Plans', 54, doc.y)
       .moveDown(0.5);

    // Underline
    doc.moveTo(54, doc.y)
       .lineTo(doc.page.width - 54, doc.y)
       .strokeColor('#e2e8f0')
       .lineWidth(2)
       .stroke()
       .moveDown();

    data.plans.forEach((plan, index) => {
      // Check if we need a new page
      if (doc.y > doc.page.height - 200) {
        doc.addPage();
      }

      // Plan card background
      const cardStartY = doc.y;
      const cardHeight = 150;

      doc.rect(54, cardStartY, doc.page.width - 108, cardHeight)
         .fillColor('#ffffff')
         .fill()
         .strokeColor('#e2e8f0')
         .lineWidth(1)
         .stroke()
         .fillColor('#000000');

      // Plan header
      doc.fontSize(18)
         .font('Helvetica-Bold')
         .text(plan.planName, 64, cardStartY + 15);

      doc.fontSize(14)
         .font('Helvetica')
         .fillColor('#64748b')
         .text(plan.vendorName, 64, cardStartY + 35);

      // Plan type badge (right aligned)
      const badgeText = plan.planType.charAt(0).toUpperCase() + plan.planType.slice(1);
      doc.fontSize(12).font('Helvetica-Bold');
      const badgeWidth = doc.widthOfString(badgeText) + 20;
      doc.rect(doc.page.width - 54 - badgeWidth, cardStartY + 15, badgeWidth, 20)
         .fillColor('#dbeafe')
         .fill()
         .fillColor('#1e40af')
         .fontSize(12)
         .font('Helvetica-Bold')
         .text(badgeText, doc.page.width - 54 - badgeWidth + 10, cardStartY + 20);

      // Pricing section (green background)
      doc.fillColor('#f0fdf4')
         .rect(64, cardStartY + 50, doc.page.width - 128, 40)
         .fill()
         .fillColor('#166534')
         .fontSize(12)
         .font('Helvetica')
         .text('Annual Premium', 64, cardStartY + 55, { width: (doc.page.width - 128) / 2, align: 'center' })
         .text('Monthly Premium', 64 + (doc.page.width - 128) / 2, cardStartY + 55, { width: (doc.page.width - 128) / 2, align: 'center' })
         .fillColor('#15803d')
         .fontSize(20)
         .font('Helvetica-Bold')
         .text(this.formatCurrency(plan.annualPremium, data.currency), 64, cardStartY + 70, { width: (doc.page.width - 128) / 2, align: 'center' })
         .text(this.formatCurrency(plan.monthlyPremium, data.currency), 64 + (doc.page.width - 128) / 2, cardStartY + 70, { width: (doc.page.width - 128) / 2, align: 'center' });

      // Plan details
      doc.fillColor('#000000')
         .fontSize(13)
         .font('Helvetica')
         .fillColor('#64748b')
         .text('Annual Limit', 64, cardStartY + 100)
         .text('Deductible', 64 + (doc.page.width - 128) / 2, cardStartY + 100)
         .text('Co-Insurance', 64, cardStartY + 120)
         .text('Waiting Period', 64 + (doc.page.width - 128) / 2, cardStartY + 120)
         .fillColor('#1e293b')
         .font('Helvetica-Bold')
         .text(this.formatCurrency(plan.annualLimit, data.currency), 64, cardStartY + 115)
         .text(this.formatCurrency(plan.deductible, data.currency), 64 + (doc.page.width - 128) / 2, cardStartY + 115)
         .text(`${plan.coInsurance}%`, 64, cardStartY + 135)
         .text(`${plan.waitingPeriod} days`, 64 + (doc.page.width - 128) / 2, cardStartY + 135);

      doc.fillColor('#000000')
         .moveDown(1.5);
    });
  }

  /**
   * Add terms and conditions section
   */
  private addTerms(doc: PDFDocumentType, data: QuotationPDFData): void {
    // Yellow background
    const startY = doc.y;
    doc.rect(54, startY, doc.page.width - 108, 100)
       .fillColor('#fffbeb')
       .fill()
       .fillColor('#000000');

    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#92400e')
       .text('Terms & Conditions', 64, startY + 10);

    const terms = [
      'This quotation is valid until the date mentioned above.',
      'Premiums are subject to underwriting approval.',
      'Coverage is subject to policy terms and conditions.',
      'Pre-existing conditions may affect coverage eligibility.',
      'Please review the full policy document for complete details.'
    ];

    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#78350f');

    // Add terms as bullet points
    let currentY = startY + 30;
    terms.forEach((term) => {
      doc.text('•', 64, currentY)
         .text(term, 80, currentY, { width: doc.page.width - 144 });
      currentY += 15;
    });

    doc.fillColor('#000000')
       .moveDown(2);
  }

  /**
   * Add footer section
   */
  private addFooter(doc: PDFDocumentType, data: QuotationPDFData): void {
    const startY = doc.y;
    
    // Light gray background
    doc.rect(54, startY, doc.page.width - 108, 80)
       .fillColor('#f8fafc')
       .fill()
       .fillColor('#000000');

    doc.fontSize(12)
       .font('Helvetica')
       .fillColor('#64748b')
       .text('Thank you for considering our insurance services.', 64, startY + 10, { align: 'center' })
       .text('For any questions, please contact our support team.', 64, startY + 25, { align: 'center' });

    // Validity date (red)
    doc.fontSize(14)
       .font('Helvetica-Bold')
       .fillColor('#dc2626')
       .text(`This quotation expires on ${this.formatDate(data.validUntil)}`, 64, startY + 45, { align: 'center' });

    // Divider
    doc.moveTo(64, startY + 65)
       .lineTo(doc.page.width - 64, startY + 65)
       .strokeColor('#e2e8f0')
       .lineWidth(1)
       .stroke();

    // Generated info
    doc.fontSize(13)
       .font('Helvetica')
       .fillColor('#475569')
       .text(`Generated on ${this.formatDate(new Date())}`, 64, startY + 70, { align: 'center' })
       .text(`Document Reference: ${data.referenceId}`, 64, startY + 85, { align: 'center' });
  }
}

export const pdfService = new PDFService();
