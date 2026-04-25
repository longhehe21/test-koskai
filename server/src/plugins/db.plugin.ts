import fp from 'fastify-plugin';
import type { FastifyInstance } from 'fastify';
import { db, sql } from '../db/client.js';
import type { Db } from '../db/client.js';

declare module 'fastify' {
  interface FastifyInstance {
    db: Db;
  }
}

export default fp(async function dbPlugin(app: FastifyInstance) {
  app.decorate('db', db);

  app.addHook('onClose', async () => {
    await sql.end();
  });
}, { name: 'db' });
