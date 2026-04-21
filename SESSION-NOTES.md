# Session Notes — cập nhật sau khi merge UI + refactor

> Đọc file này để resume làm việc. Session gần nhất: merge toàn bộ UI từ
> `D:\QuyDuoi\GiaoDien\kiosk-ai` (vanilla TS) vào repo base React + refactor.

---

## Trạng thái hiện tại

- **UI-only mode**: Backend (argon2, better-sqlite3, drizzle-orm, libsodium) tạm
  disable để tránh blocker native rebuild trên Windows. Chỉ focus code giao diện.
- **17/17 page** đã port sang React. Flow end-to-end login → services →
  cư trú → form → xem trước → nộp thành công thông suốt.
- **AI pipeline core giữ nguyên**: MuseTalkCanvas + VoiceButton +
  ConversationController vẫn hoạt động. Đã lift controller lên app root qua
  `AiProvider` để sẵn sàng Phase 6 integration.
- **0 TypeScript error** trong code merge/refactor (5 pre-existing error
  trong AI services là typing TS 5.x với `Uint8Array<ArrayBuffer>` — không
  phải do merge, không block runtime).

---

## Kiến trúc repo sau merge

```
kiosk/src/renderer/
├── App.tsx                          HashRouter > AiProvider > AppRoutes + VirtualKeyboard
├── main.tsx                         fonts import + globals.css + render App
├── router.tsx                       React.lazy cho 15/17 routes, eager cho Login + ScanGuide
├── providers/
│   └── AiProvider.tsx               Own ConversationController ở app root, expose useAi()
├── components/
│   ├── layout/                      Header, AiSidebar (chứa MuseTalkCanvas + VoiceButton), Layout
│   ├── ui/                          14 reusable: Modal, Dropdown, DatePicker, MultiSelect,
│   │                                ConfirmModal, DraftSavedToast, LuuTruHoSoModal,
│   │                                HoSoDinhKemModal, ProvinceWardSelect, FormFooter...
│   ├── musetalk-canvas/             Pre-existing AI canvas
│   ├── voice-button/                Pure presentation (state từ store)
│   └── virtual-keyboard/            Telex keyboard, auto-show khi focus input
├── pages/                           17 page + 3 subfolder cho form lớn
├── services/                        ConversationController, MuseTalkClient, MicrophoneCapture...
├── store/
│   ├── conversationStore.ts         AI state + messages[] + currentRoute
│   ├── hoKhauFlowStore.ts           Zustand + persist (sessionStorage), flow hộ khẩu
│   ├── sessionUserStore.ts          Session user (mock cho dev, API-fed khi prod)
│   └── layoutStore.ts               Header config
├── hooks/
│   ├── usePageHeader.ts             Config header từng page
│   └── useCurrentUser.ts            Fallback MOCK_USER khi chưa có backend
├── utils/telex.ts                   Vietnamese Telex input engine
└── styles/
    ├── globals.css                  Tailwind + reset + design tokens
    ├── layout.css                   Layout shell styles
    └── pages/*.css                  20 per-page CSS files
```

---

## Setup để chạy tại máy mới

### 1. Clone + install
```bash
cd D:\QuyDuoi\Kiosk-Ai
npm install
node node_modules/electron/install.js   # nếu Electron binary chưa tự download
```

### 2. Tạo `kiosk/.env` (nếu chạy AI)
```
MAIN_VITE_GOOGLE_TTS_API_KEY=...
MAIN_VITE_GOOGLE_STT_API_KEY=...
MAIN_VITE_GEMINI_API_KEY=...
RENDERER_VITE_MUSETALK_URL=ws://localhost:8765/avatar
```
> Không có `.env` → AI pipeline báo "Lỗi kết nối" nhưng UI vẫn chạy bình thường.

### 3. Start VPS MuseTalk (nếu test AI end-to-end)
```bash
ssh musetalk-vps
cd ~/MuseTalk && conda activate musetalk
uvicorn musetalk_api:app --host 0.0.0.0 --port 8000 --workers 1
```
VPS IP có thể đổi sau khi GCP restart — cập nhật 3 chỗ:
- `kiosk/.env` → `RENDERER_VITE_MUSETALK_URL`
- `~/.ssh/config` → `HostName`
- `kiosk/src/renderer/index.html` → CSP `connect-src`

### 4. Run dev
```bash
npm run dev
```

---

## Trạng thái backend

**Tất cả backend code hiện đang disable:**
- `kiosk/package.json` → key `_disabledDeps` chứa argon2, better-sqlite3,
  drizzle-orm, libsodium-wrappers (và types tương ứng trong `_disabledDevDeps`).
- Root `package.json` → key `_disabledWorkspaces` chứa `shared` và `server`.

**Restore sau này:**
1. Cài Python 3.12 + Visual Studio Build Tools (VC++ workload) — cần để
   rebuild native module.
