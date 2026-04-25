/**
 * KioskAI Database Schema — 19 bảng (17 group theo docs + 3 audit tables).
 *
 * Xem docs/database-schema.md để giải thích chi tiết từng bảng.
 *
 * Security notes:
 *  - PII RAW không bao giờ lưu DB — chỉ lưu HMAC hash + encrypted vault
 *  - identity_snapshots có TTL 48h, cron auto-purge
 *  - Draft applications có draft_expires_at cùng TTL
 *  - File blobs trong MinIO được mã hoá AES-256-GCM
 */

import { sql } from 'drizzle-orm';
import {
  bigserial,
  boolean,
  check,
  customType,
  index,
  integer,
  jsonb,
  pgTable,
  serial,
  smallint,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from 'drizzle-orm/pg-core';

// PostgreSQL bytea — binary blob (encrypted ciphertext, iv, auth_tag, salt)
const bytea = customType<{ data: Buffer; default: false }>({
  dataType() {
    return 'bytea';
  },
});

// =========================================================
// 1. kiosks — Thiết bị kiosk + hardware capabilities
// =========================================================
export const kiosks = pgTable(
  'kiosks',
  {
    id: serial('id').primaryKey(),
    deviceCode: varchar('device_code', { length: 32 }).notNull().unique(),
    deviceName: varchar('device_name', { length: 255 }).notNull(),
    location: varchar('location', { length: 255 }).notNull(),
    ipAddress: varchar('ip_address', { length: 50 }),
    status: varchar('status', { length: 20 }).notNull().default('offline'),
    lastOnlineAt: timestamp('last_online_at'),
    firmwareVersion: varchar('firmware_version', { length: 20 }),

    // Hardware capabilities — update runtime khi plug-in hardware
    hasCccdReader: boolean('has_cccd_reader').notNull().default(false),
    hasCamera: boolean('has_camera').notNull().default(false),
    hasScanner: boolean('has_scanner').notNull().default(false),
    hasA4Printer: boolean('has_a4_printer').notNull().default(false),
    hasQrReader: boolean('has_qr_reader').notNull().default(false),
    configJson: jsonb('config_json'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    statusIdx: index('kiosks_status_idx').on(t.status),
    lastOnlineIdx: index('kiosks_last_online_idx').on(t.lastOnlineAt),
    statusCheck: check('kiosks_status_check', sql`${t.status} IN ('online', 'offline', 'maintenance', 'error')`),
  }),
);

// =========================================================
// 2. citizens — Chỉ lưu HMAC hash CCCD, KHÔNG lưu PII raw
// =========================================================
export const citizens = pgTable(
  'citizens',
  {
    id: serial('id').primaryKey(),
    // HMAC-SHA256(cccd_number, SYSTEM_SECRET) — 64 hex chars
    cccdHash: varchar('cccd_hash', { length: 64 }).notNull().unique(),
    firstSeenAt: timestamp('first_seen_at').notNull().defaultNow(),
    lastLoginAt: timestamp('last_login_at'),
  },
  (t) => ({
    cccdHashIdx: uniqueIndex('citizens_cccd_hash_idx').on(t.cccdHash),
  }),
);

// =========================================================
// 3. identity_snapshots — Vault PII mã hoá AES-256-GCM, TTL 48h
// =========================================================
export const identitySnapshots = pgTable(
  'identity_snapshots',
  {
    id: serial('id').primaryKey(),
    citizenId: integer('citizen_id')
      .notNull()
      .references(() => citizens.id, { onDelete: 'cascade' }),

    // Encrypted PII JSON blob
    ciphertext: bytea('ciphertext').notNull(),
    iv: bytea('iv').notNull(), // 12 bytes GCM
    authTag: bytea('auth_tag').notNull(), // 16 bytes GCM
    salt: bytea('salt').notNull(), // 32 bytes Argon2 salt
    encryptionVersion: smallint('encryption_version').notNull().default(1),
    kdfAlgorithm: varchar('kdf_algorithm', { length: 20 })
      .notNull()
      .default('argon2id'),
    cipherAlgorithm: varchar('cipher_algorithm', { length: 20 })
      .notNull()
      .default('aes-256-gcm'),

    source: varchar('source', { length: 20 }).notNull(), // cccd_nfc | vneid_api | manual
    expiresAt: timestamp('expires_at').notNull(),
    lastAccessedAt: timestamp('last_accessed_at'),
    accessCount: integer('access_count').notNull().default(0),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    citizenIdx: index('snapshots_citizen_idx').on(t.citizenId),
    expiresAtIdx: index('snapshots_expires_at_idx').on(t.expiresAt),
    citizenExpiresIdx: index('snapshots_citizen_expires_idx').on(
      t.citizenId,
      t.expiresAt,
    ),
  }),
);

