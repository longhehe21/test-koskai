import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import jwt from '@fastify/jwt';
import { env } from '../config/env.js';

export default fp(async function jwtPlugin(app: FastifyInstance) {
  await app.register(jwt, { secret: env.JWT_SECRET });
}, { name: 'jwt' });
