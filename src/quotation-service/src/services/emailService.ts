import * as nodemailer from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface SendQuotationEmailParams {
  to: string;
  customerName: string;
  quotationReference: string;
  pdfBuffer: Buffer;
  customMessage?: string;
  reviewLink: string; // Link for customer to review and select a plan
}

class EmailService {
  private getConfig(): EmailConfig {
    const config = {
      host: process.env.EMAIL_HOST || 'sandbox.smtp.mailtrap.io',
      port: parseInt(process.env.EMAIL_PORT || '2525'),
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || '',
    };
    
    if (!config.user || !config.pass) {
      throw new Error('Email credentials not configured. Please set EMAIL_USER and EMAIL_PASS environment variables.');
    }
    
    return config;
  }

  private createTransporter(): nodemailer.Transporter {
    const config = this.getConfig();
    
    return nodemailer.createTransport({
      host: config.host,
      port: config.port,
      auth: {
        user: config.user,
        pass: config.pass,
      },
    });
  }

  async sendQuotationEmail({ 
    to, 
    customerName, 
    quotationReference, 
    pdfBuffer,
    customMessage,
    reviewLink
  }: SendQuotationEmailParams): Promise<void> {
    const transporter = this.createTransporter();

    const messageSection = customMessage 
      ? `
        <div class="custom-message">
          <p style="font-style: italic; color: #374151;">"${customMessage}"</p>
        </div>
      `
      : '';

    const mailOptions = {
      from: '"Insurance Portal" <quotations@insuranceportal.com>',
      to,
      subject: `Your Insurance Quotation - ${quotationReference}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #1f2937;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
              background-color: #f3f4f6;
            }
            .container {
              background-color: #ffffff;
              border-radius: 12px;
              overflow: hidden;
              box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            }
            .header {
              background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
              color: #ffffff;
              padding: 40px 30px;
              text-align: center;
            }
            .header h1 {
              margin: 0;
              font-size: 28px;
              font-weight: 700;
            }
            .header .reference {
              display: inline-block;
              background: rgba(255, 255, 255, 0.2);
              padding: 8px 20px;
              border-radius: 20px;
              margin-top: 15px;
              font-size: 14px;
              font-weight: 600;
            }
            .content {
              padding: 40px 30px;
            }
            .greeting {
              font-size: 18px;
              color: #1e293b;
              margin-bottom: 20px;
            }
            .message {
              color: #4b5563;
              margin: 20px 0;
              line-height: 1.8;
            }
            .custom-message {
              background-color: #f8fafc;
              border-left: 4px solid #3b82f6;
              padding: 15px 20px;
              margin: 25px 0;
              border-radius: 0 8px 8px 0;
            }
            .cta-box {
              background: linear-gradient(135deg, #059669 0%, #10b981 100%);
              border-radius: 12px;
              padding: 30px;
              margin: 30px 0;
              text-align: center;
            }
            .cta-box h3 {
              color: #ffffff;
              font-size: 18px;
              margin: 0 0 10px 0;
            }
            .cta-box p {
              color: rgba(255, 255, 255, 0.9);
              font-size: 14px;
              margin: 0 0 20px 0;
            }
            .cta-button {
              display: inline-block;
              background: #ffffff;
              color: #059669;
              padding: 14px 32px;
              border-radius: 8px;
              text-decoration: none;
              font-weight: 700;
              font-size: 16px;
              box-shadow: 0 4px 14px rgba(0, 0, 0, 0.15);
            }
            .cta-button:hover {
              background: #f0fdf4;
            }
            .highlight-box {
              background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%);
              border: 1px solid #86efac;
              border-radius: 12px;
              padding: 25px;
              margin: 25px 0;
              text-align: center;
            }
            .highlight-box h3 {
              color: #166534;
              font-size: 14px;
              text-transform: uppercase;
              letter-spacing: 1px;
              margin: 0 0 10px 0;
            }
            .highlight-box p {
              color: #15803d;
              font-size: 16px;
              font-weight: 600;
              margin: 0;
            }
            .attachment-notice {
              background-color: #eff6ff;
              border: 1px solid #bfdbfe;
              border-radius: 8px;
              padding: 20px;
              margin: 25px 0;
            }
            .attachment-notice h4 {
              color: #1e40af;
              font-size: 14px;
              margin: 0 0 8px 0;
            }
            .attachment-notice p {
              color: #3b82f6;
              font-size: 13px;
              margin: 0;
            }
            .steps {
              margin: 30px 0;
            }
            .steps h3 {
              color: #1e293b;
              font-size: 16px;
              margin-bottom: 15px;
            }
            .step {
              display: flex;
              align-items: flex-start;
              margin-bottom: 15px;
            }
            .step-number {
              background: #3b82f6;
              color: white;
              width: 28px;
              height: 28px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 14px;
              font-weight: 600;
              margin-right: 15px;
              flex-shrink: 0;
            }
            .step-text {
              color: #4b5563;
              font-size: 14px;
              padding-top: 4px;
            }
            .warning-box {
              background-color: #fef3c7;
              border: 1px solid #fcd34d;
              border-radius: 8px;
              padding: 15px 20px;
              margin: 20px 0;
            }
            .warning-box p {
              color: #92400e;
              font-size: 13px;
              margin: 0;
            }
            .footer {
              background-color: #f8fafc;
              padding: 25px 30px;
              text-align: center;
              border-top: 1px solid #e2e8f0;
            }
            .footer p {
              color: #64748b;
              font-size: 13px;
              margin: 5px 0;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Insurance Quotation</h1>
              <span class="reference">${quotationReference}</span>
            </div>
            
            <div class="content">
              <p class="greeting">Dear ${customerName},</p>
              
              <p class="message">
                Thank you for your interest in our insurance services. We are pleased to provide you with your personalized insurance quotation.
              </p>

              ${messageSection}

              <div class="cta-box">
                <h3>Review & Select Your Plan</h3>
                <p>Click the button below to view your quotation and choose your preferred insurance plan.</p>
                <a href="${reviewLink}" class="cta-button">View Quotation & Select Plan</a>
              </div>

              <div class="warning-box">
                <p><strong>Important:</strong> This link can only be used once. After you select a plan, the link will expire.</p>
              </div>

              <div class="highlight-box">
                <h3>PDF Attached</h3>
                <p>A PDF copy of your quotation is also attached for your records.</p>
              </div>

              <div class="attachment-notice">
                <h4>Attachment</h4>
                <p>Quotation-${quotationReference}.pdf - Contains detailed plan information and pricing</p>
              </div>

              <div class="steps">
                <h3>How to Proceed:</h3>
                <div class="step">
                  <span class="step-number">1</span>
                  <span class="step-text">Click the "View Quotation & Select Plan" button above</span>
                </div>
                <div class="step">
                  <span class="step-number">2</span>
                  <span class="step-text">Review the available plans and their coverage details</span>
                </div>
                <div class="step">
                  <span class="step-number">3</span>
                  <span class="step-text">Select your preferred plan and submit your choice</span>
                </div>
                <div class="step">
                  <span class="step-number">4</span>
                  <span class="step-text">Our team will review and process your selection</span>
                </div>
              </div>

              <p class="message">
                If you have any questions about the quotation or need any clarification, please don't hesitate to reach out to us. Our team is here to help you find the best coverage for your needs.
              </p>
            </div>
            
            <div class="footer">
              <p>This is an automated message from Insurance Portal.</p>
              <p>Please do not reply directly to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Insurance Portal. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Dear ${customerName},

Thank you for your interest in our insurance services. We are pleased to provide you with your personalized insurance quotation.

${customMessage ? `Message from our team: "${customMessage}"\n` : ''}

REVIEW & SELECT YOUR PLAN
--------------------------
Reference: ${quotationReference}

To view your quotation and select your preferred plan, please visit:
${reviewLink}

IMPORTANT: This link can only be used once. After you select a plan, the link will expire.

A PDF copy of your quotation is also attached for your records.

HOW TO PROCEED:
1. Click the link above to view your quotation
2. Review the available plans and their coverage details
3. Select your preferred plan and submit your choice
4. Our team will review and process your selection

If you have any questions about the quotation or need any clarification, please don't hesitate to reach out to us.

Best regards,
Insurance Portal Team
      `,
      attachments: [
        {
          filename: `Quotation-${quotationReference}.pdf`,
          content: pdfBuffer,
        },
      ],
    };

    await transporter.sendMail(mailOptions);
  }
}

export const emailService = new EmailService();
