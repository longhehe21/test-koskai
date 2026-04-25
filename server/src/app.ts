import Fastify, { type FastifyInstance, type FastifyServerOptions } from 'fastify';

import dbPlugin from './plugins/db.plugin.js';
import securityPlugin from './plugins/security.plugin.js';
import jwtPlugin from './plugins/jwt.plugin.js';
import multipartPlugin from './plugins/multipart.plugin.js';
import authPlugin from './plugins/auth.plugin.js';
import swaggerPlugin from './plugins/swagger.plugin.js';

import healthRoute from './modules/health/health.route.js';
import sessionRoute from './modules/session/session.route.js';
import sessionMessagesRoute from './modules/session/session-messages.route.js';
import applicationRoute from './modules/application/application.route.js';
import documentRoute from './modules/document/document.route.js';
import scanRoute from './modules/scan/scan.route.js';
import publicRoute from './routes/public.route.js';

export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({
    logger: { level: process.env.NODE_ENV === 'production' ? 'warn' : 'info' },
    ...opts,
  });

  await app.register(dbPlugin);
  await app.register(securityPlugin);
  await app.register(jwtPlugin);
  await app.register(multipartPlugin);
  await app.register(authPlugin);
  await app.register(swaggerPlugin);

  await app.register(healthRoute);
  await app.register(sessionRoute);
  await app.register(sessionMessagesRoute);
  await app.register(applicationRoute);
  await app.register(documentRoute);
  await app.register(scanRoute);
  await app.register(publicRoute);

  return app;
}