// =========================================================
// 5. sessions — Phiên làm việc
// (Khai báo trước snapshot_access_logs vì access_logs ref sessions)
// =========================================================
export const sessions = pgTable(
  'sessions',
  {
    id: serial('id').primaryKey(),
    kioskId: integer('kiosk_id')
      .notNull()
      .references(() => kiosks.id),
    citizenId: integer('citizen_id').references(() => citizens.id),
    snapshotId: integer('snapshot_id').references(() => identitySnapshots.id, {
      onDelete: 'set null', // snapshot expire không đồng thời phá session
    }),

    sessionToken: varchar('session_token', { length: 128 }).notNull().unique(),
    loginMethod: varchar('login_method', { length: 20 }).notNull(), // cccd_nfc | vneid | qr | guest
    identityVerified: boolean('identity_verified').notNull().default(false),

    startedAt: timestamp('started_at').notNull().defaultNow(),
    endedAt: timestamp('ended_at'),
    endedReason: varchar('ended_reason', { length: 30 }), // user_exit | idle_timeout | logout | error

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    kioskIdx: index('sessions_kiosk_idx').on(t.kioskId),
    citizenIdx: index('sessions_citizen_idx').on(t.citizenId),
    snapshotIdx: index('sessions_snapshot_idx').on(t.snapshotId),
    startedAtIdx: index('sessions_started_at_idx').on(t.startedAt),
    kioskStartedIdx: index('sessions_kiosk_started_idx').on(t.kioskId, t.startedAt),
    // L4: partial index cho query "active sessions" trên dashboard
    activeSessionsIdx: index('sessions_active_idx').on(t.startedAt).where(sql`${t.endedAt} IS NULL`),
    loginMethodCheck: check('sessions_login_method_check', sql`${t.loginMethod} IN ('cccd_nfc', 'vneid', 'qr', 'guest')`),
    endedReasonCheck: check('sessions_ended_reason_check', sql`${t.endedReason} IS NULL OR ${t.endedReason} IN ('user_exit', 'idle_timeout', 'logout', 'error')`),
  }),
);

// =========================================================
// 4. snapshot_access_logs — Audit mỗi lần decrypt vault
// =========================================================
export const snapshotAccessLogs = pgTable(
  'snapshot_access_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    snapshotId: integer('snapshot_id')
      .notNull()
      .references(() => identitySnapshots.id, { onDelete: 'cascade' }),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id),
    accessType: varchar('access_type', { length: 20 }).notNull(), // decrypt | re_encrypt | extend_ttl | purge
    success: boolean('success').notNull(),
    errorMessage: text('error_message'),
    accessedAt: timestamp('accessed_at').notNull().defaultNow(),
  },
  (t) => ({
    snapshotIdx: index('snapshot_access_snapshot_idx').on(t.snapshotId),
    sessionIdx: index('snapshot_access_session_idx').on(t.sessionId),
    snapshotAccessedIdx: index('snapshot_access_combo_idx').on(
      t.snapshotId,
      t.accessedAt,
    ),
  }),
);

// =========================================================
// 6. citizen_services — Dịch vụ cấp 1 (Cư trú, Hộ chiếu, CCCD)
// =========================================================
export const citizenServices = pgTable(
  'citizen_services',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    icon: varchar('icon', { length: 255 }),
    displayOrder: integer('display_order').notNull().default(0),
    isActive: boolean('is_active').notNull().default(true),

    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    codeIdx: uniqueIndex('services_code_idx').on(t.code),
    activeOrderIdx: index('services_active_order_idx').on(
      t.isActive,
      t.displayOrder,
    ),
  }),
);

