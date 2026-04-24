import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Load .env trước khi chạy test — cần DATABASE_URL, K_MASTER, SYSTEM_SECRET
    setupFiles: ['./test-setup.ts'],
    testTimeout: 60_000, // Argon2id có thể chậm trên CI
    hookTimeout: 30_000,
  },
});
