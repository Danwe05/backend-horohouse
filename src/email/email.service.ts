import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

interface SendMailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Send a welcome email to a newly registered user
   */
  async sendWelcomeEmail(recipientEmail: string, recipientName?: string): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');

    const displayName = recipientName?.trim() || 'there';
    const subject = `Welcome to ${brandName}!`;
    const text = `Hi ${displayName},\n\nWelcome to ${brandName}! Your account has been created successfully.\n\nGet started here: ${frontendUrl}\n\nIf you have any questions, just reply to this email.\n\n— The ${brandName} Team`;
    const html = this.buildWelcomeTemplate({ brandName, recipientName: displayName, frontendUrl });

    await this.safeSendMail({ to: recipientEmail, subject, html, text });
  }

  /**
   * Send email verification email
   */
  async sendEmailVerification(recipientEmail: string, recipientName: string, verificationToken: string): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');
    const apiUrl = this.configService.get<string>('API_URL', 'http://localhost:4000');

    const verificationUrl = `${apiUrl}/api/v1/auth/verify-email?token=${verificationToken}`;
    
    const displayName = recipientName?.trim() || 'there';
    const subject = `Verify your email address - ${brandName}`;
    const text = `Hi ${displayName},\n\nPlease verify your email address by clicking the link below:\n\n${verificationUrl}\n\nThis link will expire in 24 hours.\n\nIf you didn't create an account with ${brandName}, you can safely ignore this email.\n\n— The ${brandName} Team`;
    const html = this.buildVerificationTemplate({ 
      brandName, 
      recipientName: displayName, 
      verificationUrl,
      frontendUrl 
    });

    await this.safeSendMail({ to: recipientEmail, subject, html, text });
  }

  /**
   * Send onboarding welcome email
   */
  async sendOnboardingWelcome(recipientEmail: string, recipientName: string, onboardingUrl: string): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');

    const displayName = recipientName?.trim() || 'there';
    const subject = `Complete Your ${brandName} Profile - Let's Get Started!`;
    const text = `Hi ${displayName},\n\nWelcome to ${brandName}! Your account has been created successfully.\n\nTo get the most out of ${brandName}, please complete your profile setup:\n\n${onboardingUrl}\n\nThis will help us personalize your experience and show you the best properties.\n\n— The ${brandName} Team`;
    const html = this.buildOnboardingWelcomeTemplate({ 
      brandName, 
      recipientName: displayName, 
      onboardingUrl,
      frontendUrl 
    });

    await this.safeSendMail({ to: recipientEmail, subject, html, text });
  }

  /**
   * Send onboarding completion email
   */
  async sendOnboardingComplete(recipientEmail: string, recipientName: string, userRole: string): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3001');

    const displayName = recipientName?.trim() || 'there';
    const subject = `Welcome to ${brandName} - You're All Set!`;
    const text = `Hi ${displayName},\n\nCongratulations! Your ${brandName} profile is now complete.\n\nAs a ${userRole}, you can now:\n- Browse and search properties\n- Save favorites and get notifications\n- Contact agents and schedule viewings\n- Manage your preferences\n\nGet started here: ${frontendUrl}\n\n— The ${brandName} Team`;
    const html = this.buildOnboardingCompleteTemplate({ 
      brandName, 
      recipientName: displayName, 
      userRole,
      frontendUrl 
    });

    await this.safeSendMail({ to: recipientEmail, subject, html, text });
  }

  private async safeSendMail(options: SendMailOptions): Promise<void> {
    try {
      const transporter = await this.createTransport();
      const fromAddress = this.configService.get<string>('EMAIL_FROM', 'HoroHouse <no-reply@horohouse.com>');

      const info = await transporter.sendMail({
        from: fromAddress,
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      if (nodemailer.getTestMessageUrl && (info as any)?.messageId) {
        const previewUrl = nodemailer.getTestMessageUrl(info);
        if (previewUrl) {
          this.logger.log(`Preview email at: ${previewUrl}`);
        }
      }
    } catch (error) {
      this.logger.error('Failed to send email', error as Error);
    }
  }

  private async createTransport(): Promise<nodemailer.Transporter> {
    const host = this.configService.get<string>('SMTP_HOST');
    const port = this.configService.get<number>('SMTP_PORT' as any);
    const secure = this.configService.get<string>('SMTP_SECURE', 'false') === 'true';
    const user = this.configService.get<string>('SMTP_USER');
    const pass = this.configService.get<string>('SMTP_PASS');

    if (host && port && user && pass) {
      return nodemailer.createTransport({
        host,
        port: Number(port),
        secure,
        auth: { user, pass },
      });
    }

    const testAccount = await nodemailer.createTestAccount();
    this.logger.warn('SMTP not configured. Using Ethereal test account for emails.');
    return nodemailer.createTransport({
      host: 'smtp.ethereal.email',
      port: 587,
      secure: false,
      auth: {
        user: testAccount.user,
        pass: testAccount.pass,
      },
    });
  }

  private buildWelcomeTemplate(params: { brandName: string; recipientName: string; frontendUrl: string }): string {
    const { brandName, recipientName, frontendUrl } = params;
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; background-color: #f6f9fc; padding: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 24px; background: #0f172a; color: #ffffff;">
              <h1 style="margin: 0; font-size: 20px;">${brandName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px; color: #0f172a;">
              <h2 style="margin-top: 0;">Welcome, ${recipientName}!</h2>
              <p style="line-height: 1.6; margin: 16px 0;">
                We're excited to have you on board. Your ${brandName} account is ready.
              </p>
              <p style="line-height: 1.6; margin: 16px 0;">
                Start exploring properties, saving favorites, and managing your listings.
              </p>
              <div style="margin-top: 24px;">
                <a href="${frontendUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 16px; border-radius: 6px;">Get Started</a>
              </div>
              <p style="line-height: 1.6; margin: 24px 0 0; color: #475569;">
                If you have any questions, just reply to this email. We're here to help.
              </p>
              <p style="line-height: 1.6; margin: 8px 0 0;">— The ${brandName} Team</p>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  private buildVerificationTemplate(params: { brandName: string; recipientName: string; verificationUrl: string; frontendUrl: string }): string {
    const { brandName, recipientName, verificationUrl, frontendUrl } = params;
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; background-color: #f6f9fc; padding: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 24px; background: #0f172a; color: #ffffff;">
              <h1 style="margin: 0; font-size: 20px;">${brandName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px; color: #0f172a;">
              <h2 style="margin-top: 0;">Verify your email address</h2>
              <p style="line-height: 1.6; margin: 16px 0;">
                Hi ${recipientName},
              </p>
              <p style="line-height: 1.6; margin: 16px 0;">
                Please verify your email address by clicking the button below. This helps us ensure your account is secure.
              </p>
              <div style="margin-top: 24px;">
                <a href="${verificationUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 16px; border-radius: 6px;">Verify Email Address</a>
              </div>
              <p style="line-height: 1.6; margin: 16px 0; font-size: 14px; color: #475569;">
                This verification link will expire in 24 hours.
              </p>
              <p style="line-height: 1.6; margin: 16px 0; font-size: 14px; color: #475569;">
                If the button doesn't work, copy and paste this link into your browser:
              </p>
              <p style="line-height: 1.6; margin: 8px 0; font-size: 14px; color: #2563eb; word-break: break-all;">
                ${verificationUrl}
              </p>
              <p style="line-height: 1.6; margin: 24px 0 0; color: #475569;">
                If you didn't create an account with ${brandName}, you can safely ignore this email.
              </p>
              <p style="line-height: 1.6; margin: 8px 0 0;">— The ${brandName} Team</p>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  private buildOnboardingWelcomeTemplate(params: { brandName: string; recipientName: string; onboardingUrl: string; frontendUrl: string }): string {
    const { brandName, recipientName, onboardingUrl, frontendUrl } = params;
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; background-color: #f6f9fc; padding: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 24px; background: #0f172a; color: #ffffff;">
              <h1 style="margin: 0; font-size: 20px;">${brandName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px; color: #0f172a;">
              <h2 style="margin-top: 0;">Complete Your Profile Setup</h2>
              <p style="line-height: 1.6; margin: 16px 0;">
                Hi ${recipientName},
              </p>
              <p style="line-height: 1.6; margin: 16px 0;">
                Welcome to ${brandName}! Your account has been created successfully. To get the most out of our platform, please complete your profile setup.
              </p>
              <p style="line-height: 1.6; margin: 16px 0;">
                This will help us personalize your experience and show you the best properties that match your preferences.
              </p>
              <div style="margin-top: 24px;">
                <a href="${onboardingUrl}" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 16px; border-radius: 6px;">Complete Profile Setup</a>
              </div>
              <p style="line-height: 1.6; margin: 24px 0 0; color: #475569;">
                The setup only takes a few minutes and will unlock all features of ${brandName}.
              </p>
              <p style="line-height: 1.6; margin: 8px 0 0;">— The ${brandName} Team</p>
            </td>
          </tr>
        </table>
      </div>
    `;
  }

  private buildOnboardingCompleteTemplate(params: { brandName: string; recipientName: string; userRole: string; frontendUrl: string }): string {
    const { brandName, recipientName, userRole, frontendUrl } = params;
    return `
      <div style="font-family: Arial, Helvetica, sans-serif; background-color: #f6f9fc; padding: 24px;">
        <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="max-width: 640px; margin: 0 auto; background: #ffffff; border-radius: 8px; overflow: hidden;">
          <tr>
            <td style="padding: 24px; background: #0f172a; color: #ffffff;">
              <h1 style="margin: 0; font-size: 20px;">${brandName}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding: 24px; color: #0f172a;">
              <h2 style="margin-top: 0;">🎉 You're All Set!</h2>
              <p style="line-height: 1.6; margin: 16px 0;">
                Hi ${recipientName},
              </p>
              <p style="line-height: 1.6; margin: 16px 0;">
                Congratulations! Your ${brandName} profile is now complete. As a ${userRole}, you can now:
              </p>
              <ul style="line-height: 1.6; margin: 16px 0; padding-left: 20px;">
                <li>Browse and search properties</li>
                <li>Save favorites and get notifications</li>
                <li>Contact agents and schedule viewings</li>
                <li>Manage your preferences</li>
              </ul>
              <div style="margin-top: 24px;">
                <a href="${frontendUrl}" style="display: inline-block; background: #10b981; color: #ffffff; text-decoration: none; padding: 12px 16px; border-radius: 6px;">Start Exploring</a>
              </div>
              <p style="line-height: 1.6; margin: 24px 0 0; color: #475569;">
                If you have any questions, our support team is here to help!
              </p>
              <p style="line-height: 1.6; margin: 8px 0 0;">— The ${brandName} Team</p>
            </td>
          </tr>
        </table>
      </div>
    `;
  }
}