2. Move `_disabledDeps` → `dependencies`, `_disabledDevDeps` → `devDependencies`.
3. Thêm lại script `postinstall: "electron-builder install-app-deps"`.
4. Root `package.json`: `workspaces: ["kiosk", "shared", "server"]`.
5. `npm install`.

---

## Refactor đã làm (12 recommendations từ architect review)

| # | Refactor | File chính |
|---|---|---|
| R1 | Lift `ConversationController` vào `AiProvider` | `providers/AiProvider.tsx`, `App.tsx` |
| R2 | `sessionStorage` → `hoKhauFlowStore` (Zustand + persist) | `store/hoKhauFlowStore.ts` |
| R3 | `CCCD_DATA` hardcode → `useCurrentUser()` hook | `store/sessionUserStore.ts`, `hooks/useCurrentUser.ts` |
| R4 | Bỏ `dangerouslySetInnerHTML` với br/em labels | ConfirmModal, HoSoDinhKemModal, HoKhauTruongHopPage, XacDinhDoiTuongPage |
| R6 | Extract `FormFooter` component | `components/ui/FormFooter.tsx` + 3 form pages |
| R8 | React.lazy 15/17 routes | `router.tsx` |
| R10 | Xóa dead code `avatar/` + `components/avatar-canvas/` + drop `three`, `@pixiv/three-vrm` | `package.json`, vite/tsconfig alias |

**Chưa làm (defer):**
- R5 (DOMPurify sanitize): còn 2 chỗ `dangerouslySetInnerHTML` trong
  `XemTruocHoSoPage` — content từ constants static, safe. Defer khi backend
  integration wire dynamic content.
- R7 (CSS Modules migration): 20 global CSS files — defer post-Phase 6.
- R9 (main/ folder scaffolding cho repository + service layer): defer cùng
  backend restoration.

---

## Flow end-to-end đã chạy được

```
/ (Login)
  → Quét CCCD → /scan-guide → /cccd-verify → /services
  hoặc VNeID → /vneid-login → /services

/services
  → Cư trú & Giấy tờ → /cu-tru

/cu-tru (6 card)
  ├─ Tạm vắng → /xac-dinh-doi-tuong (modal Y/N) → /scan-tam-vang
  │    → /xem-truoc-tam-vang → /tao-khai-bao-tam-vang → /nop-ho-so-thanh-cong
  ├─ Tạm trú → /tam-tru-ho-so (Y/N)
  │    → Đã có: /scan-tam-tru → /xem-truoc-tam-tru → /nop thành công
  │    → Chưa có: /tao-khai-bao-tam-vang
  ├─ Lưu trú → LuuTruHoSoModal (Y/N)
  │    → Đã có: /scan-luu-tru → /xem-truoc-luu-tru → /tao-thong-bao-luu-tru → nộp
  │    → Chưa có: /tao-thong-bao-luu-tru trực tiếp
  └─ Hộ khẩu → /ho-khau-truong-hop (8 card)
       ├─ so-huu → /ho-khau-sinh-song (VN/VK) → HoSoDinhKemModal
       ├─ quan-doi-cong-an → HoSoDinhKemModal trực tiếp
       └─ 6 nhóm khác → /ho-khau-sinh-song (VN/VK) → HoSoDinhKemModal
            → target: /scan-ho-khau (nếu "Đã có") hoặc /tao-ho-so-thuong-tru (chưa có)
            → /xem-truoc-ho-khau → /tao-ho-so-thuong-tru → /nop thành công

Header "Hồ sơ của tôi" → /ho-so-cua-toi (table + filter + date range)
```

---

## Các điểm đáng chú ý

### 1. HashRouter (không phải BrowserRouter)
Chọn HashRouter vì Electron load `file://` URL trong prod → BrowserRouter
sẽ 404 khi navigate đến path có slash. Hash route hoạt động cả dev & prod.

### 2. AI Pipeline lifecycle
`ConversationController` instance sống toàn bộ session app (nằm trong
`AiProvider` trên HashRouter > AppRoutes). Không recreate khi navigate.
Canvas ref cũng stable — truyền từ provider xuống AiSidebar qua context.

### 3. Virtual Keyboard
- Global `focusin` listener tự phát hiện input được focus → mở keyboard.
- Dùng **native value setter** (bypass React SyntheticEvent) để trigger
  onChange cho cả controlled input (useState, react-hook-form).
- Telex engine pure function — test được không cần DOM.

### 4. Form state pattern
- 3 form lớn dùng `useState` thuần (không react-hook-form, vì form logic có
  nhiều custom behavior như auto-fill radio, mirror S1→S3).
- `react-hook-form` + `@hookform/resolvers` đã install — sẵn sàng dùng khi
  port các form mới hoặc migrate form lớn nếu cần.

### 5. CSS strategy
- Giữ CSS gốc của UI repo (20 file `styles/pages/*.css`) — mỗi component
  import file CSS của page/modal tương ứng.
- Tailwind + design tokens trong `tailwind.config.ts` để dùng Tailwind utility
  cho component mới (VoiceButton, AiSidebar dùng Tailwind).
