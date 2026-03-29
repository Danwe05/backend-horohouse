import { Get, Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import * as os from 'os';

@Injectable()
export class AppService {
  constructor(@InjectConnection() private readonly connection: Connection) { }

  getHello(): string {
    return 'Hello World!';
  }

  async getHealthStatus() {
    const dbStatus = this.connection.readyState === 1 ? 'connected' : 'disconnected';

    // System metrics
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const usedMem = totalMem - freeMem;
    const memUsage = ((usedMem / totalMem) * 100).toFixed(2);

    const cpus = os.cpus();
    const loadAvg = os.loadavg();

    return {
      status: dbStatus === 'connected' ? 'ok' : 'error',
      timestamp: new Date().toISOString(),
      service: 'HoroHouse API',
      version: '1.0.0',
      database: {
        status: dbStatus,
        details: {
          name: this.connection.name,
          host: this.connection.host,
        }
      },
      system: {
        uptime: os.uptime(),
        platform: os.platform(),
        cpus: cpus.length,
        loadAvg: loadAvg,
        memory: {
          total: (totalMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
          used: (usedMem / (1024 * 1024 * 1024)).toFixed(2) + ' GB',
          usagePercent: memUsage + '%',
        }
      }
    };
  }

  // In any controller, e.g. app.controller.ts
  @Get('test-email')
  async testEmail() {
    const nodemailer = require('nodemailer');
    const config = {
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '465'),
      secure: parseInt(process.env.SMTP_PORT || '465') === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    };

    console.log('SMTP config loaded:', {
      host: config.host,
      port: config.port,
      secure: config.secure,
      user: config.auth.user,
      passLength: config.auth.pass?.length ?? 0, // never log the actual password
    });

    try {
      const transporter = nodemailer.createTransport(config);
      await transporter.verify(); // ← tests the connection without sending
      console.log('✅ SMTP connection verified');

      const info = await transporter.sendMail({
        from: process.env.SMTP_USER,
        to: process.env.SMTP_USER, // send to yourself
        subject: 'HoroHouse SMTP Test',
        text: 'If you see this, SMTP is working on Railway.',
      });

      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error('❌ SMTP error:', err.message);
      return { success: false, error: err.message };
    }
  }
}
