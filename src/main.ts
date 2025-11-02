import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, NestFastifyApplication } from '@nestjs/platform-fastify';
import { ValidationPipe, Logger, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from '@fastify/helmet';
import cors from '@fastify/cors';
import multipart from '@fastify/multipart';
import mongoose from 'mongoose';
import { AppModule } from './app.module';

// 🔥 Import for Socket.IO with Fastify
import { IoAdapter } from '@nestjs/platform-socket.io';

async function bootstrap() {
  const logger = new Logger('Bootstrap');

  // 🔥 CRITICAL: Configure Fastify adapter to work with Socket.IO
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ 
      logger: true,
      // Allow Socket.IO connections
      maxParamLength: 100,
    }),
  );

  const configService = app.get(ConfigService);
  const port = configService.get<number>('PORT', 3000);
  const frontendUrl = configService.get<string>('FRONTEND_URL', 'http://localhost:3001');

  // 🔥 CRITICAL: Use Socket.IO adapter
  app.useWebSocketAdapter(new IoAdapter(app));

  // Security
  await app.register(helmet as any, {
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
  });

  // 🔥 CRITICAL: CORS must allow WebSocket connections
  await app.register(cors as any, {
    origin: [frontendUrl, 'http://localhost:3000', 'http://localhost:3001'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'Accept', 'Origin', 'X-Requested-With'],
  });

  // File upload support
  await app.register(multipart as any, {
    limits: {
      fieldNameSize: 100,
      fieldSize: 1024 * 1024 * 10,
      fields: 10,
      fileSize: 1024 * 1024 * 50,
      files: 15,
      headerPairs: 2000,
    },
  });

  // Global validation pipe
  app.useGlobalPipes(new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) => {
      console.error(JSON.stringify(errors, null, 2));
      return new BadRequestException(errors);
    },
  }));

  // Swagger API documentation
  const config = new DocumentBuilder()
    .setTitle('HoroHouse API')
    .setDescription('Real Estate Platform API for Cameroon and African Countries')
    .setVersion('1.0')
    .addBearerAuth(
      {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
      },
      'JWT-auth',
    )
    .addTag('Authentication', 'User authentication and authorization')
    .addTag('Users', 'User management operations')
    .addTag('Properties', 'Property management operations')
    .addTag('History', 'User activity tracking')
    .addTag('Analytics', 'Dashboard and analytics')
    .build();

  const document = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('api/docs', app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  // Global prefix
  app.setGlobalPrefix('api/v1');

  // MongoDB events
  mongoose.connection.on('connected', () => {
    logger.log('✅ Successfully connected to MongoDB');
  });

  mongoose.connection.on('error', (err) => {
    logger.error('❌ MongoDB connection error: ' + err);
  });

  mongoose.connection.on('disconnected', () => {
    logger.warn('⚠️ MongoDB disconnected');
  });

  await app.listen(port, '0.0.0.0');
  
  logger.log(`🚀 HoroHouse Backend is running on: http://localhost:${port}`);
  logger.log(`📚 API Documentation: http://localhost:${port}/api/docs`);
  logger.log(`🔌 WebSocket Server ready on: ws://localhost:${port}/notifications`);
}

bootstrap().catch((error) => {
  console.error('❌ Failed to start server:', error);
  process.exit(1);
});