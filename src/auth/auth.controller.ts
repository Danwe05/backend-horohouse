import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Req,
  Res,
  Param,
  Delete,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiBody } from '@nestjs/swagger';
import { IsString, IsNotEmpty, IsOptional, IsEmail } from 'class-validator';
import { FastifyRequest, FastifyReply } from 'fastify';

import { 
  AuthService, 
  AuthTokens,
  RegisterWithPhoneDto,
  RegisterWithEmailDto,
  LoginWithPhoneDto,
  LoginWithEmailDto,
  SendPhoneCodeDto,
  VerifyPhoneDto,
  GoogleAuthDto,
  JwtPayload
} from './auth.service';
import { Public } from './guards/roles.guard';
import { JwtAuthGuard } from './guards/jwt.auth.guard';
import { User } from '../users/schemas/user.schema';
import { GoogleOAuthGuard } from './guards/google-oauth.guard';

// DTOs for API documentation
class SendPhoneCodeRequestDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;
}

class RegisterPhoneDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsEmail()
  @IsOptional()
  email?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsOptional()
  deviceInfo?: any;
}

class RegisterEmailDto {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsString()
  @IsOptional()
  phoneNumber?: string;

  @IsString()
  @IsOptional()
  role?: string;

  @IsOptional()
  deviceInfo?: any;
}

class LoginPhoneDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  verificationCode: string;

  @IsOptional()
  deviceInfo?: any;
}

class LoginEmailDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;

  @IsOptional()
  deviceInfo?: any;
}

class VerifyPhoneRequestDto {
  @IsString()
  @IsNotEmpty()
  phoneNumber: string;

  @IsString()
  @IsNotEmpty()
  verificationCode: string;
}

class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

declare module 'fastify' {
  interface FastifyRequest {
    user?: User | JwtPayload;
  }
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Public()
  @Post('send-phone-code')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Send phone verification code' })
  @ApiBody({ type: SendPhoneCodeRequestDto })
  @ApiResponse({ status: 200, description: 'Verification code sent successfully' })
  @ApiResponse({ status: 400, description: 'Invalid phone number' })
  async sendPhoneCode(@Body() dto: SendPhoneCodeDto) {
    return this.authService.sendPhoneVerificationCode(dto);
  }

