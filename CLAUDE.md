# Kiosk-Ai — AI Kiosk Hành Chính Công

## Mô tả dự án
Phần mềm kiosk tự phục vụ cho dịch vụ công tích hợp AI, chạy trên phần cứng
Intel Core Ultra 5 với NPU AI Boost. Công dân tự thực hiện thủ tục hành chính
thông qua màn hình cảm ứng, không cần cán bộ hỗ trợ trực tiếp.

## Kiến trúc tổng thể
Monorepo gồm 3 package:
- kiosk/   — Electron app chạy trực tiếp trên thiết bị kiosk
- server/  — Fastify backend trên VPS nội bộ
- shared/  — TypeScript types + Zod schemas dùng chung

## Stack kỹ thuật

### Kiosk (kiosk/)
- Runtime: Electron 28+
- UI: React 18 + TypeScript + Tailwind CSS + shadcn/ui
- DB local: SQLite (better-sqlite3) + Drizzle ORM — offline-first
- State: Zustand
- Validation: Zod (mọi IPC input đều phải validate)
- Crypto: argon2 (key derivation) + libsodium-wrappers (mã hóa + xóa RAM)
- Build: electron-vite + electron-builder (output installer .exe)

### Backend (server/)
- Framework: Fastify (TypeScript)
- DB: PostgreSQL 16 + Drizzle ORM
- Storage: MinIO (lưu file ví đã mã hóa)
- Security: @fastify/helmet + @fastify/rate-limit + @fastify/jwt + @fastify/cors
- Deploy: Docker + docker-compose trên VPS nội bộ

### AI
- Toàn bộ AI (face match, liveness, OCR, voice-to-text, chatbot) gọi qua API
  của bên thứ 3 — không tự quản lý model
- Kiosk gọi AI API qua LAN 2 (đường internet riêng)

### Shared (shared/)
- TypeScript interfaces: User, HoSo, Wallet, AuditLog
- Zod schemas dùng chung cho cả kiosk và server

## Phần cứng tích hợp
- Camera: eKYC, liveness detection, phát hiện người đứng trước máy
- CCCD NFC reader (13.56 MHz): đọc 17 trường + ảnh chân dung từ chip
- Document scanner A4: scan 2 mặt tự động, 40 trang/phút, đọc MRZ
- Máy in nhiệt 80mm: in phiếu biên nhận, QR code, số thứ tự
- QR reader: đọc VneID, VietQR, phiếu hẹn
- RFID reader: thẻ nhân viên, thẻ hệ thống cũ (125 KHz)
- Loa 20W + micro: voice-to-text, text-to-speech, AI chatbot giọng nói
- Dual LAN: LAN 1 (intranet nội bộ) + LAN 2 (internet, tách biệt)

## Nguyên tắc bảo mật (bắt buộc)
- KHÔNG lưu PII vào DB (số CCCD, tên, ngày sinh, địa chỉ, ảnh mặt)
- Định danh người dùng bằng HMAC-SHA256(cccdNumber, SYSTEM_SECRET)
- Ảnh sinh trắc học chỉ tồn tại trong RAM, xóa ngay sau khi dùng (sodium.memzero)
- File trong ví mã hóa AES-256-GCM, server chỉ lưu blob đã mã hóa
- Master key dẫn xuất từ Argon2, không bao giờ gửi lên server
- Mọi IPC input validate bằng Zod trước khi xử lý
- Ghi audit log mọi hành động (không lưu PII, chỉ lưu hash + timestamp + kết quả)

## Cấu trúc thư mục
```
Kiosk-Ai/
├── CLAUDE.md
├── package.json              ← npm workspaces root
├── docker-compose.yml        ← PostgreSQL 16 + MinIO (local dev)
├── docker-compose.prod.yml   ← deploy lên VPS
├── .env.example
│
├── shared/
│   ├── package.json
│   ├── types/                ← TypeScript interfaces
│   └── schemas/              ← Zod validation schemas
│
├── kiosk/
│   ├── package.json
│   ├── electron.vite.config.ts
│   └── src/
│       ├── main/
│       │   ├── index.ts      ← entry point
│       │   ├── ipc/          ← IPC handlers (thay REST endpoints)
│       │   ├── db/           ← SQLite schema + queries
│       │   └── hw/           ← Hardware drivers (CCCD, printer, scanner, QR)
│       └── renderer/
│           ├── pages/
│           └── components/
│
└── server/
    ├── package.json
    ├── Dockerfile
    ├── drizzle.config.ts
    └── src/
        ├── app.ts            ← Fastify instance + plugins
        ├── routes/           ← API endpoints
        ├── services/         ← Business logic
        └── db/
            ├── schema.ts     ← Drizzle schema
            └── migrations/
```

## Quy tắc code
- IPC handler chỉ validate input + gọi service — không chứa business logic
- Business logic nằm trong src/lib/ (kiosk) hoặc src/services/ (server)
- Không dùng SQL raw — dùng Drizzle ORM
- Không import trực tiếp hardware driver trong renderer
- Dữ liệu nhạy cảm xóa khỏi RAM ngay sau khi dùng xong
- Mỗi tính năng có unit test trước khi viết code (TDD)

## Lệnh thường dùng

### Development
```bash
docker compose up -d          # khởi động PostgreSQL + MinIO local
npm run dev                   # chạy Electron kiosk (dev mode)
npm run dev:server            # chạy Fastify server (dev mode)
npm test                      # chạy toàn bộ tests
npm run db:migrate            # chạy database migrations
npm run db:studio             # mở Drizzle Studio xem DB
```

### Build & Deploy
```bash
npm run build:kiosk           # build installer .exe
npm run build:server          # build Fastify production
docker compose -f docker-compose.prod.yml up -d --build server
```

## Thứ tự phát triển (Sprint)
1. Cơ sở hạ tầng: monorepo setup, Docker, DB schema, shared types
2. Auth: NFC đọc CCCD → hash → tạo/tìm user → face match qua AI API
3. Core kiosk: màn hình chờ, menu dịch vụ, luồng nộp hồ sơ
4. Scan & in: scan tài liệu → OCR API → đính kèm hồ sơ → in phiếu
5. Ví cá nhân: tạo wallet, upload/download file mã hóa
6. AI features: voice-to-text, chatbot hướng dẫn, text-to-speech
7. Server & dashboard: đồng bộ dữ liệu, quản trị, báo cáo thống kê
