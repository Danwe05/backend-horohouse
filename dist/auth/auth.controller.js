"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const auth_service_1 = require("./auth.service");
const roles_guard_1 = require("./guards/roles.guard");
const jwt_auth_guard_1 = require("./guards/jwt.auth.guard");
const google_oauth_guard_1 = require("./guards/google-oauth.guard");
const password_reset_dto_1 = require("./dto/password-reset.dto");
class SendPhoneCodeRequestDto {
    phoneNumber;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], SendPhoneCodeRequestDto.prototype, "phoneNumber", void 0);
class RegisterPhoneDto {
    name;
    phoneNumber;
    email;
    role;
    deviceInfo;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RegisterPhoneDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RegisterPhoneDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RegisterPhoneDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RegisterPhoneDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], RegisterPhoneDto.prototype, "deviceInfo", void 0);
class RegisterEmailDto {
    name;
    email;
    password;
    phoneNumber;
    role;
    deviceInfo;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RegisterEmailDto.prototype, "name", void 0);
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RegisterEmailDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RegisterEmailDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RegisterEmailDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], RegisterEmailDto.prototype, "role", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], RegisterEmailDto.prototype, "deviceInfo", void 0);
class LoginPhoneDto {
    phoneNumber;
    verificationCode;
    deviceInfo;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], LoginPhoneDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], LoginPhoneDto.prototype, "verificationCode", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], LoginPhoneDto.prototype, "deviceInfo", void 0);
class LoginEmailDto {
    email;
    password;
    deviceInfo;
}
__decorate([
    (0, class_validator_1.IsEmail)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], LoginEmailDto.prototype, "email", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], LoginEmailDto.prototype, "password", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], LoginEmailDto.prototype, "deviceInfo", void 0);
class VerifyPhoneRequestDto {
    phoneNumber;
    verificationCode;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], VerifyPhoneRequestDto.prototype, "phoneNumber", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], VerifyPhoneRequestDto.prototype, "verificationCode", void 0);
