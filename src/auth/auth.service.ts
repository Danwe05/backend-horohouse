import {
  Injectable,
  UnauthorizedException,
  BadRequestException,
  ConflictException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';

import { SmsService } from './sms.service';
import { EmailService } from '../email/email.service';
import { User, UserDocument, UserRole, UserSession } from '../users/schemas/user.schema';

export interface JwtPayload {
  sub: string;
  phoneNumber: string;
  email?: string;
  role: UserRole;
  sessionId: string; // Add sessionId to JWT payload
  iat?: number;
  exp?: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  user: Partial<User>;
}

// DTOs
export interface RegisterWithPhoneDto {
  name: string;
  phoneNumber: string;
  email?: string;
  role?: UserRole;
  deviceInfo?: any;
}

export interface RegisterWithEmailDto {
  name: string;
  email: string;
  password: string;
  phoneNumber?: string;
  role?: UserRole;
  deviceInfo?: any;
}

export interface LoginWithPhoneDto {
  phoneNumber: string;
  verificationCode: string;
  deviceInfo?: any;
}

export interface LoginWithEmailDto {
  email: string;
  password: string;
  deviceInfo?: any;
}

export interface SendPhoneCodeDto {
  phoneNumber: string;
}

export interface VerifyPhoneDto {
  phoneNumber: string;
  verificationCode: string;
}

export interface GoogleAuthDto {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
  deviceInfo?: any;
}

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    @InjectModel(User.name) private userModel: Model<UserDocument>,
    private smsService: SmsService,
    private emailService: EmailService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {}

  /**
   * Send phone verification code
   */
  async sendPhoneVerificationCode(dto: SendPhoneCodeDto): Promise<{ message: string }> {
    try {
      const { phoneNumber } = dto;

      if (!this.smsService.isValidPhoneNumber(phoneNumber)) {
        throw new BadRequestException('Invalid phone number format');
      }

      const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);
      const verificationCode = this.smsService.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Store verification code in database
      await this.userModel.updateOne(
        { phoneNumber: formattedPhone },
        {
          phoneVerificationCode: verificationCode,
          phoneVerificationExpires: expiresAt,
        },
        { upsert: true, setDefaultsOnInsert: true }
      );

      // Send SMS
      const smsSent = await this.smsService.sendVerificationCode(formattedPhone, verificationCode);
      
      if (!smsSent) {
        throw new BadRequestException('Failed to send verification code');
      }

      this.logger.log(`Verification code sent to ${formattedPhone}`);

      return { message: 'Verification code sent successfully' };
    } catch (error) {
      this.logger.error('Failed to send phone verification code:', error);
      throw error;
    }
  }

  /**
   * Register with phone number
   */
  async registerWithPhone(dto: RegisterWithPhoneDto, req?: any): Promise<AuthTokens> {
    try {
      const { name, phoneNumber, email, role } = dto;

      const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);

      // Check if user already exists
      const existingUser = await this.userModel.findOne({
        $or: [
          { phoneNumber: formattedPhone },
          ...(email ? [{ email }] : [])
        ]
      });

      if (existingUser) {
        throw new ConflictException('User already exists with this phone number or email');
      }

      // Create new user
      const user = await this.userModel.create({
        name,
        phoneNumber: formattedPhone,
        email,
        role: role || UserRole.REGISTERED_USER,
        phoneVerified: false,
        emailVerified: false,
      });

      this.logger.log(`New user registered with phone: ${formattedPhone}`);

      // Send both welcome email and verification email if email is present
      if (user.email) {
        const verificationToken = crypto.randomBytes(32).toString('hex');
        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
        
        await this.userModel.findByIdAndUpdate(user._id, {
          emailVerificationToken: verificationToken,
          emailVerificationExpires: expiresAt
        });

        // Send welcome email
        void this.emailService.sendWelcomeEmail(user.email, user.name).catch(() => undefined);
        
        // Send verification email
        void this.emailService.sendEmailVerification(user.email, user.name, verificationToken).catch(() => undefined);
      }

      const tokens = await this.generateTokens(user, req);

      return {
        ...tokens,
        user: user.toJSON(),
      };
    } catch (error) {
      this.logger.error('Phone registration failed:', error);
      throw error;
    }
  }

  /**
   * Register with email and password
   */
  async registerWithEmail(dto: RegisterWithEmailDto, req?: any): Promise<AuthTokens> {
    try {
      const { name, email, password, phoneNumber, role } = dto;

      // Normalize email
      const normalizedEmail = email.trim().toLowerCase();

      // Check if user already exists (case-insensitive)
      const existingUser = await this.userModel.findOne({
        $or: [
          { email: { $regex: `^${normalizedEmail}$`, $options: 'i' } },
          ...(phoneNumber ? [{ phoneNumber }] : [])
        ]
      });

      if (existingUser) {
        throw new ConflictException('User already exists with this email or phone number');
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, 12);

      // Create new user
      const user = await this.userModel.create({
        name,
        email: normalizedEmail,
        password: hashedPassword,
        phoneNumber: phoneNumber || `temp_${Date.now()}`, // Temporary phone number
        role: role || UserRole.REGISTERED_USER,
        phoneVerified: false,
        emailVerified: false,
      });

      this.logger.log(`New user registered with email: ${normalizedEmail}`);

      // Send both welcome email and verification email
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours
      
      await this.userModel.findByIdAndUpdate(user._id, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expiresAt
      });

      // Send welcome email
      void this.emailService.sendWelcomeEmail(user.email!, user.name).catch(() => undefined);
      
      // Send verification email
      void this.emailService.sendEmailVerification(user.email!, user.name, verificationToken).catch(() => undefined);

      const tokens = await this.generateTokens(user, req);

      return {
        ...tokens,
        user: user.toJSON(),
      };
    } catch (error) {
      this.logger.error('Email registration failed:', error);
      throw error;
    }
  }

  /**
   * Login with phone verification
   */
  async loginWithPhone(dto: LoginWithPhoneDto, req?: any): Promise<AuthTokens> {
    try {
      const { phoneNumber, verificationCode } = dto;

      const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);

      // Find user and verify code
      const user = await this.userModel.findOne({ phoneNumber: formattedPhone });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.phoneVerificationCode || !user.phoneVerificationExpires) {
        throw new UnauthorizedException('No verification code found. Please request a new one.');
      }

      if (user.phoneVerificationExpires < new Date()) {
        throw new UnauthorizedException('Verification code has expired');
      }

      if (user.phoneVerificationCode !== verificationCode) {
        throw new UnauthorizedException('Invalid verification code');
      }

      // Mark phone as verified and clear verification code
      user.phoneVerified = true;
      user.phoneVerificationCode = undefined;
      user.phoneVerificationExpires = undefined;
      await user.save();

      this.logger.log(`User logged in with phone: ${formattedPhone}`);

      const tokens = await this.generateTokens(user, req);

      return {
        ...tokens,
        user: user.toJSON(),
      };
    } catch (error) {
      this.logger.error('Phone login failed:', error);
      throw error;
    }
  }

  /**
   * Login with email and password
   */
  async loginWithEmail(dto: LoginWithEmailDto, req?: any): Promise<AuthTokens> {
    try {
      const { email, password } = dto;
      const normalizedEmail = email.trim().toLowerCase();

      // Case-insensitive lookup
      const user = await this.userModel.findOne({
        email: { $regex: `^${normalizedEmail}$`, $options: 'i' }
      });

      if (!user) {
        this.logger.error(`Email login failed: user not found for email ${normalizedEmail}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      if (!user.password) {
        this.logger.error(`Email login failed: no password set for email ${normalizedEmail}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        this.logger.error(`Email login failed: wrong password for email ${normalizedEmail}`);
        throw new UnauthorizedException('Invalid credentials');
      }

      this.logger.log(`User logged in with email: ${normalizedEmail}`);

      const tokens = await this.generateTokens(user, req);

      return {
        ...tokens,
        user: user.toJSON(),
      };
    } catch (error) {
      this.logger.error('Email login failed:', error);
      throw error;
    }
  }

  /**
   * Google OAuth authentication
   */
  async googleAuth(dto: GoogleAuthDto, req?: any): Promise<AuthTokens> {
    try {
      const { googleId, email, name, picture } = dto;

      // Find existing user
      let user = await this.userModel.findOne({
        $or: [{ googleId }, { email }]
      });

      if (!user) {
        // Create new user
        user = await this.userModel.create({
          googleId,
          name,
          email,
          profilePicture: picture,
          phoneNumber: `google_${Date.now()}`, // Temporary phone number
          role: UserRole.REGISTERED_USER,
          emailVerified: true,
          phoneVerified: false,
        });

        this.logger.log(`New user created via Google OAuth: ${email}`);

        // Send verification email (Google users are already email verified, but we can still send welcome)
        if (user.email) {
          void this.emailService.sendWelcomeEmail(user.email, user.name).catch(() => undefined);
        }
      } else {
        // Update existing user
        if (!user.googleId) user.googleId = googleId;
        if (!user.profilePicture && picture) user.profilePicture = picture;
        user.emailVerified = true;
        await user.save();

        this.logger.log(`Existing user logged in via Google OAuth: ${email}`);
      }

      const tokens = await this.generateTokens(user, req);

      return {
        ...tokens,
        user: user.toJSON(),
      };
    } catch (error) {
      this.logger.error('Google OAuth failed:', error);
      throw error;
    }
  }

  /**
   * Verify phone number
   */
  async verifyPhone(dto: VerifyPhoneDto): Promise<{ message: string }> {
    try {
      const { phoneNumber, verificationCode } = dto;

      const formattedPhone = this.smsService.formatPhoneNumber(phoneNumber);

      const user = await this.userModel.findOne({ phoneNumber: formattedPhone });

      if (!user) {
        throw new UnauthorizedException('User not found');
      }

      if (!user.phoneVerificationCode || !user.phoneVerificationExpires) {
        throw new UnauthorizedException('No verification code found');
      }

      if (user.phoneVerificationExpires < new Date()) {
        throw new UnauthorizedException('Verification code has expired');
      }

      if (user.phoneVerificationCode !== verificationCode) {
        throw new UnauthorizedException('Invalid verification code');
      }

      // Mark phone as verified
      user.phoneVerified = true;
      user.phoneVerificationCode = undefined;
      user.phoneVerificationExpires = undefined;
      await user.save();

      return { message: 'Phone number verified successfully' };
    } catch (error) {
      this.logger.error('Phone verification failed:', error);
      throw error;
    }
  }

  /**
   * Refresh access token
   */
  async refreshToken(refreshToken: string, req?: any): Promise<AuthTokens> {
    try {
      const payload = this.jwtService.verify(refreshToken, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
      }) as JwtPayload;

      const user = await this.userModel.findById(payload.sub);
      if (!user || !user.isActive) {
        throw new UnauthorizedException('User not found or inactive');
      }

      // Find the session with this refresh token
      // Prefer locating the session by sessionId embedded in the token if available.
      let session = undefined as any;
      if (payload && payload.sessionId) {
        session = user.sessions.find(s => s.id === payload.sessionId && s.isActive);
        if (!session) {
          this.logger.warn(`Refresh attempt for user ${user._id} provided sessionId ${payload.sessionId} but no active session was found`);
        }
      }

      // Fallback: try to find a session that matches the refresh token value itself.
      if (!session) {
        session = user.sessions.find(s => s.refreshToken === refreshToken && s.isActive);
      }

      if (!session) {
        this.logger.error(`Invalid refresh token for user ${user._id}: session not found (payload.sessionId=${payload?.sessionId})`);
        throw new UnauthorizedException('Invalid refresh token - session not found');
      }

      // Check if session has expired
      if (session.expiresAt < new Date()) {
        // Remove expired session
        user.sessions = user.sessions.filter(s => s.id !== session.id);
        await user.save();
        throw new UnauthorizedException('Session expired');
      }

      // Update session activity
      session.lastActive = new Date();
      if (req) {
        session.ipAddress = this.getClientIp(req);
        session.userAgent = req.headers['user-agent'] || 'Unknown';
      }
      await user.save();

      const tokens = await this.generateTokens(user, req, session.id);

      return {
        ...tokens,
        user: user.toJSON(),
      };
    } catch (error) {
      this.logger.error('Token refresh failed:', error);
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  /**
   * Validate user from JWT payload
   */
  async validateUser(payload: JwtPayload): Promise<UserDocument> {
    const user = await this.userModel.findById(payload.sub);
    if (!user || !user.isActive) {
      throw new UnauthorizedException('User not found or inactive');
    }

    // Check if session is still valid
    const session = user.sessions.find(s => s.id === payload.sessionId && s.isActive);
    if (!session || session.expiresAt < new Date()) {
      throw new UnauthorizedException('Session invalid or expired');
    }

    return user;
  }

  /**
   * Logout user - terminate current session
   */
  async logout(userId: string, sessionId?: string): Promise<void> {
    try {
      const user = await this.userModel.findById(userId);
      if (!user) {
        throw new NotFoundException('User not found');
      }

      if (sessionId) {
        // Remove specific session
        user.sessions = user.sessions.filter(s => s.id !== sessionId);
      } else {
        // Remove all sessions if no specific sessionId
        user.sessions = [];
      }
      
      await user.save();
      
      this.logger.log(`User logged out: ${userId}${sessionId ? ` (session: ${sessionId})` : ' (all sessions)'}`);
    } catch (error) {
      this.logger.error('Logout failed:', error);
    }
  }

  /**
   * Change user password
   */
  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<{ message: string }> {
    // Find user including password explicitly
    const user = await this.userModel.findById(userId).select('+password');
    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (!user.password) {
      throw new BadRequestException('User does not have a password set');
    }

    // Verify current password
    const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    // Hash new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 12);

    // Update password and invalidate all sessions except current one (optional)
    user.password = hashedNewPassword;
    await user.save();

    this.logger.log(`Password changed for user: ${user._id}`);

    return { message: 'Password changed successfully' };
  }

  /**
   * Enable two-factor authentication
   */
  async enable2FA(user: User): Promise<{ message: string; secret?: string }> {
    try {
      // For now, we'll just mark 2FA as enabled
      // In a real implementation, you'd generate a TOTP secret
      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      await this.userModel.findByIdAndUpdate(userId, {
        twoFactorEnabled: true
      });

      this.logger.log(`2FA enabled for user: ${userId}`);

      return { message: 'Two-factor authentication enabled successfully' };
    } catch (error) {
      this.logger.error('2FA enable failed:', error);
      throw error;
    }
  }

  /**
   * Disable two-factor authentication
   */
  async disable2FA(user: User): Promise<{ message: string }> {
    try {
      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      await this.userModel.findByIdAndUpdate(userId, {
        twoFactorEnabled: false,
        twoFactorSecret: undefined
      });

      this.logger.log(`2FA disabled for user: ${userId}`);

      return { message: 'Two-factor authentication disabled successfully' };
    } catch (error) {
      this.logger.error('2FA disable failed:', error);
      throw error;
    }
  }

  /**
   * Get user active sessions
   */
  async getUserSessions(user: User): Promise<UserSession[]> {
    try {
      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      const userDoc = await this.userModel.findById(userId);
      
      if (!userDoc) {
        throw new NotFoundException('User not found');
      }

      // Remove expired sessions and return active ones
      const now = new Date();
      const activeSessions = userDoc.sessions.filter(session => 
        session.isActive && session.expiresAt > now
      );

      // Update user document if we found expired sessions
      if (activeSessions.length !== userDoc.sessions.length) {
        userDoc.sessions = activeSessions;
        await userDoc.save();
      }

      const plainSessions = userDoc.toObject().sessions; 

      return plainSessions.map((session: any) => ({
        ...session,
        refreshToken: undefined,
      })) as UserSession[];
    } catch (error) {
      this.logger.error('Get sessions failed:', error);
      throw error;
    }
  }

  /**
   * Terminate a specific session
   */
  async terminateSession(user: User, sessionId: string): Promise<{ message: string }> {
    try {
      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      const userDoc = await this.userModel.findById(userId);
      
      if (!userDoc) {
        throw new NotFoundException('User not found');
      }

      // Remove the specific session
      const originalSessionCount = userDoc.sessions.length;
      userDoc.sessions = userDoc.sessions.filter(s => s.id !== sessionId);
      
      if (userDoc.sessions.length === originalSessionCount) {
        throw new NotFoundException('Session not found');
      }

      await userDoc.save();
      
      this.logger.log(`Session ${sessionId} terminated for user: ${userId}`);

      return { message: 'Session terminated successfully' };
    } catch (error) {
      this.logger.error('Session termination failed:', error);
      throw error;
    }
  }

  /**
   * Terminate all other sessions
   */
  async terminateAllSessions(user: User, currentSessionId?: string): Promise<{ message: string }> {
    try {
      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      const userDoc = await this.userModel.findById(userId);
      
      if (!userDoc) {
        throw new NotFoundException('User not found');
      }

      if (currentSessionId) {
        // Keep only the current session
        userDoc.sessions = userDoc.sessions.filter(s => s.id === currentSessionId);
      } else {
        // Remove all sessions
        userDoc.sessions = [];
      }

      await userDoc.save();
      
      this.logger.log(`All other sessions terminated for user: ${userId}`);

      return { message: 'All other sessions terminated successfully' };
    } catch (error) {
      this.logger.error('All sessions termination failed:', error);
      throw error;
    }
  }

  /**
   * Resend email verification
   */
  async resendEmailVerification(user: User): Promise<{ message: string }> {
    try {
      if (!user.email) {
        throw new BadRequestException('User does not have an email address');
      }

      if (user.emailVerified) {
        throw new BadRequestException('Email is already verified');
      }

      // Generate verification token
      const verificationToken = crypto.randomBytes(32).toString('hex');
      const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000); // 24 hours

      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      await this.userModel.findByIdAndUpdate(userId, {
        emailVerificationToken: verificationToken,
        emailVerificationExpires: expiresAt
      });

      // In a real implementation, you'd send an email here
      this.logger.log(`Email verification resent to: ${user.email}`);

      return { message: 'Verification email sent successfully' };
    } catch (error) {
      this.logger.error('Email verification resend failed:', error);
      throw error;
    }
  }

  /**
   * Resend phone verification
   */
  async resendPhoneVerification(user: User): Promise<{ message: string }> {
    try {
      if (user.phoneVerified) {
        throw new BadRequestException('Phone number is already verified');
      }

      // Generate new verification code
      const verificationCode = this.smsService.generateVerificationCode();
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      const userId = user._id ? user._id.toString() : (user as any).id || (user as any).sub;
      await this.userModel.findByIdAndUpdate(userId, {
        phoneVerificationCode: verificationCode,
        phoneVerificationExpires: expiresAt
      });

      // Send SMS
      const smsSent = await this.smsService.sendVerificationCode(user.phoneNumber, verificationCode);
      
      if (!smsSent) {
        throw new BadRequestException('Failed to send verification code');
      }

      this.logger.log(`Phone verification resent to: ${user.phoneNumber}`);

      return { message: 'Verification code sent successfully' };
    } catch (error) {
      this.logger.error('Phone verification resend failed:', error);
      throw error;
    }
  }

  /**
   * Verify email
   */
  async verifyEmail(token: string): Promise<{ message: string }> {
    try {
      const user = await this.userModel.findOne({
        emailVerificationToken: token,
        emailVerificationExpires: { $gt: Date.now() }
      });

      if (!user) {
        throw new UnauthorizedException('Invalid or expired verification token');
      }

      user.emailVerified = true;
      user.emailVerificationToken = undefined;
      user.emailVerificationExpires = undefined;
      await user.save();

      this.logger.log(`Email verified for user: ${user._id}`);

      return { message: 'Email verified successfully' };
    } catch (error) {
      this.logger.error('Email verification failed:', error);
      throw error;
    }
  }

  /**
   * Generate JWT tokens and create session
   */
  private async generateTokens(user: UserDocument, req?: any, existingSessionId?: string): Promise<{
    accessToken: string;
    refreshToken: string;
  }> {
    // Generate session ID
    const sessionId = existingSessionId || crypto.randomUUID();
    
    const payload: JwtPayload = {
      sub: user._id.toString(),
      phoneNumber: user.phoneNumber,
      email: user.email,
      role: user.role,
      sessionId,
    };

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload),
      this.jwtService.signAsync(payload, {
        secret: this.configService.get<string>('JWT_REFRESH_SECRET'),
        expiresIn: this.configService.get<string>(
          'JWT_REFRESH_EXPIRATION',
          '7d',
        ),
      }),
    ]);

    // Create or update session
    if (!existingSessionId) {
      const refreshTokenExpirationTime = this.configService.get<string>('JWT_REFRESH_EXPIRATION', '7d');
      const expirationMs = this.parseTokenExpiration(refreshTokenExpirationTime);
      const expiresAt = new Date(Date.now() + expirationMs);

      const deviceInfo = req?.body?.deviceInfo || {};
      const userAgent = req?.headers?.['user-agent'] || 'Unknown';
      const ipAddress = this.getClientIp(req);
      
      const newSession: UserSession = {
        id: sessionId,
        refreshToken,
        device: this.parseDeviceInfo(userAgent, deviceInfo),
        ipAddress,
        userAgent,
        location: await this.getLocationFromIp(ipAddress),
        isActive: true,
        lastActive: new Date(),
        createdAt: new Date(),
        expiresAt,
      };

      // Add new session to user
      user.sessions.push(newSession);

      // Clean up expired sessions while we're at it
      const now = new Date();
      user.sessions = user.sessions.filter(session => session.expiresAt > now);

      // Limit number of active sessions (optional - keep last 10)
      if (user.sessions.length > 10) {
        user.sessions = user.sessions
          .sort((a, b) => b.lastActive.getTime() - a.lastActive.getTime())
          .slice(0, 10);
      }

      await user.save();
    } else {
      // Update existing session with new refresh token
      const sessionIndex = user.sessions.findIndex(s => s.id === existingSessionId);
      if (sessionIndex !== -1) {
        user.sessions[sessionIndex].refreshToken = refreshToken;
        user.sessions[sessionIndex].lastActive = new Date();
        await user.save();
      }
    }

    return { accessToken, refreshToken };
  }

  /**
   * Helper method to extract client IP
   */
  private getClientIp(req?: any): string {
    if (!req) return 'Unknown';
    
    return req.ip || 
           req.connection?.remoteAddress || 
           req.socket?.remoteAddress ||
           (req.headers && (
             req.headers['x-forwarded-for']?.split(',')[0] ||
             req.headers['x-real-ip'] ||
             req.headers['x-client-ip']
           )) ||
           'Unknown';
  }

  /**
   * Helper method to parse device information
   */
  private parseDeviceInfo(userAgent: string, deviceInfo?: any): string {
    if (deviceInfo?.device) {
      return deviceInfo.device;
    }

    // Simple user agent parsing
    const ua = userAgent.toLowerCase();
    
    let browser = 'Unknown Browser';
    let os = 'Unknown OS';

    // Detect browser
    if (ua.includes('chrome')) browser = 'Chrome';
    else if (ua.includes('firefox')) browser = 'Firefox';
    else if (ua.includes('safari')) browser = 'Safari';
    else if (ua.includes('edge')) browser = 'Edge';
    else if (ua.includes('opera')) browser = 'Opera';

    // Detect OS
    if (ua.includes('windows')) os = 'Windows';
    else if (ua.includes('macintosh') || ua.includes('mac os x')) os = 'macOS';
    else if (ua.includes('linux')) os = 'Linux';
    else if (ua.includes('android')) os = 'Android';
    else if (ua.includes('iphone') || ua.includes('ipad')) os = 'iOS';

    return `${browser} on ${os}`;
  }

  /**
   * Helper method to get location from IP (mock implementation)
   */
  private async getLocationFromIp(ipAddress: string): Promise<string> {
    // In a real implementation, you would use a service like:
    // - MaxMind GeoIP
    // - IPInfo.io
    // - ip-api.com
    // For now, return a mock location
    
    if (ipAddress === 'Unknown' || ipAddress.startsWith('127.') || ipAddress.startsWith('192.168.')) {
      return 'Local Network';
    }
    
    // Mock location - in production, integrate with a real geolocation service
    return 'Unknown Location';
  }

  /**
   * Helper method to parse token expiration string to milliseconds
   */
  private parseTokenExpiration(expiration: string): number {
    const regex = /^(\d+)([smhd])$/;
    const match = expiration.match(regex);
    
    if (!match) {
      return 7 * 24 * 60 * 60 * 1000; // Default 7 days
    }
    
    const [, value, unit] = match;
    const num = parseInt(value, 10);
    
    switch (unit) {
      case 's': return num * 1000;
      case 'm': return num * 60 * 1000;
      case 'h': return num * 60 * 60 * 1000;
      case 'd': return num * 24 * 60 * 60 * 1000;
      default: return 7 * 24 * 60 * 60 * 1000;
    }
  }

  /**
   * Clean up expired sessions (call this periodically)
   */
  async cleanupExpiredSessions(): Promise<void> {
    try {
      const now = new Date();
      await this.userModel.updateMany(
        { 'sessions.expiresAt': { $lt: now } },
        { $pull: { sessions: { expiresAt: { $lt: now } } } }
      );
      
      this.logger.log('Expired sessions cleaned up');
    } catch (error) {
      this.logger.error('Failed to cleanup expired sessions:', error);
    }
  }
}