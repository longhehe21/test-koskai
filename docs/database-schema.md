# 📚 KioskAI — Giải thích Database

> Tài liệu giải thích **17 bảng** của hệ thống KioskAI bằng ngôn ngữ dễ hiểu.
> Dùng để onboarding member mới hoặc reference khi code backend.

---

## 🎯 Mục tiêu hệ thống

Kiosk đặt tại UBND/công an xã cho phép công dân **tự nộp hồ sơ thủ tục hành chính** (đăng ký thường trú, tạm trú, tạm vắng, hộ chiếu, CCCD...) mà không cần cán bộ hỗ trợ trực tiếp.

**Phạm vi:**
- ✅ Nộp hồ sơ lên Bộ Công An (BCA)
- ✅ In mẫu đơn A4 cho user điền + ký
- ✅ Quản lý bản nháp (draft) trong 48 tiếng
- ✅ AI hướng dẫn user + tương tác UI
- ❌ **KHÔNG** tự xác nhận hồ sơ (BCA tự xử lý)
- ❌ **KHÔNG** thu tiền (BCA thu phí)

**Bảo mật:**
- KHÔNG lưu PII raw (CCCD, họ tên, địa chỉ)
- Chỉ lưu **HMAC hash** để định danh
- PII vault **mã hoá AES-256-GCM**, TTL 48h, auto-purge

---

## 📋 Danh sách 17 bảng

| # | Bảng | Nhóm | Mô tả 1 dòng |
|---|------|------|--------------|
| 1 | `kiosks` | Hardware | Thiết bị kiosk — 1 máy = 1 record |
| 2 | `citizens` | Identity | Công dân — chỉ lưu hash CCCD |
| 3 | `identity_snapshots` | Identity | Vault PII mã hoá, TTL 48h |
| 4 | `snapshot_access_logs` | Identity | Log mỗi lần giải mã PII |
| 5 | `sessions` | Identity | Phiên làm việc (1 lần user dùng kiosk) |
| 6 | `citizen_services` | Catalog | Dịch vụ cấp 1 (Cư trú, Hộ chiếu...) |
| 7 | `procedures` | Catalog | Thủ tục con (Thường trú, Tạm trú...) |
| 8 | `procedure_form_versions` | Catalog | Version của form + file template in |
| 9 | `statuses` | Catalog | Trạng thái hồ sơ (draft/submitted/...) |
| 10 | `applications` | Submission | Hồ sơ của công dân |
| 11 | `application_files` | Submission | File scan giấy tờ đính kèm |
| 12 | `application_status_logs` | Submission | Lịch sử đổi trạng thái |
| 13 | `application_notifications` | Submission | Email/SMS nhận thông báo kết quả |
| 14 | `ca_submissions` | Submission | Log gửi hồ sơ sang BCA |
| 15 | `print_jobs` | Submission | Lệnh in A4 |
| 16 | `session_messages` | AI | Hội thoại AI + AI action UI |
| 17 | `feedbacks` + `audit_logs` + `purge_job_logs` | Audit | Đánh giá + log bảo mật + log cron |

---

## 1. `kiosks` — Thiết bị kiosk

**Giải thích:** Mỗi cây kiosk đặt ngoài đường = 1 record. Server biết máy nào online, có hardware gì.

### Các cột

| Cột | Kiểu | Ý nghĩa | Ví dụ |
|-----|------|---------|-------|
| `id` | integer | ID tự tăng | `1` |
| `device_code` | varchar(32) | Mã serial in trên case máy | `KIOSK-HN-001` |
| `device_name` | varchar(255) | Tên hiển thị trên dashboard | `Kiosk UBND xã Tây Hồ` |
| `location` | varchar(255) | Địa điểm đặt máy | `Cổng chính UBND xã Tây Hồ` |
| `ip_address` | varchar(50) | IP nội bộ để SSH/debug | `192.168.1.12` |
| `status` | varchar(20) | `online` / `offline` / `error` | `online` |
| `last_online_at` | timestamp | Lần cuối máy ping server | `2026-04-22 09:15:00` |
| `firmware_version` | varchar(20) | Version Electron app đang chạy | `1.2.3` |
| `has_cccd_reader` | boolean | Có đầu đọc chip NFC không? | `true` |
| `has_camera` | boolean | Có camera eKYC không? | `true` |
| `has_scanner` | boolean | Có máy quét A4 không? | `true` |
| `has_a4_printer` | boolean | Có máy in A4 không? | `true` |
| `has_qr_reader` | boolean | Có máy quét QR không? | `false` |
| `config_json` | jsonb | Chi tiết hardware (model, driver...) | `{"printer":"HP LaserJet"}` |
| `created_at`, `updated_at` | timestamp | Metadata | — |

