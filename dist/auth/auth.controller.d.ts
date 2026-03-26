import { FastifyRequest, FastifyReply } from 'fastify';
import { AuthService, AuthTokens, RegisterWithPhoneDto, RegisterWithEmailDto, LoginWithPhoneDto, LoginWithEmailDto, SendPhoneCodeDto, VerifyPhoneDto, JwtPayload } from './auth.service';
import { User } from '../users/schemas/user.schema';
import { ForgotPasswordDto, ResetPasswordDto, ValidateResetTokenDto } from './dto/password-reset.dto';
declare class RefreshTokenDto {
    refreshToken: string;
}
declare module 'fastify' {
    interface FastifyRequest {
        user?: User | JwtPayload;
    }
}
export declare class AuthController {
    private authService;
    constructor(authService: AuthService);
    sendPhoneCode(dto: SendPhoneCodeDto): Promise<{
        message: string;
    }>;
    registerWithPhone(dto: RegisterWithPhoneDto, req: FastifyRequest): Promise<AuthTokens>;
    registerWithEmail(dto: RegisterWithEmailDto, req: FastifyRequest): Promise<AuthTokens>;
    loginWithPhone(dto: LoginWithPhoneDto, req: FastifyRequest): Promise<AuthTokens>;
    loginWithEmail(dto: LoginWithEmailDto, req: FastifyRequest): Promise<AuthTokens>;
    verifyPhone(dto: VerifyPhoneDto): Promise<{
        message: string;
    }>;
    refreshToken({ refreshToken }: RefreshTokenDto, req: FastifyRequest): Promise<AuthTokens>;
    forgotPassword(dto: ForgotPasswordDto): Promise<{
        message: string;
    }>;
    validateResetToken(dto: ValidateResetTokenDto): Promise<{
        valid: boolean;
        email?: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    googleAuth(): Promise<void>;
    googleAuthRedirect(req: FastifyRequest, res: FastifyReply): Promise<never>;
    logout(req: FastifyRequest & {
        user: User | JwtPayload;
    }): Promise<void>;
    getProfile(req: FastifyRequest & {
        user: User;
    }): Promise<{
        user: User | (JwtPayload & User);
    }>;
    verifyToken(req: FastifyRequest & {
        user: User;
    }): Promise<{
        valid: boolean;
        user: {
            id: string;
            name: string;
            email: string;
            phoneNumber: string;
            role: import("../users/schemas/user.schema").UserRole;
            profilePicture: string | undefined;
            emailVerified: boolean;
            phoneVerified: boolean;
        };
    }>;
    changePassword(body: {
        currentPassword: string;
        newPassword: string;
    }, req: FastifyRequest & {
        user: User | JwtPayload;
    }): Promise<{
        message: string;
    }>;
    enable2FA(req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
        secret?: string;
    }>;
    disable2FA(req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
    getSessions(req: FastifyRequest & {
        user: User;
    }): Promise<{
        sessions: {
            current: boolean;
            id: string;
            refreshToken: string;
            device: string;
            ipAddress: string;
            userAgent: string;
            location?: string;
            isActive: boolean;
            lastActive: Date;
            createdAt: Date;
            expiresAt: Date;
        }[];
    }>;
    terminateSession(sessionId: string, req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
    terminateAllSessions(req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
    resendEmailVerification(req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
    resendPhoneVerification(req: FastifyRequest & {
        user: User;
    }): Promise<{
        message: string;
    }>;
}
export {};