  @Public()
  @Post('register/phone')
  @ApiOperation({ summary: 'Register with phone number' })
  @ApiBody({ type: RegisterPhoneDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async registerWithPhone(
    @Body() dto: RegisterWithPhoneDto, 
    @Req() req: FastifyRequest
  ): Promise<AuthTokens> {
    return this.authService.registerWithPhone(dto, req);
  }

  @Public()
  @Post('register/email')
  @ApiOperation({ summary: 'Register with email and password' })
  @ApiBody({ type: RegisterEmailDto })
  @ApiResponse({ status: 201, description: 'User registered successfully' })
  @ApiResponse({ status: 400, description: 'Bad request' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async registerWithEmail(
    @Body() dto: RegisterWithEmailDto, 
    @Req() req: FastifyRequest
  ): Promise<AuthTokens> {
    return this.authService.registerWithEmail(dto, req);
  }

  @Public()
  @Post('login/phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with phone verification code' })
  @ApiBody({ type: LoginPhoneDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async loginWithPhone(
    @Body() dto: LoginWithPhoneDto, 
    @Req() req: FastifyRequest
  ): Promise<AuthTokens> {
    return this.authService.loginWithPhone(dto, req);
  }

  @Public()
  @Post('login/email')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiBody({ type: LoginEmailDto })
  @ApiResponse({ status: 200, description: 'Login successful' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async loginWithEmail(
    @Body() dto: LoginWithEmailDto, 
    @Req() req: FastifyRequest
  ): Promise<AuthTokens> {
    return this.authService.loginWithEmail(dto, req);
  }

  @Public()
  @Post('verify-phone')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify phone number' })
  @ApiBody({ type: VerifyPhoneRequestDto })
  @ApiResponse({ status: 200, description: 'Phone verified successfully' })
  @ApiResponse({ status: 401, description: 'Invalid verification code' })
  async verifyPhone(@Body() dto: VerifyPhoneDto) {
    return this.authService.verifyPhone(dto);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  @ApiBody({ type: RefreshTokenDto })
  @ApiResponse({ status: 200, description: 'Token refreshed successfully' })
  @ApiResponse({ status: 401, description: 'Invalid refresh token' })
  async refreshToken(
    @Body() { refreshToken }: RefreshTokenDto, 
    @Req() req: FastifyRequest
  ): Promise<AuthTokens> {
    return this.authService.refreshToken(refreshToken, req);
  }

  // 🔥 FIX: Manually handle redirect for Fastify compatibility
 // Remove @Res() injection and let NestJS handle the response
@Public()
@Get('google')
@UseGuards(GoogleOAuthGuard)  // Changed from AuthGuard('google')
@ApiOperation({ summary: 'Initiate Google OAuth login' })
async googleAuth() {
  // Guard handles the redirect to Google
}

@Public()
@Get('google/callback')
@UseGuards(GoogleOAuthGuard)
@ApiOperation({ summary: 'Google OAuth callback' })
async googleAuthRedirect(@Req() req: FastifyRequest, @Res() res: FastifyReply) {
  const googleUser = req.user as any;

  try {
    const authResult = await this.authService.googleAuth({
      googleId: googleUser.id,
      email: googleUser.email,
      name: googleUser.displayName,
      picture: googleUser.picture,
    }, req);

    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const redirectUrl = `${frontendUrl}/auth/callback?token=${authResult.accessToken}&refresh=${authResult.refreshToken}`;

    res.redirect(redirectUrl);
    return res;  // ✅ This tells NestJS we've handled the response
  } catch (error) {
    const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
    const errorUrl = `${frontendUrl}/auth/login?error=oauth_failed`;
    
    res.redirect(errorUrl);
    return res;  // ✅ This tells NestJS we've handled the response
  }
}
  
  @UseGuards(JwtAuthGuard)
  @Post('logout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Logout user' })
  @ApiResponse({ status: 204, description: 'Logout successful' })
  async logout(@Req() req: FastifyRequest & { user: User | JwtPayload }) {
    let userId: string;
    let sessionId: string | undefined;

    if ('_id' in req.user) {
      userId = req.user._id.toString();
    } else {
      userId = req.user.sub;
      sessionId = req.user.sessionId;
    }

    await this.authService.logout(userId, sessionId);
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'User profile retrieved' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProfile(@Req() req: FastifyRequest & { user: User }) {
    return {
      user: req.user,
    };
  }

  @UseGuards(JwtAuthGuard)
  @Get('verify-token')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Verify if current token is valid' })
  async verifyToken(@Req() req: FastifyRequest & { user: User }) {
    try {
      if (!req.user) {
        throw new Error('User not found in request');
      }

      let userId: string;
      
      if (req.user._id) {
        userId = req.user._id.toString();
      } else if ((req.user as any).id) {
        userId = (req.user as any).id;
      } else if ((req.user as any).sub) {
        userId = (req.user as any).sub;
      } else {
        throw new Error('User ID not found!');
      }
     
      return {
        valid: true,
        user: {
          id: userId,
          name: req.user.name || '',
          email: req.user.email || '',
          phoneNumber: req.user.phoneNumber || '',
          role: req.user.role || 'guest',
          profilePicture: req.user.profilePicture,
          emailVerified: req.user.emailVerified || false,
          phoneVerified: req.user.phoneVerified || false,
        },
      };
    } catch (error) {
      console.error('Error in verifyToken:', error);
      throw new Error('Failed to verify token');
    }
  }

  @Post('change-password')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Change user password' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid current password' })
  async changePassword(
    @Body() body: { currentPassword: string; newPassword: string },
    @Req() req: FastifyRequest & { user: User | JwtPayload }
  ) {
    const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
    return this.authService.changePassword(userId, body.currentPassword, body.newPassword);
  }

  @Post('enable-2fa')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable two-factor authentication' })
  @ApiResponse({ status: 200, description: '2FA enabled successfully' })
  async enable2FA(@Req() req: FastifyRequest & { user: User }) {
    return this.authService.enable2FA(req.user);
  }

  @Post('disable-2fa')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Disable two-factor authentication' })
  @ApiResponse({ status: 200, description: '2FA disabled successfully' })
  async disable2FA(@Req() req: FastifyRequest & { user: User }) {
    return this.authService.disable2FA(req.user);
  }

  @Get('sessions')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Get user active sessions' })
  @ApiResponse({ status: 200, description: 'Sessions retrieved successfully' })
  async getSessions(@Req() req: FastifyRequest & { user: User }) {
    const sessions = await this.authService.getUserSessions(req.user);
    
    const currentSessionId = (req.user as any).sessionId;
    const sessionsWithCurrent = sessions.map(session => ({
      ...session,
      current: session.id === currentSessionId
    }));
    
    return { sessions: sessionsWithCurrent };
  }

  @Delete('sessions/:sessionId')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Terminate a specific session' })
  @ApiResponse({ status: 204, description: 'Session terminated successfully' })
  async terminateSession(
    @Param('sessionId') sessionId: string,
    @Req() req: FastifyRequest & { user: User }
  ) {
    return this.authService.terminateSession(req.user, sessionId);
  }

  @Delete('sessions/all')
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Terminate all other sessions' })
  @ApiResponse({ status: 204, description: 'All other sessions terminated successfully' })
  async terminateAllSessions(@Req() req: FastifyRequest & { user: User }) {
    const currentSessionId = req.user.sessions?.[0]?.id;
    return this.authService.terminateAllSessions(req.user, currentSessionId);
  }

  @Post('resend-email-verification')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Resend email verification' })
  @ApiResponse({ status: 200, description: 'Verification email sent' })
  async resendEmailVerification(@Req() req: FastifyRequest & { user: User }) {
    return this.authService.resendEmailVerification(req.user);
  }

  @Post('resend-phone-verification')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Resend phone verification' })
  @ApiResponse({ status: 200, description: 'Verification SMS sent' })
  async resendPhoneVerification(@Req() req: FastifyRequest & { user: User }) {
    return this.authService.resendPhoneVerification(req.user);
  }
}