**Use case:**
- Dashboard admin xem máy nào đang offline → gọi kỹ thuật
- Renderer check `has_cccd_reader` trước khi show nút "Quét CCCD"

---

## 2. `citizens` — Công dân

**Giải thích:** Lưu **hash** của số CCCD để biết "người này đã từng dùng kiosk rồi". **KHÔNG lưu số CCCD thật**.

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | ID tự tăng |
| `cccd_hash` | varchar(64) | HMAC-SHA256(cccd_number, SYSTEM_SECRET) — 64 ký tự hex |
| `first_seen_at` | timestamp | Lần đầu user này dùng kiosk |
| `last_login_at` | timestamp | Lần gần nhất user quét CCCD |

**Use case:**
- User A quét CCCD hôm nay → hash → tìm trong bảng → không có → tạo mới
- User A quét CCCD hôm sau → hash → tìm thấy citizen cũ → reuse + update `last_login_at`

**Tại sao hash?** Nếu hacker dump bảng này, không có số CCCD thật để dùng. Hash là 1 chiều, không reverse được.

---

## 3. `identity_snapshots` — Vault PII mã hoá (TRỌNG TÂM BẢO MẬT)

**Giải thích:** Khi user quét CCCD, chip trả về **đầy đủ thông tin PII** (họ tên, ngày sinh, địa chỉ, ảnh chân dung, thường trú, tạm trú...). Mình cần giữ để user bổ sung hồ sơ sau 2 ngày, nên:
- **Mã hoá** toàn bộ PII bằng AES-256-GCM
- Lưu cipher trong DB
- TTL 48 tiếng — sau đó **auto xoá**

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | ID vault |
| `citizen_id` | integer | FK → `citizens.id` |
| `ciphertext` | bytea | **Blob PII đã mã hoá** (JSON plaintext gồm: thường trú, tạm trú, GPLX, gia đình, ảnh...) |
| `iv` | bytea | Initialization Vector 12 bytes — random per encryption |
| `auth_tag` | bytea | GCM tag 16 bytes — verify data không bị sửa |
| `salt` | bytea | Salt 32 bytes random — input cho Argon2 KDF |
| `encryption_version` | smallint | Version để rotate master key sau này |
| `kdf_algorithm` | varchar(20) | `argon2id` (OWASP khuyến nghị) |
| `cipher_algorithm` | varchar(20) | `aes-256-gcm` |
| `source` | varchar(20) | `cccd_nfc` / `vneid_api` / `manual` |
| `expires_at` | timestamp | **`now() + 48h`** — cron xoá khi < now |
| `last_accessed_at` | timestamp | Lần cuối decrypt |
| `access_count` | integer | Đếm số lần decrypt — alert nếu bất thường |
| `created_at` | timestamp | — |

### Luồng mã hoá

```
1. User quét CCCD → chip trả PII (plaintext JSON)
2. Server lấy:
   - K_master (env var, không code leak)
   - citizen_hash (HMAC CCCD)
   - salt (random 32 bytes mới)
3. Derived key K_c = Argon2id(K_master || citizen_hash, salt)
4. Ciphertext = AES-256-GCM(K_c, IV random, PII JSON)
5. Lưu DB: {ciphertext, iv, auth_tag, salt, expires_at = now+48h}
6. Xoá PII plaintext khỏi RAM (sodium.memzero)
```

### Khi user login lại (2 ngày sau)

```
1. Scan CCCD → citizen_hash
2. Query vault còn valid: WHERE citizen_id=x AND expires_at > now()
3. Derive lại K_c = Argon2id(K_master || citizen_hash, vault.salt)
4. Decrypt: AES-256-GCM.decrypt(K_c, vault.iv, vault.ciphertext, vault.auth_tag)
5. Nạp PII vào RAM → hydrate form draft → user tiếp tục
6. access_count++
```

---

## 4. `snapshot_access_logs` — Audit decrypt

