# KioskAI Server — Nguyên tắc & Pattern

## Cấu trúc thư mục

```
server/src/
├── app.ts                  ← buildApp() factory — KHÔNG có logic, KHÔNG có start()
├── server.ts               ← Entry point duy nhất: listen() + shutdown
├── config/env.ts           ← Zod env schema, fail-fast khi thiếu biến
├── plugins/                ← Fastify plugins (fp() wrapped)
├── modules/                ← Feature modules — mỗi domain 1 folder
├── db/                     ← Drizzle client + schema + migrations
├── utils/                  ← Pure functions, không phụ thuộc Fastify
└── test/                   ← Test harness dùng chung
```

---

## Quy tắc tổ chức

### 1. modules/ — tổ chức theo feature, không theo layer

Mỗi domain có đủ route + service + repository + schema + test trong 1 folder:

```
modules/session/
├── session.route.ts      ← HTTP handler
├── session.schema.ts     ← JSON Schema definitions
├── session.service.ts    ← Business logic
└── session-messages.route.ts
```

**Không** tổ chức kiểu:
```
routes/session.ts       ← BAD: tách layer
services/session.ts     ← BAD: không biết nhìn vào đâu
```

### 2. plugins/ — mọi cross-cutting concern là Fastify plugin

Tất cả plugin phải wrap bằng `fastify-plugin` (`fp()`):

```typescript
// ĐÚNG
export default fp(async function jwtPlugin(app) {
  await app.register(jwt, { secret: env.JWT_SECRET });
}, { name: 'jwt' });

// SAI — không fp() → scope bị isolate, decoration không leak lên app
export default async function jwtPlugin(app) { ... }
```

`fp()` đảm bảo decoration (như `app.requireAuth`, `app.db`) được inject vào toàn bộ app thay vì chỉ trong scope con.

### 3. utils/ — pure functions không phụ thuộc Fastify

`utils/crypto/`, `utils/ocr/` không import bất kỳ thứ gì từ Fastify. Test độc lập hoàn toàn.

```
utils/
├── crypto/   ← hashCccd, encrypt/decrypt, deriveCitizenKey
└── ocr/      ← extractText (Tesseract wrapper)
```

---

## Nguyên tắc code

### Route handler — chỉ 3 việc

```typescript
app.post('/sessions/create', async (request, reply) => {
  // 1. Validate input
  if (!cccd || !/^\d{12}$/.test(cccd)) {
    return reply.code(400).send({ error: '...' });
  }

  // 2. Gọi service
  const result = await createSession({ cccdNumber: cccd, loginMethod });

  // 3. Trả response
  return reply.send(result);
});
```

Route handler **không được** chứa: business logic, DB queries, crypto operations.

### Service — business logic + DB

Service gọi DB qua Drizzle trực tiếp. Với các query phức tạp liên quan nhiều bảng, tách ra `*.repository.ts`:

```typescript
// application.route.ts — gọi repository, không query trực tiếp
const files = await listFilesByAppId(appId);  // ĐÚNG

// KHÔNG làm thế này trong route:
const files = await db.select().from(applicationFiles).where(...);  // SAI
```

### Repository — tách query phức tạp khỏi route

Dùng khi route cần JOIN hoặc query không thuộc về service logic:

```typescript
// application.repository.ts
export async function listFilesByAppId(appId: number) {
  return db.select({ ... }).from(applicationFiles).where(eq(...));
}
```

---

## Fastify Patterns

### buildApp factory pattern

```typescript
// app.ts — factory, không side effect
export async function buildApp(opts: FastifyServerOptions = {}): Promise<FastifyInstance> {
  const app = Fastify({ logger: ..., ...opts });
  await app.register(plugins);
  await app.register(routes);
  return app;
}

// server.ts — entry, side effect (listen)
const app = await buildApp();
await app.listen({ port: env.SERVER_PORT });
```

`buildApp()` có thể import trong test mà không khởi động server:

```typescript
// test/build-test-app.ts
export async function buildTestApp() {
  return buildApp({ logger: false });
}
```

