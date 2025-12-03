import * as nodemailer from 'nodemailer';

export interface EmailConfig {
  host: string;
  port: number;
  user: string;
  pass: string;
}

export interface SendOTPEmailParams {
  to: string;
  otp: string;
  customerName?: string;
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

  async sendOTPEmail({ to, otp, customerName }: SendOTPEmailParams): Promise<void> {
    const transporter = this.getTransporter();

    const mailOptions = {
      from: '"Customer Portal" <noreply@customerportal.com>',
      to,
      subject: 'Your One-Time Password (OTP)',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #2563eb;
              margin: 0;
              font-size: 28px;
            }
            .otp-box {
              background-color: #f3f4f6;
              border: 2px dashed #2563eb;
              border-radius: 8px;
              padding: 20px;
              text-align: center;
              margin: 30px 0;
            }
            .otp-code {
              font-size: 36px;
              font-weight: bold;
              color: #2563eb;
              letter-spacing: 8px;
              font-family: 'Courier New', monospace;
            }
            .message {
              color: #4b5563;
              margin: 20px 0;
              line-height: 1.8;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
              text-align: center;
            }
            .warning {
              background-color: #fef3c7;
              border-left: 4px solid #f59e0b;
              padding: 12px;
              margin: 20px 0;
              font-size: 14px;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🔐 Customer Portal</h1>
            </div>
            
            <p class="message">
              Hello${customerName ? ` ${customerName}` : ''},
            </p>
            
            <p class="message">
              You requested to log in to your account. Please use the following One-Time Password (OTP) to complete your login:
            </p>
            
            <div class="otp-box">
              <div class="otp-code">${otp}</div>
            </div>
            
            <p class="message">
              This code is valid for <strong>5 minutes</strong>. Please do not share this code with anyone.
            </p>
            
            <div class="warning">
              <strong>⚠️ Security Notice:</strong> If you didn't request this code, please ignore this email and ensure your account is secure.
            </div>
            
            <div class="footer">
              <p>This is an automated message, please do not reply to this email.</p>
              <p>&copy; ${new Date().getFullYear()} Customer Portal. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Hello${customerName ? ` ${customerName}` : ''},

You requested to log in to your account. Please use the following One-Time Password (OTP):

${otp}

This code is valid for 5 minutes. Please do not share this code with anyone.

If you didn't request this code, please ignore this email.

- Customer Portal Team
      `,
    };

    await transporter.sendMail(mailOptions);
  }

  async sendWelcomeEmail(to: string, customerName: string): Promise<void> {
    const transporter = this.getTransporter();

    const mailOptions = {
      from: '"Customer Portal" <noreply@customerportal.com>',
      to,
      subject: 'Welcome to Customer Portal',
      html: `
        <!DOCTYPE html>
        <html>
        <head>
          <style>
            body {
              font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
              line-height: 1.6;
              color: #333;
              max-width: 600px;
              margin: 0 auto;
              padding: 20px;
            }
            .container {
              background-color: #ffffff;
              border-radius: 8px;
              padding: 40px;
              box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
            }
            .header {
              text-align: center;
              margin-bottom: 30px;
            }
            .header h1 {
              color: #2563eb;
              margin: 0;
              font-size: 28px;
            }
            .message {
              color: #4b5563;
              margin: 20px 0;
              line-height: 1.8;
            }
            .cta-button {
              display: inline-block;
              background-color: #2563eb;
              color: #ffffff;
              padding: 12px 30px;
              text-decoration: none;
              border-radius: 6px;
              margin: 20px 0;
              font-weight: 600;
            }
            .footer {
              margin-top: 40px;
              padding-top: 20px;
              border-top: 1px solid #e5e7eb;
              color: #6b7280;
              font-size: 14px;
              text-align: center;
            }
          </style>
        </head>
        <body>
          <div class="container">
            <div class="header">
              <h1>🎉 Welcome to Customer Portal!</h1>
            </div>
            
            <p class="message">
              Hello ${customerName},
            </p>
            
            <p class="message">
              Thank you for signing up! Your account has been successfully created.
            </p>
            
            <p class="message">
              You can now log in to access your dashboard, manage your profile, and upload documents securely.
            </p>
            
            <div style="text-align: center;">
              <a href="#" class="cta-button">Get Started</a>
            </div>
            
            <div class="footer">
              <p>Need help? Contact our support team anytime.</p>
              <p>&copy; ${new Date().getFullYear()} Customer Portal. All rights reserved.</p>
            </div>
          </div>
        </body>
        </html>
      `,
      text: `
Welcome to Customer Portal!

Hello ${customerName},

Thank you for signing up! Your account has been successfully created.

You can now log in to access your dashboard, manage your profile, and upload documents securely.

- Customer Portal Team
      `,
    };

    await transporter.sendMail(mailOptions);
  }
}

export const emailService = new EmailService();