**Giải thích:** Ghi lại **mỗi lần** có ai decrypt vault PII. Nếu thấy 10 lần decrypt/phút từ 1 session → alert admin (có thể hacker đang tấn công).

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | bigint | ID log (bigint vì sẽ nhiều) |
| `snapshot_id` | integer | FK → vault nào bị access |
| `session_id` | integer | FK → phiên nào thực hiện |
| `access_type` | varchar(20) | `decrypt` / `re_encrypt` / `extend_ttl` / `purge` |
| `success` | boolean | True = decrypt thành công |
| `error_message` | text | Nếu fail (sai key, tampered...) |
| `accessed_at` | timestamp | Khi access |

---

## 5. `sessions` — Phiên làm việc

**Giải thích:** Mỗi lần user bước đến kiosk dùng = 1 session. Session kết thúc khi user thoát, idle timeout, hoặc logout.

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | ID phiên |
| `kiosk_id` | integer | FK → máy nào |
| `citizen_id` | integer (nullable) | FK → ai đang dùng (null nếu chưa login) |
| `snapshot_id` | integer (nullable) | FK → vault PII đang active trong session |
| `session_token` | varchar(128) | UUID token, client dùng để match WebSocket |
| `login_method` | varchar(20) | `cccd_nfc` / `vneid` / `qr` / `guest` |
| `identity_verified` | boolean | Đã xác thực face match chưa? |
| `started_at` | timestamp | Khi bắt đầu phiên |
| `ended_at` | timestamp (nullable) | Null = đang active |
| `ended_reason` | varchar(30) | `user_exit` / `idle_timeout` / `logout` / `error` |

**Use case:**
- User quét CCCD → create session với snapshot_id
- User đi về không logout → sau 90s idle → `ended_reason = 'idle_timeout'`, `ended_at = now()`
- Cron purge PII: xoá snapshot nếu `expires_at < now` → session.snapshot_id set null

---

## 6. `citizen_services` — Dịch vụ cấp 1

**Giải thích:** Các nhóm dịch vụ lớn hiển thị ở màn chính. User chọn 1 → vào sub-menu.

### Các cột

| Cột | Kiểu | Ý nghĩa | Ví dụ |
|-----|------|---------|-------|
| `id` | integer | — | `1` |
| `code` | varchar(50) | Mã unique | `cu-tru` |
| `name` | varchar(255) | Tên hiển thị | `Cư trú và Giấy tờ tùy thân` |
| `description` | text | Mô tả ngắn | `Đăng ký cư trú, tạm trú, tạm vắng...` |
| `icon` | varchar(255) | Path icon SVG | `/assets/icon-cu-tru.svg` |
| `display_order` | integer | Thứ tự sort | `1` |
| `is_active` | boolean | Còn active không | `true` |
| `deleted_at` | timestamp | Soft delete | `null` |

---

## 7. `procedures` — Thủ tục con

**Giải thích:** Mỗi dịch vụ có nhiều thủ tục. VD: `cu-tru` có 6 thủ tục: thường trú, tạm trú, tạm vắng, lưu trú, gia hạn tạm trú, xoá đăng ký.

### Các cột

| Cột | Kiểu | Ý nghĩa | Ví dụ |
|-----|------|---------|-------|
| `id` | integer | — | `1` |
| `service_id` | integer | FK → dịch vụ cha | `1` (cu-tru) |
| `code` | varchar(50) | Mã unique | `thuong-tru` |
| `name` | varchar(255) | Tên | `Đăng ký thường trú` |
| `description` | text | Mô tả chi tiết | `Hướng dẫn đăng ký thường trú theo NĐ 62/2021/NĐ-CP...` |
| `processing_days` | integer | Thời gian BCA xử lý (ngày) — chỉ để hiển thị tham khảo | `15` |
| `current_form_version` | integer | Version form đang active | `2` |
| `is_active` | boolean | — | — |
| `deleted_at` | timestamp | — | — |

---

## 8. `procedure_form_versions` — Version form + template

**Giải thích:** Form schema có thể đổi theo thời gian (luật mới, field mới). Mỗi version = 1 snapshot. Khi user nộp hồ sơ với version 1 → 6 tháng sau luật đổi version 2 → hồ sơ cũ vẫn render đúng version 1.

