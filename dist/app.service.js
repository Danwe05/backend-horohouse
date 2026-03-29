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
exports.AppService = void 0;
const common_1 = require("@nestjs/common");
const mongoose_1 = require("@nestjs/mongoose");
const mongoose_2 = require("mongoose");
const os = require("os");
let AppService = class AppService {
    connection;
    constructor(connection) {
        this.connection = connection;
    }
    getHello() {
        return 'Hello World!';
    }
    async getHealthStatus() {
        const dbStatus = this.connection.readyState === 1 ? 'connected' : 'disconnected';
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
            passLength: config.auth.pass?.length ?? 0,
        });
        try {
            const transporter = nodemailer.createTransport(config);
            await transporter.verify();
            console.log('✅ SMTP connection verified');
            const info = await transporter.sendMail({
                from: process.env.SMTP_USER,
                to: process.env.SMTP_USER,
                subject: 'HoroHouse SMTP Test',
                text: 'If you see this, SMTP is working on Railway.',
            });
            return { success: true, messageId: info.messageId };
        }
        catch (err) {
            console.error('❌ SMTP error:', err.message);
            return { success: false, error: err.message };
        }
    }
};
exports.AppService = AppService;
__decorate([
    (0, common_1.Get)('test-email'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], AppService.prototype, "testEmail", null);
exports.AppService = AppService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, mongoose_1.InjectConnection)()),
    __metadata("design:paramtypes", [mongoose_2.Connection])
], AppService);
//# sourceMappingURL=app.service.js.map