- Có thể migrate CSS Modules sau Phase 6 để tránh class collision.

### 6. sessionStorage contract
`hoKhauFlowStore` dùng Zustand persist → sessionStorage backend. Key duy nhất:
`ho-khau-flow`. Các page/modal subscribe reactive qua hook, không đọc trực
tiếp sessionStorage nữa.

---

## VPS MuseTalk (không đổi từ session trước)

- SSH: `musetalk-vps` @ `35.198.225.143` (GCP — IP có thể đổi sau restart)
- User: `quylhnh_fev35`, key `~/.ssh/id_ed25519`
- Path: `~/MuseTalk/`, file chính `musetalk_api.py` (FastAPI + Uvicorn)
- Endpoint: `ws://<IP>:8000/avatar`, health `http://<IP>:8000/health`
- Conda env: `musetalk`, GPU L4 (BATCH_SIZE=8 sweet spot)
- Idle video: `data/video/idle_nhanvien.mp4` (704×1216, 25fps)

**Quy tắc vận hành:**
- Restart server phải dùng MobaXterm/SSH terminal trực tiếp, không qua SSH
  command trong Claude.
- Backup trước khi patch: `cp musetalk_api.py musetalk_api.py.bak.$(date +%Y%m%d_%H%M%S)`
- Backup gần nhất (từ session AI): `musetalk_api.py.bak.20260420_164326`

---

## Vấn đề còn tồn đọng (note cho session sau)

### Từ session merge này
- 3 nav target cần verify khi chạy thực: `/scan-tam-tru`, `/scan-luu-tru`,
  `/scan-ho-khau` đã wire đúng với page content chưa (vừa fix trong audit).
- Virtual Keyboard cần test IME tiếng Việt trên touch screen kiosk thật
  — hiện mới test trên dev Windows.
- 4 form lớn validation chi tiết chưa có (CCCD 12 số, email format, phone).
  Add zod schema khi cần.
- Upload file danh sách người lưu trú (button "Quét lấy danh sách" trong
  Section IV của TaoThongBaoLuuTru) chưa wire logic.

### Từ session AI pipeline trước (vẫn còn)
- Câu dài (>5s audio) lag frame cuối ~3s vì server MuseTalk ~20fps < 25fps
  yêu cầu. Pipeline CPU/GPU ThreadPoolExecutor đã patch, cần restart server
  + test.
- Debug `console.log('[CC] ...')` trong ConversationController — xoá sau khi stable.
- STT tiếng Việt có thể thử model `chirp` thay `latest_long`.

---

## Lệnh hay dùng

```bash
# Dev
npm run dev                                   # start Electron + Vite

# TypeScript check
cd kiosk && npx tsc --noEmit --project tsconfig.web.json

# Check server health
curl http://35.198.225.143:8000/health

# SSH VPS
ssh musetalk-vps

# Restart Electron binary nếu "Electron uninstall" error
node node_modules/electron/install.js
```

---

## Phase 6 roadmap (AI ↔ UI integration)

Theo architect plan — thứ tự:

1. **Phase 6a** (foundation, 1 ngày): `conversationStore` đã có `messages[]`
   và `currentRoute` sẵn. Controller đã lifted. Sẵn sàng để:
   - Thêm `<ChatArea />` component trong AiSidebar render messages
   - Thêm `<ChatInput />` fallback cho voice
2. **Phase 6b** (ChatArea): bubble list + scroll + animation
3. **Phase 6c** (intent routing): LLM structured-output JSON → `IntentRouter`
   resolve sang navigate() + hoKhauFlowStore mutations. Update
   `llm.handler.ts` để request `responseMimeType: 'application/json'` của
   Gemini + Zod schema.

---

## Phase 7 roadmap (Backend restore)

1. Cài Python 3.12 + VS Build Tools
2. Restore `_disabledDeps` (xem mục "Trạng thái backend" bên trên)
3. `main/repositories/` + `main/services/` + `main/crypto/` skeleton
4. NFC reader IPC → sessionUserStore thay mock
5. Wallet encryption (argon2 KDF + libsodium AES-GCM)
6. Deploy server qua Docker trên VPS nội bộ

---

## Lưu ý quan trọng

1. **Đừng dùng `AudioContext`** trong Electron renderer với `sandbox: true` trên
   Windows → crash. Hiện tại `sandbox: false` trong `main/index.ts`.
2. **React StrictMode** mount 2 lần → không dùng flag guard trong `useEffect([])`.
3. **API keys**: Google STT/TTS dùng `?key=` query param. Gemini dùng
   `x-goog-api-key` header.
4. **GCP IP thay đổi** sau mỗi restart VM → cập nhật 3 chỗ (env, ssh config, CSP).
5. **Không lưu PII vào DB** khi backend restore — hash CCCD bằng
   HMAC-SHA256(cccdNumber, SYSTEM_SECRET). File mã hóa AES-256-GCM. Master key
   từ Argon2 không bao giờ gửi lên server.