Ngoài ra, chứa **file template PDF/DOCX** để in mẫu đơn A4.

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | — |
| `procedure_id` | integer | FK → thủ tục nào |
| `version` | integer | Số version (1, 2, 3...) |
| `form_schema` | jsonb | Định nghĩa fields để render động: `[{"name":"hoTen","type":"text",...}]` |
| `required_docs` | jsonb | Giấy tờ cần đính kèm: `[{"code":"cccd","name":"CCCD","required":true}]` |
| `blank_template_url` | text | File PDF/DOCX mẫu đơn trống — user in ra điền tay |
| `filled_template_url` | text | Template DOCX có `{{hoTen}}` — server merge data → user chỉ ký |
| `template_engine` | varchar(20) | `pdf_stamp` / `docx_merge` / `html_pdf` |
| `valid_from` | timestamp | Từ ngày này version này active |
| `created_at` | timestamp | — |

**Unique:** `(procedure_id, version)` — không cho duplicate version trong cùng thủ tục.

---

## 9. `statuses` — Trạng thái hồ sơ

**Giải thích:** Các trạng thái hồ sơ đi qua trong vòng đời.

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | — |
| `code` | varchar(30) | Mã unique |
| `name` | varchar(100) | Tên hiển thị |
| `description` | text | Giải thích |
| `color` | varchar(20) | Hex để UI paint badge |
| `display_order` | integer | Sort |
| `is_terminal` | boolean | True = trạng thái cuối, không đổi nữa |

### Seed data đề xuất

| code | name | color | is_terminal |
|------|------|-------|-------------|
| `draft` | Bản nháp | `#94a3b8` | false |
| `submitted` | Đã nộp | `#2563eb` | false |
| `sent_to_ca` | Đã gửi BCA | `#0ea5e9` | false |
| `received_by_ca` | BCA đã nhận | `#8b5cf6` | false |
| `processing` | Đang xử lý | `#f59e0b` | false |
| `approved` | Đã duyệt | `#22c55e` | **true** |
| `rejected` | Bị từ chối | `#ef4444` | **true** |
| `cancelled` | Đã hủy | `#64748b` | **true** |

---

## 10. `applications` — Hồ sơ (bảng quan trọng nhất)

**Giải thích:** Mỗi hồ sơ công dân nộp = 1 record.

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | — |
| `session_id` | integer | FK → phiên tạo hồ sơ |
| `procedure_id` | integer | FK → thủ tục |
| `form_version` | integer | Version form lúc tạo (để render lại đúng) |
| `citizen_id` | integer (nullable) | FK → ai nộp (denormalize cho query nhanh) |
| `snapshot_id` | integer (nullable) | FK → vault PII gốc để hydrate khi load draft |
| `tracking_code` | varchar(30) | Mã tra cứu — format `24.03.15.000124` |
| `status_id` | integer | FK → trạng thái hiện tại |
| `form_data_encrypted` | boolean | True = dùng cipher, false = dùng jsonb |
| `form_data_ciphertext` | bytea (nullable) | Form data mã hoá khi draft |
| `form_data_iv` | bytea | IV 12 bytes |
| `form_data_auth_tag` | bytea | GCM tag 16 bytes |
| `form_data_json` | jsonb (nullable) | Form data plaintext (chỉ khi đã wipe PII) |
| `submitted_at` | timestamp | Khi user bấm "Nộp" |
| `sent_to_ca_at` | timestamp | Khi server gửi sang BCA |
| `ca_confirmed_at` | timestamp | Khi BCA xác nhận nhận |
| `ca_reference_id` | varchar(100) | Mã hồ sơ bên BCA trả về |
| `ca_response_json` | jsonb | Response cuối từ BCA (approve/reject reason) |
| `draft_expires_at` | timestamp | TTL cho draft — sau 48h auto-xoá |
| `deleted_at` | timestamp | Soft delete |
| `created_at`, `updated_at` | timestamp | — |

### Luồng status

```
draft → submitted → sent_to_ca → received_by_ca → processing → approved/rejected
  ↑ wipe PII khi sent_to_ca
```

- Trước `sent_to_ca_at`: `form_data_encrypted=true`, dữ liệu nằm trong `form_data_ciphertext`
- Sau `ca_confirmed_at`: server chạy job sanitize → giữ `form_data_json` chỉ có metadata (procedure, tracking, timestamps) → `form_data_encrypted=false`

