# KioskAI Tracker

Web SPA tra cứu trạng thái hồ sơ. User scan QR code từ phiếu biên nhận nộp
hồ sơ tại kiosk → mở trang này hiển thị tiến trình xử lý.

## Stack
- Vite + React 18 + TypeScript
- react-router-dom v6
- Dùng public endpoint `GET /public/tracking/:code` của server Fastify (không auth)

## Chạy dev

```bash
cd tracker
npm install
npm run dev
```

Default server: `http://localhost:5174` (port 5174 để không conflict với kiosk 5173).

## Env

Tạo `.env.local` nếu cần override:
```
VITE_API_BASE=http://localhost:3000
```

Production build:
```
VITE_API_BASE=https://api.kiosk.vn
```

## Build production

```bash
npm run build
```
Output: `dist/` — static files sẵn deploy Vercel / Netlify / S3.

## Deploy Vercel

1. Tạo project mới trên Vercel, point Root Directory = `tracker/`
2. Framework preset: **Vite**
3. Env var: `VITE_API_BASE=<URL server BE>`
4. Rewrite rule (để SPA router hoạt động): thêm `vercel.json`:
   ```json
   {
     "rewrites": [{ "source": "/(.*)", "destination": "/" }]
   }
   ```

## Flow dữ liệu

```
User scan QR từ kiosk → mở URL https://tracker.kiosk.vn/t/KA-20260424-XXXXXX
  ↓
TrackingPage fetch /public/tracking/:code
  ↓
Server trả trackingCode + procedureName + status + timeline (KHÔNG PII)
  ↓
Render chi tiết + timeline + progress ring
```

## Privacy

Endpoint public không trả:
- Tên công dân, số CCCD, địa chỉ, ngày sinh
- formDataJson (dữ liệu form đã nộp)
- Ảnh scan, file đính kèm

Chỉ trả metadata: mã tracking, tên thủ tục, trạng thái, timestamp, timeline.
Rate-limit 10 req/phút/IP để chống scrape.