// =========================================================
// 7. procedures — Thủ tục con (Thường trú, Tạm trú, Tạm vắng...)
// =========================================================
export const procedures = pgTable(
  'procedures',
  {
    id: serial('id').primaryKey(),
    serviceId: integer('service_id')
      .notNull()
      .references(() => citizenServices.id),
    code: varchar('code', { length: 50 }).notNull().unique(),
    name: varchar('name', { length: 255 }).notNull(),
    description: text('description'),
    processingDays: integer('processing_days'),
    currentFormVersion: integer('current_form_version').notNull().default(1),

    isActive: boolean('is_active').notNull().default(true),
    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    serviceIdx: index('procedures_service_idx').on(t.serviceId),
    codeIdx: uniqueIndex('procedures_code_idx').on(t.code),
    activeServiceIdx: index('procedures_active_service_idx').on(
      t.isActive,
      t.serviceId,
    ),
  }),
);

// =========================================================
// 8. procedure_form_versions — Schema + template file in A4
// =========================================================
export const procedureFormVersions = pgTable(
  'procedure_form_versions',
  {
    id: serial('id').primaryKey(),
    procedureId: integer('procedure_id')
      .notNull()
      .references(() => procedures.id, { onDelete: 'cascade' }),
    version: integer('version').notNull(),

    formSchema: jsonb('form_schema').notNull(),
    requiredDocs: jsonb('required_docs').notNull(),

    // Template file A4 để in
    blankTemplateUrl: text('blank_template_url'),
    filledTemplateUrl: text('filled_template_url'),
    templateEngine: varchar('template_engine', { length: 20 }), // pdf_stamp | docx_merge | html_pdf

    validFrom: timestamp('valid_from').notNull().defaultNow(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    procedureVersionIdx: uniqueIndex('form_versions_procedure_version_idx').on(
      t.procedureId,
      t.version,
    ),
  }),
);

// =========================================================
// 9. statuses — Trạng thái hồ sơ
// =========================================================
export const statuses = pgTable('statuses', {
  id: serial('id').primaryKey(),
  code: varchar('code', { length: 30 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  description: text('description'),
  color: varchar('color', { length: 20 }),
  displayOrder: integer('display_order').notNull().default(0),
  isTerminal: boolean('is_terminal').notNull().default(false),
});

// =========================================================
// 10. applications — Hồ sơ (trọng tâm)
// =========================================================
export const applications = pgTable(
  'applications',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id),
    procedureId: integer('procedure_id')
      .notNull()
      .references(() => procedures.id),
    formVersion: integer('form_version').notNull(),
    citizenId: integer('citizen_id').references(() => citizens.id),
    snapshotId: integer('snapshot_id').references(() => identitySnapshots.id, {
      onDelete: 'set null',
    }),

    trackingCode: varchar('tracking_code', { length: 30 }).notNull().unique(),
    statusId: integer('status_id')
      .notNull()
      .references(() => statuses.id),

    // Form data — encrypted khi draft hoặc còn PII; plaintext metadata sau wipe
    formDataEncrypted: boolean('form_data_encrypted').notNull().default(true),
    formDataCiphertext: bytea('form_data_ciphertext'),
    formDataIv: bytea('form_data_iv'),
    formDataAuthTag: bytea('form_data_auth_tag'),
    formDataJson: jsonb('form_data_json'),

    // Timeline
    submittedAt: timestamp('submitted_at'),
    sentToCaAt: timestamp('sent_to_ca_at'),
    caConfirmedAt: timestamp('ca_confirmed_at'),

    // Reference BCA
    caReferenceId: varchar('ca_reference_id', { length: 100 }),
    caResponseJson: jsonb('ca_response_json'),

    // TTL cho draft
    draftExpiresAt: timestamp('draft_expires_at'),

    deletedAt: timestamp('deleted_at'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    trackingCodeIdx: uniqueIndex('applications_tracking_code_idx').on(
      t.trackingCode,
    ),
    sessionIdx: index('applications_session_idx').on(t.sessionId),
    procedureIdx: index('applications_procedure_idx').on(t.procedureId),
    statusIdx: index('applications_status_idx').on(t.statusId),
    citizenIdx: index('applications_citizen_idx').on(t.citizenId),
    snapshotIdx: index('applications_snapshot_idx').on(t.snapshotId),
    draftExpiresIdx: index('applications_draft_expires_idx').on(t.draftExpiresAt),
    statusSubmittedIdx: index('applications_status_submitted_idx').on(t.statusId, t.submittedAt),
    submittedAtIdx: index('applications_submitted_at_idx').on(t.submittedAt),
    // H1: idempotency check khi createDraft
    draftIdempotencyIdx: index('applications_draft_idempotency_idx')
      .on(t.sessionId, t.procedureId)
      .where(sql`${t.submittedAt} IS NULL AND ${t.deletedAt} IS NULL`),
    // H5: dashboard query theo status trên hồ sơ chưa xóa
    activeStatusIdx: index('applications_active_status_idx')
      .on(t.statusId, t.createdAt)
      .where(sql`${t.deletedAt} IS NULL`),
    // M4: listByCitizen sort theo createdAt
    citizenCreatedIdx: index('applications_citizen_created_idx')
      .on(t.citizenId, t.createdAt)
      .where(sql`${t.deletedAt} IS NULL`),
  }),
);

