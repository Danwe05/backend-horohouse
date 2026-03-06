import { CanActivate, ExecutionContext, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { WsException } from '@nestjs/websockets';
import { Socket } from 'socket.io';

@Injectable()
export class WsJwtGuard implements CanActivate {
  private readonly logger = new Logger(WsJwtGuard.name);

  constructor(private readonly jwtService: JwtService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      const client: Socket = context.switchToWs().getClient<Socket>();
      
      // Get token from auth object (socket.io v4 style)
      const token = client.handshake?.auth?.token;

      if (!token) {
        this.logger.warn('No token provided in WebSocket connection');
        throw new WsException('Unauthorized: No token provided');
      }

      // Verify token
      const payload = await this.jwtService.verifyAsync(token);
      
      // Attach user data to client for later use
      client.data.user = payload;
      
      this.logger.log(`WebSocket authenticated: ${payload.userId}`);
      return true;
    } catch (error) {
      this.logger.error('WebSocket authentication failed:', error.message);
      throw new WsException('Unauthorized: Invalid token');
    }
  }
}