---

## 11. `application_files` — File scan đính kèm

**Giải thích:** User scan các giấy tờ (CCCD mặt trước/sau, giấy CN quyền sử dụng đất...) → upload MinIO → record metadata ở đây.

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | — |
| `application_id` | integer | FK → hồ sơ |
| `document_code` | varchar(50) | Match với `procedure.required_docs[].code` — biết đây là giấy tờ gì |
| `file_name` | varchar(255) | Tên file gốc |
| `file_url` | text | Path MinIO (đã mã hoá trên object storage) |
| `file_type` | varchar(30) | `image` / `pdf` / `scan_mrz` |
| `mime_type` | varchar(100) | MIME chuẩn |
| `file_size` | integer | Byte |
| `checksum` | varchar(64) | SHA-256 verify integrity |
| `ocr_encrypted` | boolean | OCR data có mã hoá không? |
| `ocr_ciphertext` | bytea | Extracted OCR data đã mã hoá (chứa PII) |
| `ocr_iv`, `ocr_auth_tag` | bytea | GCM metadata |
| `expires_at` | timestamp | TTL — match với `application.draft_expires_at` |
| `uploaded_at` | timestamp | — |

**Note:** Cron xoá file expires → đồng thời xoá blob MinIO qua lifecycle policy.

---

## 12. `application_status_logs` — Lịch sử đổi trạng thái

**Giải thích:** Mỗi lần hồ sơ đổi status = 1 log. Giúp truy vết hồ sơ đi qua những bước nào.

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | — |
| `application_id` | integer | FK |
| `from_status_id` | integer (nullable) | Status cũ (null nếu lần đầu) |
| `to_status_id` | integer | Status mới |
| `changed_by_type` | varchar(20) | `citizen` / `system` / `ca_callback` / `ai` |
| `changed_by_ref` | varchar(100) | session_id/event_id/ca_reference tuỳ type |
| `reason_note` | text | Lý do đổi (BCA từ chối ghi ở đây) |
| `metadata_json` | jsonb | Chi tiết thêm |
| `changed_at` | timestamp | — |

---

## 13. `application_notifications` — Kênh nhận thông báo

**Giải thích:** User chọn nhận kết quả qua email/SMS/Zalo. Record config + status gửi.

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | — |
| `application_id` | integer | FK |
| `channel` | varchar(20) | `email` / `sms` / `zalo` / `vneid_inbox` |
| `target_encrypted` | text | Email/SDT mã hoá AES — decrypt khi gửi |
| `is_sent` | boolean | Đã gửi chưa |
| `sent_at` | timestamp | Khi gửi |
| `last_error` | text | Lỗi lần gửi cuối (nếu fail) |
| `retry_count` | integer | Đã retry bao nhiêu lần |
| `created_at` | timestamp | — |

---

## 14. `ca_submissions` — Log gửi sang BCA

**Giải thích:** Mỗi lần server forward hồ sơ sang BCA = 1 record. Hỗ trợ retry nếu fail.

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | — |
| `application_id` | integer | FK |
| `endpoint` | varchar(500) | URL BCA |
| `payload_json` | jsonb | Data đã sanitize gửi đi |
| `attempt_number` | integer | 1, 2, 3... |
| `response_status_code` | integer | HTTP status BCA trả về |
| `response_json` | jsonb | Body response |
| `error_message` | text | Lỗi network/parse |
| `sent_at` | timestamp | Khi bắt đầu |
| `completed_at` | timestamp | Khi nhận response |

---

## 15. `print_jobs` — Lệnh in A4

**Giải thích:** Mỗi lần kiosk in 1 tờ mẫu đơn = 1 record.

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | — |
| `kiosk_id` | integer | FK → máy nào in |
| `session_id` | integer (nullable) | FK → phiên nào yêu cầu |
| `application_id` | integer (nullable) | FK → hồ sơ nào (null nếu in blank tham khảo) |
| `procedure_id` | integer | FK → thủ tục để biết template |
| `form_version` | integer | Version template dùng |
| `job_type` | varchar(20) | `blank` (điền tay) / `filled` (merge data, chỉ ký) |
| `printer_name` | varchar(100) | Tên máy in trong OS nếu có nhiều |
| `pages_count` | integer | Số trang |
| `copies` | integer | Số bản |
| `status` | varchar(20) | `pending` / `spooling` / `printing` / `completed` / `failed` / `cancelled` |
| `started_at`, `completed_at` | timestamp | — |
| `error_message` | text | — |

