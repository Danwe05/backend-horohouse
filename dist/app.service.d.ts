import { Connection } from 'mongoose';
export declare class AppService {
    private readonly connection;
    constructor(connection: Connection);
    getHello(): string;
    getHealthStatus(): Promise<{
        status: string;
        timestamp: string;
        service: string;
        version: string;
        database: {
            status: string;
            details: {
                name: string;
                host: string;
            };
        };
        system: {
            uptime: number;
            platform: NodeJS.Platform;
            cpus: number;
            loadAvg: number[];
            memory: {
                total: string;
                used: string;
                usagePercent: string;
            };
        };
    }>;
    testEmail(): Promise<{
        success: boolean;
        messageId: any;
        error?: undefined;
    } | {
        success: boolean;
        error: any;
        messageId?: undefined;
    }>;
}
