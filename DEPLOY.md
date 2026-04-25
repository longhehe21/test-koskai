# Deploy Guide — BA Test Setup

Mục tiêu: deploy server lên Railway public + build kiosk `.exe` trỏ tới
server đó để BA cài máy họ test.

## 1. Deploy server lên Railway

### Bước 1: Tạo project + connect repo
1. https://railway.app → **New Project** → **Deploy from GitHub repo**
2. Chọn repo `quylhnhfev35/kioskai`, branch `main` (hoặc `hathanhlong`)
3. Railway tự detect [`railway.json`](railway.json) + [`server/Dockerfile`](server/Dockerfile)

### Bước 2: Add Postgres
1. Trong project → **+ Create** → **Database** → **PostgreSQL**
2. Railway tự inject biến `DATABASE_URL` cho service server
3. (Tùy chọn) đổi version Postgres 16 ở Variables tab

### Bước 3: Add MinIO service
1. **+ Create** → **Empty Service** → đặt tên `minio`
2. Settings → **Source** → **Docker Image** → `minio/minio:latest`
3. Variables:
   ```
   MINIO_ROOT_USER=admin
   MINIO_ROOT_PASSWORD=<random 24 chars>
   ```
4. Settings → **Deploy** → **Custom Start Command**: `minio server /data --console-address ":9001"`
5. Networking → **Generate Domain** (chỉ cần khi muốn truy cập console; API qua private network)
6. Add Volume `/data` để persist files

### Bước 4: Set env vars cho server
Trong service `server` → tab **Variables**, paste (sửa values theo nhu cầu):

```bash
NODE_ENV=production
SERVER_PORT=3000

# Postgres — Railway auto-inject DATABASE_URL khi link Postgres service
# DATABASE_URL=${{Postgres.DATABASE_URL}}

# Secrets — generate bằng: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
JWT_SECRET=<random base64 32 bytes>
SYSTEM_SECRET=<random base64 32 bytes>
K_MASTER=<random base64 32 bytes>

# MinIO — link tới service minio qua private network
MINIO_ENDPOINT=${{minio.RAILWAY_PRIVATE_DOMAIN}}
MINIO_PORT=9000
MINIO_ACCESS_KEY=admin
MINIO_SECRET_KEY=<password đã set ở bước 3>
MINIO_BUCKET=kiosk-files
MINIO_USE_SSL=false
```

### Bước 5: Generate public domain cho server
1. Service `server` → **Settings** → **Networking** → **Generate Domain**
2. Copy URL kiểu `https://kiosk-server-production.up.railway.app`

### Bước 6: Deploy
- Server tự deploy. Railway logs hiển thị `Server listening at http://0.0.0.0:3000`
- Auto-migrate chạy ở startup (xem [server/src/db/migrate.ts](server/src/db/migrate.ts))
- Test: `curl https://<your-domain>/health` → `{"status":"ok"}`

### Bước 7 (lần đầu): Seed dữ liệu
Vào Railway shell của service server:
```bash
npm run db:seed --workspace=server
```

---

## 2. Build kiosk .exe trỏ tới Railway server

```powershell
# Set env trước khi build (PowerShell)
$env:RENDERER_VITE_SERVER_URL = "https://kiosk-server-production.up.railway.app"

cd kiosk
npm run build
npm run package
```

Output: `kiosk/dist/Kiosk-AI-Setup-x.y.z.exe`

---

## 3. Gửi cho BA

1. Upload `.exe` lên Drive / Slack / send file
2. BA double-click cài (Windows SmartScreen sẽ cảnh báo "Unknown publisher" → bấm
   **More info** → **Run anyway**)
3. App tự kết nối Railway server, BA test full flow online

---

## Troubleshooting

| Lỗi | Fix |
|---|---|
| Server crash `K_MASTER is required` | Quên set env vars ở bước 4 |
| Migration fail | Check `DATABASE_URL` có đúng không, Postgres service đã ready chưa |
| MinIO connection refused | `MINIO_ENDPOINT` phải là private domain Railway, không phải `localhost` |
| Kiosk không gọi được server | Check `RENDERER_VITE_SERVER_URL` đã set khi build chưa (rebuild nếu thiếu) |
| BA cảnh báo SmartScreen | Bình thường (chưa code-sign). Bấm "Run anyway" |

## Cost ước tính

Railway free tier: $5 credit/tháng. Setup này ngốn ~$3-4/tháng:
- Server: ~$2 (256MB RAM, light traffic)
- Postgres: ~$1
- MinIO: ~$1

Đủ free tier nếu không scale.