// =========================================================
// 11. application_files — File scan đính kèm
// =========================================================
export const applicationFiles = pgTable(
  'application_files',
  {
    id: serial('id').primaryKey(),
    applicationId: integer('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    documentCode: varchar('document_code', { length: 100 }).notNull(),
    fileName: varchar('file_name', { length: 255 }).notNull(),
    fileUrl: text('file_url').notNull(), // MinIO path, blob đã mã hoá
    fileType: varchar('file_type', { length: 30 }).notNull(), // image | pdf | scan_mrz
    mimeType: varchar('mime_type', { length: 100 }).notNull(),
    fileSize: integer('file_size').notNull(),
    checksum: varchar('checksum', { length: 64 }).notNull(), // SHA-256 hex

    // OCR data — encrypted vì chứa PII
    ocrEncrypted: boolean('ocr_encrypted').notNull().default(true),
    ocrCiphertext: bytea('ocr_ciphertext'),
    ocrIv: bytea('ocr_iv'),
    ocrAuthTag: bytea('ocr_auth_tag'),

    expiresAt: timestamp('expires_at'),
    uploadedAt: timestamp('uploaded_at').notNull().defaultNow(),
  },
  (t) => ({
    applicationIdx: index('files_application_idx').on(t.applicationId),
    expiresAtIdx: index('files_expires_at_idx').on(t.expiresAt),
    appDocIdx: index('files_app_doc_idx').on(t.applicationId, t.documentCode),
  }),
);

// =========================================================
// 12. application_status_logs — Lịch sử đổi trạng thái
// =========================================================
export const applicationStatusLogs = pgTable(
  'application_status_logs',
  {
    id: serial('id').primaryKey(),
    applicationId: integer('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    fromStatusId: integer('from_status_id').references(() => statuses.id),
    toStatusId: integer('to_status_id')
      .notNull()
      .references(() => statuses.id),
    changedByType: varchar('changed_by_type', { length: 20 }).notNull(), // citizen | system | ca_callback | ai
    changedByRef: varchar('changed_by_ref', { length: 100 }),
    reasonNote: text('reason_note'),
    metadataJson: jsonb('metadata_json'),
    changedAt: timestamp('changed_at').notNull().defaultNow(),
  },
  (t) => ({
    applicationIdx: index('status_logs_application_idx').on(t.applicationId),
    appChangedIdx: index('status_logs_app_changed_idx').on(t.applicationId, t.changedAt),
    // H6: FK columns cần index để JOIN nhanh
    toStatusIdx: index('status_logs_to_status_idx').on(t.toStatusId),
    fromStatusIdx: index('status_logs_from_status_idx').on(t.fromStatusId),
  }),
);

// =========================================================
// 13. application_notifications — Email/SMS/Zalo nhận kết quả
// =========================================================
export const applicationNotifications = pgTable(
  'application_notifications',
  {
    id: serial('id').primaryKey(),
    applicationId: integer('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    channel: varchar('channel', { length: 20 }).notNull(), // email | sms | zalo | vneid_inbox
    targetEncrypted: text('target_encrypted').notNull(), // Base64 AES
    isSent: boolean('is_sent').notNull().default(false),
    sentAt: timestamp('sent_at'),
    lastError: text('last_error'),
    retryCount: integer('retry_count').notNull().default(0),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    applicationIdx: index('notifications_application_idx').on(t.applicationId),
    sentCreatedIdx: index('notifications_sent_created_idx').on(
      t.isSent,
      t.createdAt,
    ),
  }),
);

// =========================================================
// 14. ca_submissions — Log forward hồ sơ BCA, retry-able
// =========================================================
export const caSubmissions = pgTable(
  'ca_submissions',
  {
    id: serial('id').primaryKey(),
    applicationId: integer('application_id')
      .notNull()
      .references(() => applications.id, { onDelete: 'cascade' }),
    endpoint: varchar('endpoint', { length: 500 }).notNull(),
    payloadJson: jsonb('payload_json').notNull(),
    attemptNumber: integer('attempt_number').notNull().default(1),

    responseStatusCode: integer('response_status_code'),
    responseJson: jsonb('response_json'),
    errorMessage: text('error_message'),

    sentAt: timestamp('sent_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
  },
  (t) => ({
    applicationIdx: index('ca_subs_application_idx').on(t.applicationId),
    appAttemptIdx: index('ca_subs_app_attempt_idx').on(
      t.applicationId,
      t.attemptNumber,
    ),
    sentAtIdx: index('ca_subs_sent_at_idx').on(t.sentAt),
  }),
);

// =========================================================
// 15. print_jobs — Lệnh in A4 mẫu đơn
// =========================================================
export const printJobs = pgTable(
  'print_jobs',
  {
    id: serial('id').primaryKey(),
    kioskId: integer('kiosk_id')
      .notNull()
      .references(() => kiosks.id),
    sessionId: integer('session_id').references(() => sessions.id),
    applicationId: integer('application_id').references(() => applications.id, {
      onDelete: 'set null',
    }),
    procedureId: integer('procedure_id')
      .notNull()
      .references(() => procedures.id),
    formVersion: integer('form_version').notNull(),

    jobType: varchar('job_type', { length: 20 }).notNull(), // blank | filled
    printerName: varchar('printer_name', { length: 100 }),
    pagesCount: integer('pages_count').notNull().default(1),
    copies: integer('copies').notNull().default(1),

    status: varchar('status', { length: 20 }).notNull().default('pending'), // pending | spooling | printing | completed | failed | cancelled
    startedAt: timestamp('started_at').notNull().defaultNow(),
    completedAt: timestamp('completed_at'),
    errorMessage: text('error_message'),
  },
  (t) => ({
    kioskStartedIdx: index('print_jobs_kiosk_started_idx').on(
      t.kioskId,
      t.startedAt,
    ),
    applicationIdx: index('print_jobs_application_idx').on(t.applicationId),
    statusIdx: index('print_jobs_status_idx').on(t.status),
  }),
);

// =========================================================
// 16. session_messages — Hội thoại AI + AI action UI
// =========================================================
export const sessionMessages = pgTable(
  'session_messages',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id')
      .notNull()
      .references(() => sessions.id, { onDelete: 'cascade' }),

    senderType: varchar('sender_type', { length: 20 }).notNull(), // user | ai | system
    messageType: varchar('message_type', { length: 20 }).notNull().default('text'), // text | voice | action
    messageContent: text('message_content').notNull(),

    // Khi action: {action, target, params}
    metadataJson: jsonb('metadata_json'),
    audioUrl: text('audio_url'),

    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    sessionIdx: index('session_messages_session_idx').on(t.sessionId),
    sessionCreatedIdx: index('session_messages_session_created_idx').on(
      t.sessionId,
      t.createdAt,
    ),
    senderTypeIdx: index('session_messages_sender_type_idx').on(
      t.senderType,
      t.messageType,
    ),
  }),
);

// =========================================================
// 17. feedbacks — Đánh giá dịch vụ
// =========================================================
export const feedbacks = pgTable(
  'feedbacks',
  {
    id: serial('id').primaryKey(),
    sessionId: integer('session_id').references(() => sessions.id),
    applicationId: integer('application_id').references(() => applications.id),
    feedbackType: varchar('feedback_type', { length: 20 })
      .notNull()
      .default('service'), // service | ai | system
    ratingScore: smallint('rating_score').notNull(), // 1..5
    comment: text('comment'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
  },
  (t) => ({
    applicationIdx: index('feedbacks_application_idx').on(t.applicationId),
    sessionIdx: index('feedbacks_session_idx').on(t.sessionId),
    typeCreatedIdx: index('feedbacks_type_created_idx').on(t.feedbackType, t.createdAt),
    // M2: chặn điểm không hợp lệ
    ratingCheck: check('feedbacks_rating_score_check', sql`${t.ratingScore} BETWEEN 1 AND 5`),
  }),
);

// =========================================================
// 18. audit_logs — Log bảo mật toàn hệ thống
// =========================================================
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    kioskId: integer('kiosk_id').references(() => kiosks.id),
    sessionId: integer('session_id').references(() => sessions.id),

    eventType: varchar('event_type', { length: 50 }).notNull(),
    eventSeverity: varchar('event_severity', { length: 10 })
      .notNull()
      .default('info'),
    metadataJson: jsonb('metadata_json'),

    occurredAt: timestamp('occurred_at').notNull().defaultNow(),
  },
  (t) => ({
    kioskOccurredIdx: index('audit_logs_kiosk_occurred_idx').on(t.kioskId, t.occurredAt),
    sessionOccurredIdx: index('audit_logs_session_occurred_idx').on(t.sessionId, t.occurredAt),
    eventOccurredIdx: index('audit_logs_event_occurred_idx').on(t.eventType, t.occurredAt),
    occurredAtIdx: index('audit_logs_occurred_at_idx').on(t.occurredAt),
    // L5: chặn severity không hợp lệ
    severityCheck: check('audit_logs_severity_check', sql`${t.eventSeverity} IN ('debug', 'info', 'warn', 'error', 'critical')`),
  }),
);

