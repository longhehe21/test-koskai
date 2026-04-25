import 'dotenv/config';
import Fastify from 'fastify';
import cors from '@fastify/cors';
import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import jwt from '@fastify/jwt';
import multipart from '@fastify/multipart';
import healthRoute from './routes/health.js';
import scanRoute from './routes/scan.route.js';
import sessionRoute from './routes/session.route.js';
import applicationRoute from './routes/application.route.js';
import documentRoute from './routes/document.route.js';
import publicRoute from './routes/public.route.js';
import authPlugin from './plugins/auth.js';

export async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
    },
  });

  await fastify.register(helmet);

  await fastify.register(cors, {
    // Dev: cho phép Electron renderer (file://) + dev server Vite
    origin: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  });

  await fastify.register(rateLimit, {
    max: 100,
    timeWindow: '1 minute',
  });

  await fastify.register(jwt, {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-in-production',
  });

  await fastify.register(multipart, {
    limits: {
      fileSize: 10 * 1024 * 1024, // 10MB max ảnh scan
    },
  });

  await fastify.register(authPlugin);

  await fastify.register(healthRoute);
  await fastify.register(scanRoute);
  await fastify.register(sessionRoute);
  await fastify.register(applicationRoute);
  await fastify.register(documentRoute);
  await fastify.register(publicRoute);

  return fastify;
}

async function start() {
  const app = await buildApp();
  const port = Number(process.env.SERVER_PORT ?? 3000);

  try {
    await app.listen({ port, host: '0.0.0.0' });
  } catch (err) {
    app.log.error(err);
    process.exit(1);
  }

  const shutdown = async () => {
    await app.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

start();