class RefreshTokenDto {
    refreshToken;
}
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], RefreshTokenDto.prototype, "refreshToken", void 0);
let AuthController = class AuthController {
    authService;
    constructor(authService) {
        this.authService = authService;
    }
    async sendPhoneCode(dto) {
        return this.authService.sendPhoneVerificationCode(dto);
    }
    async registerWithPhone(dto, req) {
        return this.authService.registerWithPhone(dto, req);
    }
    async registerWithEmail(dto, req) {
        return this.authService.registerWithEmail(dto, req);
    }
    async loginWithPhone(dto, req) {
        return this.authService.loginWithPhone(dto, req);
    }
    async loginWithEmail(dto, req) {
        return this.authService.loginWithEmail(dto, req);
    }
    async verifyPhone(dto) {
        return this.authService.verifyPhone(dto);
    }
    async refreshToken({ refreshToken }, req) {
        return this.authService.refreshToken(refreshToken, req);
    }
    async forgotPassword(dto) {
        return this.authService.requestPasswordReset(dto.email);
    }
    async validateResetToken(dto) {
        return this.authService.validateResetToken(dto.token);
    }
    async resetPassword(dto) {
        return this.authService.resetPassword(dto.token, dto.newPassword);
    }
    async googleAuth() {
    }
    async googleAuthRedirect(req, res) {
        const googleUser = req.user;
        try {
            const authResult = await this.authService.googleAuth({
                googleId: googleUser.id,
                email: googleUser.email,
                name: googleUser.displayName,
                picture: googleUser.picture,
            }, req);
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const redirectUrl = `${frontendUrl}/auth/callback?token=${authResult.accessToken}&refresh=${authResult.refreshToken}`;
            res.redirect(redirectUrl, 302);
            return res;
        }
        catch (error) {
            const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3000';
            const errorUrl = `${frontendUrl}/auth/login?error=oauth_failed`;
            res.redirect(errorUrl, 302);
            return res;
        }
    }
    async logout(req) {
        let userId;
        let sessionId;
        if ('_id' in req.user) {
            userId = req.user._id.toString();
        }
        else {
            userId = req.user.sub;
            sessionId = req.user.sessionId;
        }
        await this.authService.logout(userId, sessionId);
    }
    async getProfile(req) {
        return {
            user: req.user,
        };
    }
    async verifyToken(req) {
        try {
            if (!req.user) {
                throw new Error('User not found in request');
            }
            let userId;
            if (req.user._id) {
                userId = req.user._id.toString();
            }
            else if (req.user.id) {
                userId = req.user.id;
            }
            else if (req.user.sub) {
                userId = req.user.sub;
            }
            else {
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
        }
        catch (error) {
            console.error('Error in verifyToken:', error);
            throw new Error('Failed to verify token');
        }
    }
    async changePassword(body, req) {
        const userId = '_id' in req.user ? req.user._id.toString() : req.user.sub;
        return this.authService.changePassword(userId, body.currentPassword, body.newPassword);
    }
    async enable2FA(req) {
        return this.authService.enable2FA(req.user);
    }
    async disable2FA(req) {
        return this.authService.disable2FA(req.user);
    }
    async getSessions(req) {
        const sessions = await this.authService.getUserSessions(req.user);
        const currentSessionId = req.user.sessionId;
        const sessionsWithCurrent = sessions.map(session => ({
            ...session,
            current: session.id === currentSessionId
        }));
        return { sessions: sessionsWithCurrent };
    }
    async terminateSession(sessionId, req) {
        return this.authService.terminateSession(req.user, sessionId);
    }
    async terminateAllSessions(req) {
        const currentSessionId = req.user.sessions?.[0]?.id;
        return this.authService.terminateAllSessions(req.user, currentSessionId);
    }
    async resendEmailVerification(req) {
        return this.authService.resendEmailVerification(req.user);
    }
    async resendPhoneVerification(req) {
        return this.authService.resendPhoneVerification(req.user);
    }
};
exports.AuthController = AuthController;
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Post)('send-phone-code'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Send phone verification code' }),
    (0, swagger_1.ApiBody)({ type: SendPhoneCodeRequestDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Verification code sent successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid phone number' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "sendPhoneCode", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Post)('register/phone'),
    (0, swagger_1.ApiOperation)({ summary: 'Register with phone number' }),
    (0, swagger_1.ApiBody)({ type: RegisterPhoneDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'User registered successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'User already exists' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "registerWithPhone", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Post)('register/email'),
    (0, swagger_1.ApiOperation)({ summary: 'Register with email and password' }),
    (0, swagger_1.ApiBody)({ type: RegisterEmailDto }),
    (0, swagger_1.ApiResponse)({ status: 201, description: 'User registered successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Bad request' }),
    (0, swagger_1.ApiResponse)({ status: 409, description: 'User already exists' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "registerWithEmail", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Post)('login/phone'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Login with phone verification code' }),
    (0, swagger_1.ApiBody)({ type: LoginPhoneDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Login successful' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid credentials' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "loginWithPhone", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Post)('login/email'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Login with email and password' }),
    (0, swagger_1.ApiBody)({ type: LoginEmailDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Login successful' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid credentials' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "loginWithEmail", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Post)('verify-phone'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Verify phone number' }),
    (0, swagger_1.ApiBody)({ type: VerifyPhoneRequestDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Phone verified successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid verification code' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyPhone", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Post)('refresh'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Refresh access token' }),
    (0, swagger_1.ApiBody)({ type: RefreshTokenDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Token refreshed successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid refresh token' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [RefreshTokenDto, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "refreshToken", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Post)('forgot-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Request password reset' }),
    (0, swagger_1.ApiBody)({ type: password_reset_dto_1.ForgotPasswordDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Password reset email sent if account exists' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_reset_dto_1.ForgotPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "forgotPassword", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Post)('validate-reset-token'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Validate password reset token' }),
    (0, swagger_1.ApiBody)({ type: password_reset_dto_1.ValidateResetTokenDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Token validation result' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_reset_dto_1.ValidateResetTokenDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "validateResetToken", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Post)('reset-password'),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Reset password with token' }),
    (0, swagger_1.ApiBody)({ type: password_reset_dto_1.ResetPasswordDto }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Password reset successfully' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Invalid or expired token' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [password_reset_dto_1.ResetPasswordDto]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resetPassword", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Get)('google'),
    (0, common_1.UseGuards)(google_oauth_guard_1.GoogleOAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Initiate Google OAuth login' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuth", null);
__decorate([
    (0, roles_guard_1.Public)(),
    (0, common_1.Get)('google/callback'),
    (0, common_1.UseGuards)(google_oauth_guard_1.GoogleOAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Google OAuth callback' }),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Res)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "googleAuthRedirect", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Post)('logout'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Logout user' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Logout successful' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "logout", null);
__decorate([
    (0, common_1.Get)('profile'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Get current user profile' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'User profile retrieved' }),
    (0, swagger_1.ApiResponse)({ status: 401, description: 'Unauthorized' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getProfile", null);
__decorate([
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.Get)('verify-token'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, swagger_1.ApiOperation)({ summary: 'Verify if current token is valid' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "verifyToken", null);
__decorate([
    (0, common_1.Post)('change-password'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Change user password' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Password changed successfully' }),
    (0, swagger_1.ApiResponse)({ status: 400, description: 'Invalid current password' }),
    __param(0, (0, common_1.Body)()),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "changePassword", null);
__decorate([
    (0, common_1.Post)('enable-2fa'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Enable two-factor authentication' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '2FA enabled successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "enable2FA", null);
__decorate([
    (0, common_1.Post)('disable-2fa'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Disable two-factor authentication' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: '2FA disabled successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "disable2FA", null);
__decorate([
    (0, common_1.Get)('sessions'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Get user active sessions' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Sessions retrieved successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "getSessions", null);
__decorate([
    (0, common_1.Delete)('sessions/:sessionId'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Terminate a specific session' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'Session terminated successfully' }),
    __param(0, (0, common_1.Param)('sessionId')),
    __param(1, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "terminateSession", null);
__decorate([
    (0, common_1.Delete)('sessions/all'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, common_1.HttpCode)(common_1.HttpStatus.NO_CONTENT),
    (0, swagger_1.ApiOperation)({ summary: 'Terminate all other sessions' }),
    (0, swagger_1.ApiResponse)({ status: 204, description: 'All other sessions terminated successfully' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "terminateAllSessions", null);
__decorate([
    (0, common_1.Post)('resend-email-verification'),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard),
    (0, swagger_1.ApiOperation)({ summary: 'Resend email verification' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Verification email sent' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resendEmailVerification", null);
__decorate([
    (0, common_1.Post)('resend-phone-verification'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.HttpCode)(common_1.HttpStatus.OK),
    (0, swagger_1.ApiOperation)({ summary: 'Resend phone verification' }),
    (0, swagger_1.ApiResponse)({ status: 200, description: 'Verification SMS sent' }),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], AuthController.prototype, "resendPhoneVerification", null);
exports.AuthController = AuthController = __decorate([
    (0, swagger_1.ApiTags)('Authentication'),
    (0, common_1.Controller)('auth'),
    __metadata("design:paramtypes", [auth_service_1.AuthService])
], AuthController);
//# sourceMappingURL=auth.controller.js.map