// =========================================================
// 19. purge_job_logs — Health check cho cron job
// =========================================================
export const purgeJobLogs = pgTable(
  'purge_job_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(), // H7: bigserial tránh overflow khi cron chạy nhiều năm
    jobName: varchar('job_name', { length: 50 }).notNull(), // purge_snapshots | purge_draft_apps | purge_draft_files
    startedAt: timestamp('started_at').notNull(),
    completedAt: timestamp('completed_at'),
    recordsDeleted: integer('records_deleted').notNull().default(0),
    errorMessage: text('error_message'),
  },
  (t) => ({
    jobStartedIdx: index('purge_logs_job_started_idx').on(t.jobName, t.startedAt),
  }),
);

// =========================================================
// 20. kiosk_hardware_events — M5: track lỗi phần cứng theo cấu kiện
// =========================================================
export const kioskHardwareEvents = pgTable(
  'kiosk_hardware_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    kioskId: integer('kiosk_id')
      .notNull()
      .references(() => kiosks.id, { onDelete: 'cascade' }),
    component: varchar('component', { length: 30 }).notNull(), // nfc_reader | scanner | printer | camera | qr_reader
    eventType: varchar('event_type', { length: 30 }).notNull(), // error | warning | recovery | status_change
    severity: varchar('severity', { length: 10 }).notNull().default('info'),
    detailJson: jsonb('detail_json'),
    occurredAt: timestamp('occurred_at').notNull().defaultNow(),
  },
  (t) => ({
    kioskOccurredIdx: index('hw_events_kiosk_occurred_idx').on(t.kioskId, t.occurredAt),
    componentIdx: index('hw_events_component_idx').on(t.component, t.eventType),
    componentCheck: check('hw_events_component_check', sql`${t.component} IN ('nfc_reader', 'scanner', 'printer', 'camera', 'qr_reader', 'rfid_reader', 'microphone', 'speaker')`),
    severityCheck: check('hw_events_severity_check', sql`${t.severity} IN ('debug', 'info', 'warn', 'error', 'critical')`),
  }),
);

// =========================================================
// 21. notification_templates — M6: template SMS/Email/Zalo không hardcode trong code
// =========================================================
export const notificationTemplates = pgTable(
  'notification_templates',
  {
    id: serial('id').primaryKey(),
    code: varchar('code', { length: 50 }).notNull().unique(), // e.g. 'application_submitted', 'application_approved'
    channel: varchar('channel', { length: 20 }).notNull(), // email | sms | zalo | vneid_inbox
    subjectTemplate: text('subject_template'), // cho email
    bodyTemplate: text('body_template').notNull(), // {{trackingCode}}, {{procedureName}}...
    isActive: boolean('is_active').notNull().default(true),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => ({
    codeChannelIdx: uniqueIndex('notif_templates_code_channel_idx').on(t.code, t.channel),
    channelCheck: check('notif_templates_channel_check', sql`${t.channel} IN ('email', 'sms', 'zalo', 'vneid_inbox')`),
  }),
);
