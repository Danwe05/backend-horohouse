import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { IoAdapter } from '@nestjs/platform-socket.io';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import mongoose from 'mongoose';
import { AppModule } from './app.module';

const ALLOWED_ORIGINS = [
  'https://horohouse.com',
  'https://www.horohouse.com',
  'http://localhost:3000',
  'http://localhost:8081',
  'http://localhost:8082',
  'http://10.187.122.37:8081',
];

const CORS_OPTIONS = {
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
};

const HELMET_OPTIONS = {
  contentSecurityPolicy: {
    directives: {
      defaultSrc: [`'self'`],
      styleSrc: [`'self'`, `'unsafe-inline'`],
      fontSrc: [`'self'`],
      objectSrc: [`'none'`],
      scriptSrc: [`'self'`],
      workerSrc: [`'self'`, `blob:`],
    },
  },
};

const MULTIPART_OPTIONS = {
  limits: {
    fieldNameSize: 100,
    fieldSize: 1024 * 1024 * 10,   // 10MB
    fields: 10,
    fileSize: 1024 * 1024 * 50,    // 50MB
    files: 15,
    headerPairs: 2000,
  },
};

function setupSwagger(app: NestFastifyApplication) {
  const config = new DocumentBuilder()
    .setTitle('HoroHouse API')
    .setDescription('Real Estate Platform API for Cameroon and African Countries')
    .setVersion('1.0')
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'JWT-auth')
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management operations')
    .addTag('Properties', 'Property management operations')
    .addTag('History', 'User activity tracking')
    .addTag('Analytics', 'Dashboard and analytics')
    .addTag('AI Chat', 'AI-powered chat and property search')
    .addTag('Chat', 'Real-time chat and messaging')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: { persistAuthorization: true },
  });
}

function setupMongoEvents(logger: Logger) {
  mongoose.connection.on('connected', () => logger.log('✅ Successfully connected to MongoDB'));
  mongoose.connection.on('error', (err) => logger.error('❌ MongoDB connection error: ' + err));
  mongoose.connection.on('disconnected', () => logger.warn('⚠️ MongoDB disconnected'));
}

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ logger: true, maxParamLength: 100 }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);

  // Adapters & plugins
  app.useWebSocketAdapter(new IoAdapter(app));
  await app.register(helmet as any, HELMET_OPTIONS);
  await app.register(cors as any, CORS_OPTIONS);
  await app.register(multipart as any, MULTIPART_OPTIONS);

  // Global pipes
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: false,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (errors) => {
      logger.error('Validation errors:', JSON.stringify(errors, null, 2));
      return new BadRequestException(errors);
    },
  }));

  // Swagger docs
  setupSwagger(app);

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // MongoDB connection events
  setupMongoEvents(logger);

  await app.listen(port, '0.0.0.0');

  logger.log(`🚀 HoroHouse Backend running on port ${port}`);
  logger.log(`📚 API Docs: https://api.horohouse.com/api/docs`);
  logger.log(`🔌 WebSocket ready at: wss://api.horohouse.com/chat`);
  logger.log(`🌍 Allowed origins: ${ALLOWED_ORIGINS.join(', ')}`);
  logger.log(`🔑 JWT Secret configured: ${!!configService.get('JWT_SECRET')}`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});