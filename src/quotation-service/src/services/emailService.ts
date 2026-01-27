/**
 * Email Service for Quotation Service
 */

import * as nodemailer from 'nodemailer';

interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

interface SendQuotationEmailParams {
  to: string;
  cc?: string[];
  customerName: string;
  quotationReference: string;
  pdfBuffer: Buffer;
  customMessage?: string;
  reviewLink?: string;
}

interface SendEmafEmailParams {
  to: string;
  customerName: string;
  quotationReference: string;
  selectedPlanName: string;
  vendorName: string;
  emafLink: string;
}

interface SendPlanSelectionConfirmationParams {
  to: string;
  customerName: string;
  quotationReference: string;
  selectedPlanName: string;
  vendorName: string;
  annualPremium: number;
  currency: string;
}

interface SendEmployeeNotificationParams {
  to: string;
  employeeName: string;
  customerName: string;
  quotationReference: string;
  selectedPlanName: string;
  vendorName: string;
  annualPremium: number;
  currency: string;
  quotationUrl: string;
}

class EmailService {
  private transporter: nodemailer.Transporter | null = null;

  private getConfig(): EmailConfig {
    return {
      host: process.env.EMAIL_HOST || 'sandbox.smtp.mailtrap.io',
      port: parseInt(process.env.EMAIL_PORT || '2525'),
      user: process.env.EMAIL_USER || '',
      pass: process.env.EMAIL_PASS || '',
    };
  }

  private getTransporter(): nodemailer.Transporter {
    if (!this.transporter) {
      const config = this.getConfig();
      
      this.transporter = nodemailer.createTransport({
        host: config.host,
        port: config.port,
        auth: {
          user: config.user,
          pass: config.pass,
        },
      });
    }
    return this.transporter;
  }

  async sendQuotationEmail(params: SendQuotationEmailParams): Promise<void> {
    const { to, cc, customerName, quotationReference, pdfBuffer, customMessage, reviewLink } = params;
    const transporter = this.getTransporter();

    const mailOptions: nodemailer.SendMailOptions = {
      from: '"Insurance Portal" <noreply@insuranceportal.com>',
      to,
      cc: cc && cc.length > 0 ? cc : undefined,
      subject: `Your Insurance Quotation - ${quotationReference}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
            .footer { padding: 20px; text-align: center; color: #6b7280; font-size: 12px; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Your Insurance Quotation</h1>
            </div>
            <div class="content">
              <p>Hello ${customerName},</p>
              <p>Thank you for your interest. Please find your quotation attached.</p>
              ${customMessage ? `<p>${customMessage}</p>` : ''}
              ${reviewLink ? `<p><a href="${reviewLink}" class="button">Review Your Quotation</a></p>` : ''}
            </div>
            <div class="footer">
              <p>This is an automated message. Please do not reply.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${customerName},

Thank you for your interest. Please find your quotation attached.

${customMessage ? customMessage : ''}
${reviewLink ? `Review your quotation: ${reviewLink}` : ''}

This is an automated message. Please do not reply.
      `,
      attachments: [
        {
          filename: `quotation-${quotationReference}.pdf`,
          content: pdfBuffer,
        },
      ],
    };

    await transporter.sendMail(mailOptions);
  }

  async sendEmafEmail(params: SendEmafEmailParams): Promise<void> {
    const { to, customerName, quotationReference, selectedPlanName, vendorName, emafLink } = params;
    const transporter = this.getTransporter();

    const mailOptions: nodemailer.SendMailOptions = {
      from: '"Insurance Portal" <noreply@insuranceportal.com>',
      to,
      subject: `Complete Your Medical Application - ${quotationReference}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Complete Your Medical Application</h1>
            </div>
            <div class="content">
              <p>Hello ${customerName},</p>
              <p>You have selected the <strong>${selectedPlanName}</strong> plan from <strong>${vendorName}</strong>.</p>
              <p>Please complete your medical application form to proceed:</p>
              <p><a href="${emafLink}" class="button">Complete Application Form</a></p>
              <p>If the button doesn't work, copy and paste this link into your browser:</p>
              <p>${emafLink}</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${customerName},

You have selected the ${selectedPlanName} plan from ${vendorName}.

Please complete your medical application form to proceed:
${emafLink}
      `,
    };

    await transporter.sendMail(mailOptions);
  }

  async sendPlanSelectionConfirmation(params: SendPlanSelectionConfirmationParams): Promise<void> {
    const { to, customerName, quotationReference, selectedPlanName, vendorName, annualPremium, currency } = params;
    const transporter = this.getTransporter();

    const mailOptions: nodemailer.SendMailOptions = {
      from: '"Insurance Portal" <noreply@insuranceportal.com>',
      to,
      subject: `Plan Selection Confirmed - ${quotationReference}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #10b981; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>Plan Selection Confirmed</h1>
            </div>
            <div class="content">
              <p>Hello ${customerName},</p>
              <p>Your plan selection has been confirmed:</p>
              <ul>
                <li><strong>Plan:</strong> ${selectedPlanName}</li>
                <li><strong>Vendor:</strong> ${vendorName}</li>
                <li><strong>Annual Premium:</strong> ${currency} ${annualPremium.toLocaleString()}</li>
              </ul>
              <p>Our team will contact you with next steps shortly.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${customerName},

Your plan selection has been confirmed:
- Plan: ${selectedPlanName}
- Vendor: ${vendorName}
- Annual Premium: ${currency} ${annualPremium.toLocaleString()}

Our team will contact you with next steps shortly.
      `,
    };

    await transporter.sendMail(mailOptions);
  }

  async sendEmployeeNotification(params: SendEmployeeNotificationParams): Promise<void> {
    const { to, employeeName, customerName, quotationReference, selectedPlanName, vendorName, annualPremium, currency, quotationUrl } = params;
    const transporter = this.getTransporter();

    const mailOptions: nodemailer.SendMailOptions = {
      from: '"Insurance Portal" <noreply@insuranceportal.com>',
      to,
      subject: `New Plan Selection - ${quotationReference}`,
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
            .header { background-color: #2563eb; color: white; padding: 20px; text-align: center; }
            .content { padding: 20px; background-color: #f9fafb; }
            .button { display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>New Plan Selection</h1>
            </div>
            <div class="content">
              <p>Hello ${employeeName},</p>
              <p>Customer <strong>${customerName}</strong> has selected a plan:</p>
              <ul>
                <li><strong>Quotation:</strong> ${quotationReference}</li>
                <li><strong>Plan:</strong> ${selectedPlanName}</li>
                <li><strong>Vendor:</strong> ${vendorName}</li>
                <li><strong>Annual Premium:</strong> ${currency} ${annualPremium.toLocaleString()}</li>
              </ul>
              <p><a href="${quotationUrl}" class="button">View Quotation</a></p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello ${employeeName},

Customer ${customerName} has selected a plan:
- Quotation: ${quotationReference}
- Plan: ${selectedPlanName}
- Vendor: ${vendorName}
- Annual Premium: ${currency} ${annualPremium.toLocaleString()}

View quotation: ${quotationUrl}
      `,
    };

    await transporter.sendMail(mailOptions);
  }
}

export const emailService = new EmailService();
