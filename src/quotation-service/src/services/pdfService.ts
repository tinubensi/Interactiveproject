import puppeteer from 'puppeteer';
import { QuotationPlan } from '../models/quotation';

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
   * Generate a PDF for a quotation
   */
  async generateQuotationPDF(data: QuotationPDFData): Promise<Buffer> {
    const html = this.generateHTML(data);
    
    const browser = await puppeteer.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu'
      ]
    });

    try {
      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'networkidle0' });
      
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        margin: {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        }
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await browser.close();
    }
  }

  /**
   * Generate HTML template for the quotation PDF
   */
  private generateHTML(data: QuotationPDFData): string {
    const formatCurrency = (amount: number) => {
      return `${data.currency} ${amount.toLocaleString()}`;
    };

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
      });
    };

    const getLOBDisplay = (lob: string) => {
      const labels: { [key: string]: string } = {
        medical: 'Medical Insurance',
        motor: 'Motor Insurance',
        general: 'General Insurance',
        marine: 'Marine Insurance',
      };
      return labels[lob] || lob;
    };

    const plansHTML = data.plans.map((plan, index) => `
      <div class="plan-card">
        <div class="plan-header">
          <div class="plan-title">
            <h3>${plan.planName}</h3>
            <span class="vendor">${plan.vendorName}</span>
          </div>
          <span class="plan-type">${plan.planType}</span>
        </div>
        
        <div class="plan-pricing">
          <div class="price-item main">
            <span class="label">Annual Premium</span>
            <span class="value">${formatCurrency(plan.annualPremium)}</span>
          </div>
          <div class="price-item">
            <span class="label">Monthly Premium</span>
            <span class="value">${formatCurrency(plan.monthlyPremium)}</span>
          </div>
        </div>

        <div class="plan-details">
          <div class="detail-row">
            <div class="detail-item">
              <span class="label">Annual Limit</span>
              <span class="value">${formatCurrency(plan.annualLimit)}</span>
            </div>
            <div class="detail-item">
              <span class="label">Deductible</span>
              <span class="value">${formatCurrency(plan.deductible)}</span>
            </div>
          </div>
          <div class="detail-row">
            <div class="detail-item">
              <span class="label">Co-Insurance</span>
              <span class="value">${plan.coInsurance}%</span>
            </div>
            <div class="detail-item">
              <span class="label">Waiting Period</span>
              <span class="value">${plan.waitingPeriod} days</span>
            </div>
          </div>
        </div>
      </div>
    `).join('');

    return `
      <!DOCTYPE html>
      <html lang="en">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Insurance Quotation - ${data.referenceId}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, Roboto, 'Helvetica Neue', Arial, sans-serif;
            line-height: 1.6;
            color: #1f2937;
            background-color: #ffffff;
          }

          .container {
            max-width: 800px;
            margin: 0 auto;
            padding: 0;
          }

          /* Header */
          .header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
            padding: 40px;
            text-align: center;
            border-radius: 0 0 20px 20px;
          }

          .header h1 {
            font-size: 28px;
            font-weight: 700;
            margin-bottom: 8px;
          }

          .header .subtitle {
            font-size: 16px;
            opacity: 0.9;
          }

          .reference-badge {
            display: inline-block;
            background: rgba(255, 255, 255, 0.2);
            padding: 8px 20px;
            border-radius: 20px;
            margin-top: 16px;
            font-weight: 600;
            font-size: 14px;
          }

          /* Customer Info Section */
          .customer-section {
            padding: 30px 40px;
            background: #f8fafc;
            border-bottom: 1px solid #e2e8f0;
          }

          .customer-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 20px;
          }

          .customer-item {
            display: flex;
            flex-direction: column;
          }

          .customer-item .label {
            font-size: 12px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
          }

          .customer-item .value {
            font-size: 15px;
            font-weight: 600;
            color: #1e293b;
          }

          /* Summary Section */
          .summary-section {
            padding: 30px 40px;
            background: white;
          }

          .summary-grid {
            display: grid;
            grid-template-columns: repeat(3, 1fr);
            gap: 20px;
          }

          .summary-card {
            background: #f1f5f9;
            padding: 20px;
            border-radius: 12px;
            text-align: center;
          }

          .summary-card.highlight {
            background: linear-gradient(135deg, #10b981 0%, #059669 100%);
            color: white;
          }

          .summary-card .label {
            font-size: 12px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 8px;
          }

          .summary-card .value {
            font-size: 24px;
            font-weight: 700;
          }

          .summary-card.highlight .label {
            opacity: 0.9;
          }

          /* Plans Section */
          .plans-section {
            padding: 30px 40px;
          }

          .section-title {
            font-size: 20px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 20px;
            padding-bottom: 10px;
            border-bottom: 2px solid #e2e8f0;
          }

          .plan-card {
            background: white;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            margin-bottom: 20px;
            overflow: hidden;
            page-break-inside: avoid;
          }

          .plan-header {
            background: #f8fafc;
            padding: 20px;
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            border-bottom: 1px solid #e2e8f0;
          }

          .plan-title h3 {
            font-size: 18px;
            font-weight: 700;
            color: #1e293b;
            margin-bottom: 4px;
          }

          .plan-title .vendor {
            font-size: 14px;
            color: #64748b;
          }

          .plan-type {
            background: #dbeafe;
            color: #1e40af;
            padding: 6px 14px;
            border-radius: 20px;
            font-size: 12px;
            font-weight: 600;
            text-transform: capitalize;
          }

          .plan-pricing {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            padding: 20px;
            background: #f0fdf4;
            border-bottom: 1px solid #e2e8f0;
          }

          .price-item {
            text-align: center;
            padding: 10px;
          }

          .price-item .label {
            font-size: 12px;
            color: #166534;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            margin-bottom: 4px;
            display: block;
          }

          .price-item .value {
            font-size: 20px;
            font-weight: 700;
            color: #15803d;
          }

          .price-item.main .value {
            font-size: 24px;
          }

          .plan-details {
            padding: 20px;
          }

          .detail-row {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
            margin-bottom: 15px;
          }

          .detail-row:last-child {
            margin-bottom: 0;
          }

          .detail-item {
            display: flex;
            justify-content: space-between;
            padding: 10px 15px;
            background: #f8fafc;
            border-radius: 8px;
          }

          .detail-item .label {
            font-size: 13px;
            color: #64748b;
          }

          .detail-item .value {
            font-size: 14px;
            font-weight: 600;
            color: #1e293b;
          }

          /* Footer */
          .footer {
            padding: 30px 40px;
            background: #f8fafc;
            text-align: center;
            border-top: 1px solid #e2e8f0;
          }

          .footer p {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 5px;
          }

          .footer .validity {
            font-size: 14px;
            font-weight: 600;
            color: #dc2626;
            margin-top: 15px;
          }

          .footer .contact {
            margin-top: 20px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
          }

          .footer .contact p {
            font-size: 13px;
            color: #475569;
          }

          /* Terms */
          .terms-section {
            padding: 20px 40px;
            background: #fffbeb;
            border-top: 1px solid #fde68a;
          }

          .terms-section h4 {
            font-size: 14px;
            font-weight: 600;
            color: #92400e;
            margin-bottom: 10px;
          }

          .terms-section ul {
            padding-left: 20px;
          }

          .terms-section li {
            font-size: 12px;
            color: #78350f;
            margin-bottom: 5px;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <!-- Header -->
          <div class="header">
            <h1>Insurance Quotation</h1>
            <p class="subtitle">${getLOBDisplay(data.lineOfBusiness)}</p>
            <span class="reference-badge">${data.referenceId}</span>
          </div>

          <!-- Customer Information -->
          <div class="customer-section">
            <div class="customer-grid">
              <div class="customer-item">
                <span class="label">Customer Name</span>
                <span class="value">${data.customerName}</span>
              </div>
              <div class="customer-item">
                <span class="label">Email Address</span>
                <span class="value">${data.customerEmail}</span>
              </div>
              <div class="customer-item">
                <span class="label">Business Type</span>
                <span class="value" style="text-transform: capitalize;">${data.businessType}</span>
              </div>
              <div class="customer-item">
                <span class="label">Quote Date</span>
                <span class="value">${formatDate(data.createdAt)}</span>
              </div>
            </div>
          </div>

          <!-- Summary -->
          <div class="summary-section">
            <div class="summary-grid">
              <div class="summary-card highlight">
                <div class="label">Total Premium</div>
                <div class="value">${formatCurrency(data.totalPremium)}</div>
              </div>
              <div class="summary-card">
                <div class="label">Plans Included</div>
                <div class="value">${data.plans.length}</div>
              </div>
              <div class="summary-card">
                <div class="label">Valid Until</div>
                <div class="value" style="font-size: 16px;">${formatDate(data.validUntil)}</div>
              </div>
            </div>
          </div>

          <!-- Plans -->
          <div class="plans-section">
            <h2 class="section-title">Insurance Plans</h2>
            ${plansHTML}
          </div>

          <!-- Terms -->
          <div class="terms-section">
            <h4>Terms & Conditions</h4>
            <ul>
              <li>This quotation is valid until the date mentioned above.</li>
              <li>Premiums are subject to underwriting approval.</li>
              <li>Coverage is subject to policy terms and conditions.</li>
              <li>Pre-existing conditions may affect coverage eligibility.</li>
              <li>Please review the full policy document for complete details.</li>
            </ul>
          </div>

          <!-- Footer -->
          <div class="footer">
            <p>Thank you for considering our insurance services.</p>
            <p>For any questions, please contact our support team.</p>
            <p class="validity">This quotation expires on ${formatDate(data.validUntil)}</p>
            <div class="contact">
              <p>Generated on ${formatDate(new Date())}</p>
              <p>Document Reference: ${data.referenceId}</p>
            </div>
          </div>
        </div>
      </body>
      </html>
    `;
  }
}

export const pdfService = new PDFService();

