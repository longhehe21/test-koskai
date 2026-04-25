import 'dotenv/config';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { runMigrations } from './db/migrate.js';
import { seed } from './db/seed.js';

async function start() {
  // Auto-migrate trước khi listen — Railway/cloud deploy dễ dàng, không cần
  // bước thủ công. Idempotent (drizzle skip migrations đã apply).
  if (env.NODE_ENV === 'production' || process.env.AUTO_MIGRATE === 'true') {
    try {
      await runMigrations();
      // eslint-disable-next-line no-console
      console.log('[migrate] DB migrations applied');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[migrate] failed:', err);
      process.exit(1);
    }

    // Auto-seed master data (statuses, services, procedures, form_versions).
    // Idempotent qua onConflictDoNothing — chạy lại không lỗi.
    try {
      await seed();
      // eslint-disable-next-line no-console
      console.log('[seed] master data ensured');
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[seed] failed:', err);
      // Không exit — server vẫn start được, BA test các flow không cần seed
      // sẽ vẫn hoạt động (vd /health). Form submit sẽ fail cho tới khi sửa.
    }
  }

  const app = await buildApp();

  try {
    await app.listen({ port: env.SERVER_PORT, host: '0.0.0.0' });
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