---

## 16. `session_messages` — Hội thoại AI + AI action

**Giải thích:** Lưu **mọi message** giữa user và AI trong 1 phiên. Bao gồm:
- User nói hoặc chat
- AI trả lời
- **AI tương tác UI** (navigate, điền form, mở modal)

### Các cột

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | — |
| `session_id` | integer | FK |
| `sender_type` | varchar(20) | `user` / `ai` / `system` |
| `message_type` | varchar(20) | `text` / `voice` / `action` |
| `message_content` | text | Text hoặc transcript voice hoặc mô tả action |
| `metadata_json` | jsonb | Chi tiết — format theo message_type |
| `audio_url` | text | Link voice blob (MinIO encrypted) |
| `created_at` | timestamp | — |

### Ví dụ metadata_json theo `message_type`

**`text`:**
```json
null hoặc { "intent": "help_procedure", "confidence": 0.92 }
```

**`voice`:**
```json
{ "duration_ms": 3200, "language": "vi", "sample_rate": 16000 }
```

**`action` (AI tương tác UI):**
```json
{ "action": "navigate", "target": "/tao-ho-so-thuong-tru" }
{ "action": "fill_field", "field": "hoTen", "value": "Nguyễn Văn A" }
{ "action": "open_modal", "modal": "ConfirmSubmit" }
{ "action": "print_form", "job_type": "filled" }
{ "action": "read_screen", "summary": "Đang ở form thường trú, section IV chưa điền" }
```

**Use case AI-controlled UI:**
- User nói "Tôi muốn đăng ký thường trú"
- AI insert message với `action: navigate, target: /ho-khau-truong-hop`
- Frontend nghe event → navigate
- AI tiếp tục hướng dẫn

---

## 17. Audit + Logging

### `feedbacks` — Đánh giá

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | — |
| `session_id` | integer (nullable) | — |
| `application_id` | integer (nullable) | — |
| `feedback_type` | varchar(20) | `service` / `ai` / `system` |
| `rating_score` | smallint | 1-5 sao |
| `comment` | text | User góp ý |
| `created_at` | timestamp | — |

### `audit_logs` — Log bảo mật toàn hệ thống

Ghi **mọi event quan trọng** để audit trail: login, scan, submit, purge PII, AI action...

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | bigint | Nhiều → bigint |
| `kiosk_id` | integer (nullable) | — |
| `session_id` | integer (nullable) | — |
| `event_type` | varchar(50) | `login`/`logout`/`scan_doc`/`submit`/`idle_timeout`/`purge_pii`/`ai_action`/`ca_send`/`hw_error`/`print_form`/`snapshot_create`/`snapshot_decrypt` |
| `event_severity` | varchar(10) | `debug` / `info` / `warn` / `error` |
| `metadata_json` | jsonb | Chi tiết — **KHÔNG chứa PII raw** |
| `occurred_at` | timestamp | — |

### `purge_job_logs` — Cron health

Monitor cron chạy đúng không, có xoá đủ không.

| Cột | Kiểu | Ý nghĩa |
|-----|------|---------|
| `id` | integer | — |
| `job_name` | varchar(50) | `purge_snapshots` / `purge_draft_apps` / `purge_draft_files` |
| `started_at`, `completed_at` | timestamp | — |
| `records_deleted` | integer | Bao nhiêu record bị xoá |
| `error_message` | text | Nếu job fail |

---

## 🔄 Flow end-to-end ví dụ

### User nộp hồ sơ đăng ký thường trú

