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

  constructor(private readonly configService: ConfigService) { }

  /**
   * Send a welcome email to a newly registered user
   */
  async sendWelcomeEmail(recipientEmail: string, recipientName?: string): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const displayName = recipientName?.trim() || 'there';
    const subject = `Welcome to ${brandName}!`;
    const text = `Hi ${displayName},\n\nWelcome to ${brandName}! Your account has been created successfully.\n\nGet started here: ${frontendUrl}\n\nIf you have any questions, just reply to this email.\n\n— The ${brandName} Team`;
    const html = this.buildWelcomeTemplate({ brandName, recipientName: displayName, frontendUrl });

    await this.safeSendMail({ to: recipientEmail, subject, html, text });
  }

  /**
   * Send password reset email with reset link
   */
  async sendPasswordResetEmail(
    recipientEmail: string,
    recipientName: string,
    resetToken: string
  ): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    // Create reset URL pointing to frontend
    const resetUrl = `${frontendUrl}/auth/reset-password?token=${resetToken}`;

    const displayName = recipientName?.trim() || 'there';
    const subject = `Reset Your ${brandName} Password`;
    const text = `Hi ${displayName},\n\nWe received a request to reset your password for your ${brandName} account.\n\nClick the link below to reset your password:\n\n${resetUrl}\n\nThis link will expire in 1 hour.\n\nIf you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.\n\nFor security reasons, this link can only be used once.\n\n— The ${brandName} Team`;
    const html = this.buildPasswordResetTemplate({
      brandName,
      recipientName: displayName,
      resetUrl,
      frontendUrl
    });

    await this.safeSendMail({ to: recipientEmail, subject, html, text });
  }

  /**
   * Send password reset confirmation email
   */
  async sendPasswordResetConfirmation(
    recipientEmail: string,
    recipientName: string
  ): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const displayName = recipientName?.trim() || 'there';
    const subject = `Your ${brandName} Password Has Been Reset`;
    const text = `Hi ${displayName},\n\nThis is a confirmation that your ${brandName} password has been successfully reset.\n\nIf you did not make this change, please contact our support team immediately.\n\nSign in to your account: ${frontendUrl}/auth/signin\n\n— The ${brandName} Team`;
    const html = this.buildPasswordResetConfirmationTemplate({
      brandName,
      recipientName: displayName,
      frontendUrl
    });

    await this.safeSendMail({ to: recipientEmail, subject, html, text });
  }

  /**
   * Password reset email template
   */
  private buildPasswordResetTemplate(params: {
    brandName: string;
    recipientName: string;
    resetUrl: string;
    frontendUrl: string
  }): string {
    const { brandName, recipientName, resetUrl, frontendUrl } = params;
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
            <h2 style="margin-top: 0;">Reset Your Password</h2>
            <p style="line-height: 1.6; margin: 16px 0;">
              Hi ${recipientName},
            </p>
            <p style="line-height: 1.6; margin: 16px 0;">
              We received a request to reset your password for your ${brandName} account. Click the button below to create a new password.
            </p>
            <div style="margin-top: 24px;">
              <a href="${resetUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">Reset Password</a>
            </div>
            <p style="line-height: 1.6; margin: 16px 0; font-size: 14px; color: #475569;">
              This link will expire in <strong>1 hour</strong> for security reasons.
            </p>
            <p style="line-height: 1.6; margin: 16px 0; font-size: 14px; color: #475569;">
              If the button doesn't work, copy and paste this link into your browser:
            </p>
            <p style="line-height: 1.6; margin: 8px 0; font-size: 14px; color: #2563eb; word-break: break-all;">
              ${resetUrl}
            </p>
            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
              <p style="line-height: 1.6; margin: 0; font-size: 14px; color: #475569;">
                <strong>Didn't request this?</strong>
              </p>
              <p style="line-height: 1.6; margin: 8px 0 0; font-size: 14px; color: #475569;">
                If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.
              </p>
            </div>
            <p style="line-height: 1.6; margin: 24px 0 0;">— The ${brandName} Team</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 24px; background: #f8fafc; color: #64748b; font-size: 12px; text-align: center;">
            <p style="margin: 0;">
              For security, this link can only be used once and expires in 1 hour.
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;
  }

  /**
   * Password reset confirmation email template
   */
  private buildPasswordResetConfirmationTemplate(params: {
    brandName: string;
    recipientName: string;
    frontendUrl: string
  }): string {
    const { brandName, recipientName, frontendUrl } = params;
    const loginUrl = `${frontendUrl}/auth/signin`;

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
            <div style="text-align: center; margin-bottom: 24px;">
              <div style="display: inline-block; background: #10b981; color: #ffffff; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 32px;">
                ✓
              </div>
            </div>
            <h2 style="margin-top: 0; text-align: center;">Password Successfully Reset</h2>
            <p style="line-height: 1.6; margin: 16px 0;">
              Hi ${recipientName},
            </p>
            <p style="line-height: 1.6; margin: 16px 0;">
              This is a confirmation that your ${brandName} password has been successfully reset.
            </p>
            <p style="line-height: 1.6; margin: 16px 0;">
              You can now sign in to your account using your new password.
            </p>
            <div style="margin-top: 24px; text-align: center;">
              <a href="${loginUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600;">Sign In Now</a>
            </div>
            <div style="margin-top: 32px; padding: 16px; background: #fef2f2; border-left: 4px solid #ef4444; border-radius: 4px;">
              <p style="line-height: 1.6; margin: 0; font-size: 14px; color: #991b1b;">
                <strong>⚠️ Security Alert</strong>
              </p>
              <p style="line-height: 1.6; margin: 8px 0 0; font-size: 14px; color: #991b1b;">
                If you did not make this change, please contact our support team immediately to secure your account.
              </p>
            </div>
            <p style="line-height: 1.6; margin: 24px 0 0;">— The ${brandName} Team</p>
          </td>
        </tr>
      </table>
    </div>
  `;
  }

  /**
   * Send saved search notification email with new property matches
   */
  async sendSavedSearchNotification(
    recipientEmail: string,
    recipientName: string,
    searchName: string,
    newProperties: any[],
    searchId: string,
  ): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    const displayName = recipientName?.trim() || 'there';
    const propertyCount = newProperties.length;
    const subject = `${propertyCount} New ${propertyCount === 1 ? 'Property' : 'Properties'} Match Your "${searchName}" Search`;

    const searchUrl = `${frontendUrl}/saved-searches/${searchId}`;
    const manageSearchesUrl = `${frontendUrl}/saved-searches`;

    // Build property list for text email
    const propertyList = newProperties
      .map((prop, index) =>
        `${index + 1}. ${prop.title}\n   ${prop.type} - ${prop.listingType}\n   ${prop.city}, ${prop.state}\n   Price: ${prop.currency || 'XAF'} ${prop.price.toLocaleString()}\n   View: ${frontendUrl}/properties/${prop._id}`
      )
      .join('\n\n');

    const text = `Hi ${displayName},\n\nWe found ${propertyCount} new ${propertyCount === 1 ? 'property' : 'properties'} matching your saved search "${searchName}"!\n\n${propertyList}\n\nView all matching properties: ${searchUrl}\n\nManage your saved searches: ${manageSearchesUrl}\n\nTo stop receiving notifications for this search, visit the link above and adjust your notification settings.\n\n— The ${brandName} Team`;

    const html = this.buildSavedSearchNotificationTemplate({
      brandName,
      recipientName: displayName,
      searchName,
      newProperties,
      searchUrl,
      manageSearchesUrl,
      frontendUrl,
    });

    await this.safeSendMail({ to: recipientEmail, subject, html, text });
  }

  /**
   * Saved search notification email template
   */
  private buildSavedSearchNotificationTemplate(params: {
    brandName: string;
    recipientName: string;
    searchName: string;
    newProperties: any[];
    searchUrl: string;
    manageSearchesUrl: string;
    frontendUrl: string;
  }): string {
    const { brandName, recipientName, searchName, newProperties, searchUrl, manageSearchesUrl, frontendUrl } = params;

    const propertyCount = newProperties.length;
    const propertiesHtml = newProperties
      .map(
        (prop) => `
        <div style="border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px; margin-bottom: 16px; background: #f8fafc;">
          <h3 style="margin: 0 0 8px; font-size: 16px; color: #0f172a;">
            <a href="${frontendUrl}/properties/${prop._id}" style="color: #2563eb; text-decoration: none;">${prop.title}</a>
          </h3>
          <p style="margin: 4px 0; font-size: 14px; color: #64748b;">
            <strong>${prop.type}</strong> • ${prop.listingType}
          </p>
          <p style="margin: 4px 0; font-size: 14px; color: #64748b;">
            📍 ${prop.city}, ${prop.state || ''}
          </p>
          <p style="margin: 8px 0 0; font-size: 18px; font-weight: 600; color: #10b981;">
            ${prop.currency || 'XAF'} ${prop.price.toLocaleString()}
          </p>
          ${prop.amenities?.bedrooms || prop.amenities?.bathrooms ? `
            <p style="margin: 8px 0 0; font-size: 14px; color: #64748b;">
              ${prop.amenities.bedrooms ? `🛏️ ${prop.amenities.bedrooms} bed` : ''} 
              ${prop.amenities.bathrooms ? `🚿 ${prop.amenities.bathrooms} bath` : ''}
            </p>
          ` : ''}
        </div>
      `
      )
      .join('');

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
            <div style="text-align: center; margin-bottom: 16px;">
              <div style="display: inline-block; background: #10b981; color: #ffffff; border-radius: 50%; width: 56px; height: 56px; line-height: 56px; font-size: 32px;">
                🔔
              </div>
            </div>
            <h2 style="margin: 0 0 16px; text-align: center; color: #0f172a;">
              ${propertyCount} New ${propertyCount === 1 ? 'Property' : 'Properties'} Found!
            </h2>
            <p style="line-height: 1.6; margin: 16px 0;">
              Hi ${recipientName},
            </p>
            <p style="line-height: 1.6; margin: 16px 0;">
              Great news! We found ${propertyCount} new ${propertyCount === 1 ? 'property' : 'properties'} matching your saved search "<strong>${searchName}</strong>".
            </p>
            
            <div style="margin: 24px 0;">
              ${propertiesHtml}
            </div>

            ${newProperties.length > 3 ? `
              <p style="line-height: 1.6; margin: 16px 0; text-align: center; color: #64748b;">
                And more...
              </p>
            ` : ''}

            <div style="margin-top: 24px; text-align: center;">
              <a href="${searchUrl}" style="display: inline-block; background: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 24px; border-radius: 6px; font-weight: 600; margin-right: 8px;">View All Matches</a>
            </div>

            <div style="margin-top: 32px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
              <p style="line-height: 1.6; margin: 0; font-size: 14px; color: #475569;">
                <strong>Manage Your Searches</strong>
              </p>
              <p style="line-height: 1.6; margin: 8px 0 0; font-size: 14px; color: #475569;">
                You can adjust notification settings or delete this search at any time.
              </p>
              <p style="margin: 8px 0 0;">
                <a href="${manageSearchesUrl}" style="color: #2563eb; font-size: 14px; text-decoration: none;">Manage Saved Searches →</a>
              </p>
            </div>

            <p style="line-height: 1.6; margin: 24px 0 0;">— The ${brandName} Team</p>
          </td>
        </tr>
        <tr>
          <td style="padding: 16px 24px; background: #f8fafc; color: #64748b; font-size: 12px; text-align: center;">
            <p style="margin: 0;">
              You're receiving this email because you saved a search on ${brandName}.
            </p>
            <p style="margin: 8px 0 0;">
              <a href="${manageSearchesUrl}" style="color: #64748b; text-decoration: underline;">Update preferences</a>
            </p>
          </td>
        </tr>
      </table>
    </div>
  `;
  }

  /**
   * Send email verification email
   */
  async sendEmailVerification(recipientEmail: string, recipientName: string, verificationToken: string): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'https://horohouse-beta.vercel.app');
    const apiUrl = this.configService.get<string>('API_URL', 'https://backend-horohouse.onrender.com');

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

  // ─────────────────────────────────────────────────────────────────────────────
  // ADD THESE TWO METHODS to your existing EmailService class
  // File: src/email/email.service.ts
  // ─────────────────────────────────────────────────────────────────────────────

  /**
   * Notify a property owner that their listing has been removed by an admin.
   *
   * Called from: ReportsService.deleteReportedProperty()
   */
  async sendPropertyRemovedEmail(
    recipientEmail: string,
    recipientName: string,
    propertyTitle: string,
  ): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const supportEmail = this.configService.get<string>('SUPPORT_EMAIL', `support@horohouse.com`);

    const displayName = recipientName?.trim() || 'there';
    const subject = `Your listing "${propertyTitle}" has been removed — ${brandName}`;
    const text = [
      `Hi ${displayName},`,
      ``,
      `We're writing to inform you that your property listing "${propertyTitle}" has been`,
      `permanently removed from ${brandName} following a review of a report submitted by`,
      `another user.`,
      ``,
      `Our team reviewed the report and determined that the listing violated our community`,
      `guidelines.`,
      ``,
      `If you believe this decision was made in error, please contact our support team at`,
      `${supportEmail} and we will be happy to review your case.`,
      ``,
      `— The ${brandName} Team`,
    ].join('\n');

    const html = this.buildPropertyRemovedTemplate({
      brandName,
      recipientName: displayName,
      propertyTitle,
      frontendUrl,
      supportEmail,
    });

    await this.safeSendMail({ to: recipientEmail, subject, html, text });
  }

  /**
   * Send a formal warning to a property owner about their listing.
   *
   * Called from: ReportsService.warnOwner()
   */
  async sendPropertyWarningEmail(
    recipientEmail: string,
    recipientName: string,
    propertyTitle: string,
    warningMessage: string,
    severity: 'warning' | 'final_warning',
  ): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');
    const supportEmail = this.configService.get<string>('SUPPORT_EMAIL', `support@horohouse.com`);

    const isFinal = severity === 'final_warning';
    const displayName = recipientName?.trim() || 'there';
    const subject = isFinal
      ? `⚠️ Final Warning: Action required on your ${brandName} listing`
      : `⚠️ Warning regarding your ${brandName} listing`;

    const text = [
      `Hi ${displayName},`,
      ``,
      isFinal
        ? `This is a final warning regarding your property listing "${propertyTitle}" on ${brandName}.`
        : `We are writing to inform you of a warning regarding your property listing "${propertyTitle}" on ${brandName}.`,
      ``,
      warningMessage,
      ``,
      isFinal
        ? `Please take immediate action. Failure to comply may result in the permanent removal of your listing.`
        : `Please review your listing and make the necessary changes to comply with our community guidelines.`,
      ``,
      `If you have questions, please contact ${supportEmail}.`,
      ``,
      `— The ${brandName} Team`,
    ].join('\n');

    const html = this.buildPropertyWarningTemplate({
      brandName,
      recipientName: displayName,
      propertyTitle,
      warningMessage,
      isFinal,
      frontendUrl,
      supportEmail,
    });

    await this.safeSendMail({ to: recipientEmail, subject, html, text });
  }

  // ─── Private templates ────────────────────────────────────────────────────────

  private buildPropertyRemovedTemplate(params: {
    brandName: string;
    recipientName: string;
    propertyTitle: string;
    frontendUrl: string;
    supportEmail: string;
  }): string {
    const { brandName, recipientName, propertyTitle, frontendUrl, supportEmail } = params;
    return `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f6f9fc;padding:24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
         style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <tr>
      <td style="padding:24px;background:#0f172a;color:#fff;">
        <h1 style="margin:0;font-size:20px;">${brandName}</h1>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;color:#0f172a;">
        <div style="text-align:center;margin-bottom:20px;">
          <div style="display:inline-block;background:#ef4444;color:#fff;border-radius:50%;
                      width:56px;height:56px;line-height:56px;font-size:28px;">✕</div>
        </div>
        <h2 style="margin-top:0;text-align:center;color:#dc2626;">Listing Removed</h2>
        <p style="line-height:1.6;margin:16px 0;">Hi ${recipientName},</p>
        <p style="line-height:1.6;margin:16px 0;">
          We're writing to inform you that your property listing
          <strong>"${propertyTitle}"</strong> has been permanently removed from
          ${brandName} following a review of a report submitted by another user.
        </p>
        <p style="line-height:1.6;margin:16px 0;">
          Our team determined the listing violated our community guidelines.
        </p>
        <div style="margin:24px 0;padding:16px;background:#fef2f2;
                    border-left:4px solid #ef4444;border-radius:4px;">
          <p style="margin:0;font-size:14px;color:#991b1b;line-height:1.6;">
            If you believe this was a mistake, please contact our support team.
          </p>
        </div>
        <div style="margin-top:24px;text-align:center;">
          <a href="mailto:${supportEmail}"
             style="display:inline-block;background:#0f172a;color:#fff;text-decoration:none;
                    padding:12px 24px;border-radius:6px;font-weight:600;">
            Contact Support
          </a>
        </div>
        <p style="line-height:1.6;margin:24px 0 0;">— The ${brandName} Team</p>
      </td>
    </tr>
  </table>
</div>`;
  }

  private buildPropertyWarningTemplate(params: {
    brandName: string;
    recipientName: string;
    propertyTitle: string;
    warningMessage: string;
    isFinal: boolean;
    frontendUrl: string;
    supportEmail: string;
  }): string {
    const { brandName, recipientName, propertyTitle, warningMessage, isFinal, frontendUrl, supportEmail } = params;
    const accentColor = isFinal ? '#dc2626' : '#d97706';
    const bgColor = isFinal ? '#fef2f2' : '#fffbeb';
    const borderColor = isFinal ? '#ef4444' : '#f59e0b';
    const label = isFinal ? 'Final Warning' : 'Warning';

    return `
<div style="font-family:Arial,Helvetica,sans-serif;background:#f6f9fc;padding:24px;">
  <table role="presentation" cellpadding="0" cellspacing="0" width="100%"
         style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
    <tr>
      <td style="padding:24px;background:#0f172a;color:#fff;">
        <h1 style="margin:0;font-size:20px;">${brandName}</h1>
      </td>
    </tr>
    <!-- Severity banner -->
    <tr>
      <td style="padding:12px 24px;background:${accentColor};color:#fff;text-align:center;">
        <strong style="font-size:15px;">⚠️ ${label}</strong>
      </td>
    </tr>
    <tr>
      <td style="padding:24px;color:#0f172a;">
        <p style="line-height:1.6;margin:0 0 16px;">Hi ${recipientName},</p>
        <p style="line-height:1.6;margin:16px 0;">
          ${isFinal
        ? `This is a <strong>final warning</strong> regarding your property listing`
        : `We are issuing a <strong>warning</strong> regarding your property listing`}
          <strong>"${propertyTitle}"</strong>.
        </p>

        <!-- Admin message box -->
        <div style="margin:20px 0;padding:16px;background:${bgColor};
                    border-left:4px solid ${borderColor};border-radius:4px;">
          <p style="margin:0;font-size:14px;color:#1e293b;line-height:1.7;white-space:pre-wrap;"
          >${warningMessage}</p>
        </div>

        <p style="line-height:1.6;margin:16px 0;font-size:14px;color:#475569;">
          ${isFinal
        ? 'Please take <strong>immediate action</strong>. Continued non-compliance may result in permanent removal of your listing.'
        : 'Please review your listing and make the necessary updates to comply with our community guidelines.'}
        </p>

        <div style="margin-top:24px;text-align:center;">
          <a href="${frontendUrl}/dashboard/properties"
             style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;
                    padding:12px 24px;border-radius:6px;font-weight:600;margin-right:8px;">
            Review My Listings
          </a>
          <a href="mailto:${supportEmail}"
             style="display:inline-block;background:#f1f5f9;color:#0f172a;text-decoration:none;
                    padding:12px 24px;border-radius:6px;font-weight:600;">
            Contact Support
          </a>
        </div>
        <p style="line-height:1.6;margin:24px 0 0;">— The ${brandName} Trust &amp; Safety Team</p>
      </td>
    </tr>
    <tr>
      <td style="padding:12px 24px;background:#f8fafc;color:#64748b;font-size:12px;text-align:center;">
        <p style="margin:0;">This message was sent because a report was filed against one of your listings on ${brandName}.</p>
      </td>
    </tr>
  </table>
</div>`;
  }

  async sendBookingConfirmationEmail(
    recipientEmail: string,
    recipientName: string,
    params: {
      propertyTitle: string;
      checkIn: string;
      checkOut: string;
      nights: number;
      totalAmount: number;
      currency: string;
      bookingId: string;
    }
  ): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    await this.safeSendMail({
      to: recipientEmail,
      subject: `Booking confirmed — ${params.propertyTitle}`,
      html: `
      <div style="font-family:Arial,sans-serif;background:#f6f9fc;padding:24px;">
        <table style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
          <tr><td style="padding:24px;background:#0f172a;color:#fff;"><h1 style="margin:0;font-size:20px;">${brandName}</h1></td></tr>
          <tr><td style="padding:24px;">
            <h2 style="color:#10b981;">Your booking is confirmed! 🎉</h2>
            <p>Hi ${recipientName},</p>
            <p>Your stay at <strong>${params.propertyTitle}</strong> is confirmed.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr style="background:#f8fafc;"><td style="padding:10px;font-size:14px;">Check-in</td><td style="padding:10px;font-weight:600;">${params.checkIn}</td></tr>
              <tr><td style="padding:10px;font-size:14px;">Check-out</td><td style="padding:10px;font-weight:600;">${params.checkOut}</td></tr>
              <tr style="background:#f8fafc;"><td style="padding:10px;font-size:14px;">Nights</td><td style="padding:10px;font-weight:600;">${params.nights}</td></tr>
              <tr><td style="padding:10px;font-size:14px;">Total paid</td><td style="padding:10px;font-weight:600;color:#10b981;">${params.currency} ${params.totalAmount.toLocaleString()}</td></tr>
            </table>
            <a href="${frontendUrl}/bookings/${params.bookingId}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;">View Booking</a>
            <p style="margin-top:24px;">— The ${brandName} Team</p>
          </td></tr>
        </table>
      </div>`,
      text: `Booking confirmed for ${params.propertyTitle}. Check-in: ${params.checkIn}, Check-out: ${params.checkOut}. Total: ${params.currency} ${params.totalAmount}.`,
    });
  }

  async sendPaymentRequestEmail(
    recipientEmail: string,
    recipientName: string,
    params: {
      propertyTitle: string;
      checkIn: string;
      checkOut: string;
      totalAmount: number;
      currency: string;
      paymentLink: string;
      expiresInHours: number;
    }
  ): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');

    await this.safeSendMail({
      to: recipientEmail,
      subject: `Complete your payment — ${params.propertyTitle}`,
      html: `
      <div style="font-family:Arial,sans-serif;background:#f6f9fc;padding:24px;">
        <table style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
          <tr><td style="padding:24px;background:#0f172a;color:#fff;"><h1 style="margin:0;font-size:20px;">${brandName}</h1></td></tr>
          <tr><td style="padding:24px;">
            <h2>Complete your booking payment</h2>
            <p>Hi ${recipientName},</p>
            <p>Your booking request for <strong>${params.propertyTitle}</strong> (${params.checkIn} → ${params.checkOut}) is pending payment.</p>
            <p style="font-size:22px;font-weight:700;color:#0f172a;">${params.currency} ${params.totalAmount.toLocaleString()}</p>
            <p style="color:#ef4444;font-size:14px;">⏱ This link expires in ${params.expiresInHours} hours.</p>
            <a href="${params.paymentLink}" style="display:inline-block;background:#10b981;color:#fff;text-decoration:none;padding:14px 28px;border-radius:6px;font-weight:700;">Pay Now</a>
            <p style="margin-top:24px;font-size:13px;color:#64748b;">If you did not make this booking, ignore this email.</p>
          </td></tr>
        </table>
      </div>`,
      text: `Complete your payment of ${params.currency} ${params.totalAmount} for ${params.propertyTitle}. Pay here: ${params.paymentLink}`,
    });
  }

  async sendHostNewBookingEmail(
    recipientEmail: string,
    recipientName: string,
    params: {
      propertyTitle: string;
      guestName: string;
      checkIn: string;
      checkOut: string;
      totalAmount: number;
      currency: string;
      bookingId: string;
    }
  ): Promise<void> {
    const brandName = this.configService.get<string>('BRAND_NAME', 'HoroHouse');
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:3000');

    await this.safeSendMail({
      to: recipientEmail,
      subject: `New booking request — ${params.propertyTitle}`,
      html: `
      <div style="font-family:Arial,sans-serif;background:#f6f9fc;padding:24px;">
        <table style="max-width:640px;margin:0 auto;background:#fff;border-radius:8px;overflow:hidden;">
          <tr><td style="padding:24px;background:#0f172a;color:#fff;"><h1 style="margin:0;font-size:20px;">${brandName}</h1></td></tr>
          <tr><td style="padding:24px;">
            <h2>New booking request</h2>
            <p>Hi ${recipientName},</p>
            <p><strong>${params.guestName}</strong> has requested to book <strong>${params.propertyTitle}</strong>.</p>
            <table style="width:100%;border-collapse:collapse;margin:16px 0;">
              <tr style="background:#f8fafc;"><td style="padding:10px;font-size:14px;">Check-in</td><td style="padding:10px;font-weight:600;">${params.checkIn}</td></tr>
              <tr><td style="padding:10px;font-size:14px;">Check-out</td><td style="padding:10px;font-weight:600;">${params.checkOut}</td></tr>
              <tr style="background:#f8fafc;"><td style="padding:10px;font-size:14px;">Amount</td><td style="padding:10px;font-weight:600;color:#10b981;">${params.currency} ${params.totalAmount.toLocaleString()}</td></tr>
            </table>
            <a href="${frontendUrl}/hosting/bookings/${params.bookingId}" style="display:inline-block;background:#2563eb;color:#fff;text-decoration:none;padding:12px 24px;border-radius:6px;">Review Request</a>
          </td></tr>
        </table>
      </div>`,
      text: `${params.guestName} requested to book ${params.propertyTitle} from ${params.checkIn} to ${params.checkOut}.`,
    });
  }
}


