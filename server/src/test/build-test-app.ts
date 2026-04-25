import { buildApp } from '../app.js';

export async function buildTestApp() {
  const app = await buildApp({ logger: false });
  await app.ready();
  return app;
}