```
1. User bước tới kiosk → tap màn → session mới (kiosk_id=1, citizen_id=null)
2. User quét CCCD NFC → chip trả PII JSON
3. Server hash CCCD → tìm citizens → tạo mới id=5
4. Encrypt PII → lưu identity_snapshots.id=10, expires_at=now+48h
5. Update sessions.citizen_id=5, snapshot_id=10
6. User nhìn danh sách dịch vụ → chọn "Cư trú" → chọn "Đăng ký thường trú"
7. User chọn trường hợp, nguồn gốc, scan giấy tờ:
   - Scan giấy CN QSDĐ → OCR → encrypt → save application_files.id=20 với
     application_id=chưa có, expires_at=null (tạm thời)
8. User điền form → save draft:
   - Tạo applications.id=30, status_id=draft, snapshot_id=10, 
     form_data_ciphertext=encrypt(form_data), draft_expires_at=now+48h
   - Update application_files.application_id=30, expires_at=now+48h
   - application_status_logs: null → draft, changed_by=citizen
9. User đi về (chưa nộp xong)
10. [Hôm sau] User quay lại quét CCCD → tìm citizen id=5 → snapshot id=10 còn valid
11. Query draft: applications WHERE citizen_id=5 AND status=draft AND draft_expires_at>now
12. Decrypt form_data → hydrate UI → user bổ sung
13. User bấm "Nộp hồ sơ":
    - applications: status → submitted, submitted_at=now, draft_expires_at=null
    - application_status_logs: draft → submitted
14. Server forward BCA:
    - ca_submissions.id=50, attempt=1, payload_json={...}, response_status=200
    - applications: status → sent_to_ca, sent_to_ca_at=now, ca_reference_id='BCA-xxx'
    - application_status_logs: submitted → sent_to_ca
15. BCA webhook callback confirm nhận:
    - applications: status → received_by_ca, ca_confirmed_at=now
    - Server job wipe form_data_ciphertext → form_data_json minimal, 
      form_data_encrypted=false
    - application_status_logs: sent_to_ca → received_by_ca, changed_by=ca_callback
16. User rate 5 sao + comment "Tuyệt vời" → feedbacks.id=100
17. User về → session idle 90s → ended, ended_reason=idle_timeout
18. [Sau 48h] Cron purge:
    - DELETE identity_snapshots WHERE expires_at < now → xoá vault
    - DELETE applications WHERE status=draft AND draft_expires_at<now (không có ở case này vì đã submit)
    - DELETE application_files WHERE expires_at<now → xoá blob MinIO lifecycle
    - Log purge_job_logs: deleted 1 snapshot
19. Sau khi BCA xử lý (15 ngày):
    - Webhook callback: status → approved
    - application_notifications: gửi email cho user (decrypt target_encrypted, gửi Gmail API)
    - Update is_sent=true
```

---

## 🗂 Quan hệ (summary)

```
kiosks ─< sessions ─< applications ─< application_files
                 │              │
                 │              ├─< application_status_logs
                 │              ├─< application_notifications
                 │              ├─< ca_submissions
                 │              └─ statuses (ref)
                 │
                 ├─< session_messages
                 ├─< snapshot_access_logs
                 └─ citizens ─< identity_snapshots

procedures ─< procedure_form_versions
           ├─ citizen_services (ref)
           └─< print_jobs
```

---

## ⏱ Cron jobs (server cần setup)

Chạy mỗi **1 giờ**:

```sql
-- 1. Xoá snapshot hết hạn
DELETE FROM identity_snapshots WHERE expires_at < now();

-- 2. Xoá draft hết hạn
DELETE FROM applications
  WHERE status_id = (SELECT id FROM statuses WHERE code = 'draft')
    AND draft_expires_at < now();

-- 3. Xoá application_files orphan hoặc expired
DELETE FROM application_files
  WHERE expires_at < now()
     OR application_id NOT IN (SELECT id FROM applications);

-- 4. Log vào purge_job_logs
INSERT INTO purge_job_logs (job_name, started_at, completed_at, records_deleted)
VALUES ('hourly_purge', start_ts, now(), N);
```

---

## 🔒 Security checklist khi triển khai

1. ✅ `K_master` trong env var hoặc HSM, **không hardcode**
2. ✅ Argon2id params: memory 64MB, iterations 3, parallelism 4
3. ✅ AES-256-GCM: IV random 12 bytes **per encryption** (không bao giờ reuse!)
4. ✅ `snapshot_access_logs` audit mọi decrypt → alert bất thường
5. ✅ Rate limit decrypt requests per session (vd max 20/phút)
6. ✅ HTTPS TLS 1.3+ giữa kiosk ↔ server (LAN 2)
7. ✅ Foreign key cascade + cron fallback → xoá không sót
8. ✅ Middleware scrub PII khỏi request/response log
9. ✅ DB backup encrypted at rest + key rotation quarterly
10. ✅ Regular penetration testing trước deploy production