### Schema-first route

Khai báo JSON Schema cho route để Fastify tự validate input và serialize output:

```typescript
app.post('/sessions/create', {
  schema: {
    body: createSessionBodySchema,
    response: { 200: createSessionResponseSchema },
  },
}, handler);
```

Schema định nghĩa trong `*.schema.ts` của module, không inline trong route.

### Per-route rate limit

```typescript
app.post('/sessions/create', {
  config: { rateLimit: { max: 10, timeWindow: '1 minute' } },
}, handler);
```

---

## Environment Variables

Tất cả env vars validate qua Zod tại `config/env.ts`. App exit ngay khi thiếu biến bắt buộc — không để lỗi xảy ra giữa chừng runtime.

```typescript
const envSchema = z.object({
  DATABASE_URL:  z.string().min(1),
  SYSTEM_SECRET: z.string().min(1),
  K_MASTER:      z.string().min(1),
  JWT_SECRET:    z.string().min(16).default('...'),
  SERVER_PORT:   z.coerce.number().default(3000),
  // ...
});
```

Import `env` thay vì đọc `process.env` trực tiếp trong code:

```typescript
import { env } from '../../config/env.js';
// env.MINIO_ENDPOINT, env.SERVER_PORT, v.v.
```

---

## Database

- **ORM**: Drizzle — không dùng raw SQL
- **Client**: `db/client.ts` export singleton `db` và `sql`
- **Schema**: `db/schema.ts` — toàn bộ table definitions
- **Migrations**: `db/migrations/` — chạy `npm run db:migrate`

Import pattern:

```typescript
import { db } from '../../db/client.js';
import { applications, statuses } from '../../db/schema.js';
```

---

## Bảo mật (bắt buộc)

| Nguyên tắc | Cách thực hiện |
|---|---|
| Không lưu PII raw | Chỉ lưu `HMAC-SHA256(cccd, SYSTEM_SECRET)` |
| Session token an toàn | Lưu hash SHA-256 trong DB, trả raw về client |
| File mã hoá | AES-256-GCM, key derive từ Argon2id per-citizen |
| Biến nhạy cảm trong RAM | `wipeBuffer(key)` sau khi dùng xong |
| Input validate | Zod ở `config/env.ts`, schema ở route, regex cho CCCD |
| Auth | `preHandler: [app.requireAuth]` trên mọi route cần bảo vệ |

```typescript
// Mọi route protected đều có preHandler này:
app.get('/applications/me', { preHandler: [app.requireAuth] }, handler);
```

---

## Testing

### Harness

```typescript
import { buildTestApp } from '../../test/build-test-app.js';

const app = await buildTestApp();
const res = await app.inject({ method: 'GET', url: '/health' });
expect(res.statusCode).toBe(200);
```

### Test files đặt cùng module

```
modules/citizen/
├── citizen.service.ts
└── citizen.service.test.ts   ← cùng folder, không tách thư mục test/
```

### Loại test

| Loại | Tool | Mục đích |
|---|---|---|
| Unit | Vitest | Pure functions (crypto, classifier) |
| Integration | Vitest + real DB | Service functions (citizen, snapshot) |
| Route | Vitest + `app.inject()` | HTTP contract, auth, validation |

---

## Quy trình thêm feature mới

1. Tạo folder `src/modules/<feature>/`
2. Viết `<feature>.service.ts` — business logic
3. Viết `<feature>.schema.ts` — JSON Schema cho request/response
4. Viết `<feature>.route.ts` — thin handler, gọi service
5. Register route trong `src/app.ts`
6. Viết test trong cùng folder

---

## Không làm

- Không import `db` trong route — query phải qua service hoặc repository
- Không dùng raw SQL — dùng Drizzle ORM
- Không đọc `process.env` trực tiếp — dùng `env` từ `config/env.ts`
- Không để business logic trong `app.ts`
- Không tạo plugin mà không wrap bằng `fp()`
- Không lưu PII plaintext vào DB
