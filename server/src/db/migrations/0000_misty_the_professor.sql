CREATE TABLE "application_files" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"document_code" varchar(50) NOT NULL,
	"file_name" varchar(255) NOT NULL,
	"file_url" text NOT NULL,
	"file_type" varchar(30) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"file_size" integer NOT NULL,
	"checksum" varchar(64) NOT NULL,
	"ocr_encrypted" boolean DEFAULT true NOT NULL,
	"ocr_ciphertext" "bytea",
	"ocr_iv" "bytea",
	"ocr_auth_tag" "bytea",
	"expires_at" timestamp,
	"uploaded_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_notifications" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"channel" varchar(20) NOT NULL,
	"target_encrypted" text NOT NULL,
	"is_sent" boolean DEFAULT false NOT NULL,
	"sent_at" timestamp,
	"last_error" text,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "application_status_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"from_status_id" integer,
	"to_status_id" integer NOT NULL,
	"changed_by_type" varchar(20) NOT NULL,
	"changed_by_ref" varchar(100),
	"reason_note" text,
	"metadata_json" jsonb,
	"changed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "applications" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"procedure_id" integer NOT NULL,
	"form_version" integer NOT NULL,
	"citizen_id" integer,
	"snapshot_id" integer,
	"tracking_code" varchar(30) NOT NULL,
	"status_id" integer NOT NULL,
	"form_data_encrypted" boolean DEFAULT true NOT NULL,
	"form_data_ciphertext" "bytea",
	"form_data_iv" "bytea",
	"form_data_auth_tag" "bytea",
	"form_data_json" jsonb,
	"submitted_at" timestamp,
	"sent_to_ca_at" timestamp,
	"ca_confirmed_at" timestamp,
	"ca_reference_id" varchar(100),
	"ca_response_json" jsonb,
	"draft_expires_at" timestamp,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "applications_tracking_code_unique" UNIQUE("tracking_code")
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kiosk_id" integer,
	"session_id" integer,
	"event_type" varchar(50) NOT NULL,
	"event_severity" varchar(10) DEFAULT 'info' NOT NULL,
	"metadata_json" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ca_submissions" (
	"id" serial PRIMARY KEY NOT NULL,
	"application_id" integer NOT NULL,
	"endpoint" varchar(500) NOT NULL,
	"payload_json" jsonb NOT NULL,
	"attempt_number" integer DEFAULT 1 NOT NULL,
	"response_status_code" integer,
	"response_json" jsonb,
	"error_message" text,
	"sent_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "citizen_services" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"icon" varchar(255),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "citizen_services_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "citizens" (
	"id" serial PRIMARY KEY NOT NULL,
	"cccd_hash" varchar(64) NOT NULL,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "citizens_cccd_hash_unique" UNIQUE("cccd_hash")
);
--> statement-breakpoint
CREATE TABLE "feedbacks" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer,
	"application_id" integer,
	"feedback_type" varchar(20) DEFAULT 'service' NOT NULL,
	"rating_score" smallint NOT NULL,
	"comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "identity_snapshots" (
	"id" serial PRIMARY KEY NOT NULL,
	"citizen_id" integer NOT NULL,
	"ciphertext" "bytea" NOT NULL,
	"iv" "bytea" NOT NULL,
	"auth_tag" "bytea" NOT NULL,
	"salt" "bytea" NOT NULL,
	"encryption_version" smallint DEFAULT 1 NOT NULL,
	"kdf_algorithm" varchar(20) DEFAULT 'argon2id' NOT NULL,
	"cipher_algorithm" varchar(20) DEFAULT 'aes-256-gcm' NOT NULL,
	"source" varchar(20) NOT NULL,
	"expires_at" timestamp NOT NULL,
	"last_accessed_at" timestamp,
	"access_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "kiosks" (
	"id" serial PRIMARY KEY NOT NULL,
	"device_code" varchar(32) NOT NULL,
	"device_name" varchar(255) NOT NULL,
	"location" varchar(255) NOT NULL,
	"ip_address" varchar(50),
	"status" varchar(20) DEFAULT 'offline' NOT NULL,
	"last_online_at" timestamp,
	"firmware_version" varchar(20),
	"has_cccd_reader" boolean DEFAULT false NOT NULL,
	"has_camera" boolean DEFAULT false NOT NULL,
	"has_scanner" boolean DEFAULT false NOT NULL,
	"has_a4_printer" boolean DEFAULT false NOT NULL,
	"has_qr_reader" boolean DEFAULT false NOT NULL,
	"config_json" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "kiosks_device_code_unique" UNIQUE("device_code")
);
--> statement-breakpoint
CREATE TABLE "print_jobs" (
	"id" serial PRIMARY KEY NOT NULL,
	"kiosk_id" integer NOT NULL,
	"session_id" integer,
	"application_id" integer,
	"procedure_id" integer NOT NULL,
	"form_version" integer NOT NULL,
	"job_type" varchar(20) NOT NULL,
	"printer_name" varchar(100),
	"pages_count" integer DEFAULT 1 NOT NULL,
	"copies" integer DEFAULT 1 NOT NULL,
	"status" varchar(20) DEFAULT 'pending' NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"completed_at" timestamp,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "procedure_form_versions" (
	"id" serial PRIMARY KEY NOT NULL,
	"procedure_id" integer NOT NULL,
	"version" integer NOT NULL,
	"form_schema" jsonb NOT NULL,
	"required_docs" jsonb NOT NULL,
	"blank_template_url" text,
	"filled_template_url" text,
	"template_engine" varchar(20),
	"valid_from" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "procedures" (
	"id" serial PRIMARY KEY NOT NULL,
	"service_id" integer NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"processing_days" integer,
	"current_form_version" integer DEFAULT 1 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "procedures_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "purge_job_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_name" varchar(50) NOT NULL,
	"started_at" timestamp NOT NULL,
	"completed_at" timestamp,
	"records_deleted" integer DEFAULT 0 NOT NULL,
	"error_message" text
);
--> statement-breakpoint
CREATE TABLE "session_messages" (
	"id" serial PRIMARY KEY NOT NULL,
	"session_id" integer NOT NULL,
	"sender_type" varchar(20) NOT NULL,
	"message_type" varchar(20) DEFAULT 'text' NOT NULL,
	"message_content" text NOT NULL,
	"metadata_json" jsonb,
	"audio_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" serial PRIMARY KEY NOT NULL,
	"kiosk_id" integer NOT NULL,
	"citizen_id" integer,
	"snapshot_id" integer,
	"session_token" varchar(128) NOT NULL,
	"login_method" varchar(20) NOT NULL,
	"identity_verified" boolean DEFAULT false NOT NULL,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"ended_at" timestamp,
	"ended_reason" varchar(30),
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_session_token_unique" UNIQUE("session_token")
);
--> statement-breakpoint
CREATE TABLE "snapshot_access_logs" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"snapshot_id" integer NOT NULL,
	"session_id" integer NOT NULL,
	"access_type" varchar(20) NOT NULL,
	"success" boolean NOT NULL,
	"error_message" text,
	"accessed_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "statuses" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(30) NOT NULL,
	"name" varchar(100) NOT NULL,
	"description" text,
	"color" varchar(20),
	"display_order" integer DEFAULT 0 NOT NULL,
	"is_terminal" boolean DEFAULT false NOT NULL,
	CONSTRAINT "statuses_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "application_files" ADD CONSTRAINT "application_files_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_notifications" ADD CONSTRAINT "application_notifications_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_logs" ADD CONSTRAINT "application_status_logs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_logs" ADD CONSTRAINT "application_status_logs_from_status_id_statuses_id_fk" FOREIGN KEY ("from_status_id") REFERENCES "public"."statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "application_status_logs" ADD CONSTRAINT "application_status_logs_to_status_id_statuses_id_fk" FOREIGN KEY ("to_status_id") REFERENCES "public"."statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_procedure_id_procedures_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_citizen_id_citizens_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."citizens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_snapshot_id_identity_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."identity_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "applications" ADD CONSTRAINT "applications_status_id_statuses_id_fk" FOREIGN KEY ("status_id") REFERENCES "public"."statuses"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_kiosk_id_kiosks_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ca_submissions" ADD CONSTRAINT "ca_submissions_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "identity_snapshots" ADD CONSTRAINT "identity_snapshots_citizen_id_citizens_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."citizens"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_kiosk_id_kiosks_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_application_id_applications_id_fk" FOREIGN KEY ("application_id") REFERENCES "public"."applications"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "print_jobs" ADD CONSTRAINT "print_jobs_procedure_id_procedures_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedure_form_versions" ADD CONSTRAINT "procedure_form_versions_procedure_id_procedures_id_fk" FOREIGN KEY ("procedure_id") REFERENCES "public"."procedures"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "procedures" ADD CONSTRAINT "procedures_service_id_citizen_services_id_fk" FOREIGN KEY ("service_id") REFERENCES "public"."citizen_services"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session_messages" ADD CONSTRAINT "session_messages_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_kiosk_id_kiosks_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_citizen_id_citizens_id_fk" FOREIGN KEY ("citizen_id") REFERENCES "public"."citizens"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_snapshot_id_identity_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."identity_snapshots"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot_access_logs" ADD CONSTRAINT "snapshot_access_logs_snapshot_id_identity_snapshots_id_fk" FOREIGN KEY ("snapshot_id") REFERENCES "public"."identity_snapshots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "snapshot_access_logs" ADD CONSTRAINT "snapshot_access_logs_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "files_application_idx" ON "application_files" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "files_expires_at_idx" ON "application_files" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "files_app_doc_idx" ON "application_files" USING btree ("application_id","document_code");--> statement-breakpoint
CREATE INDEX "notifications_application_idx" ON "application_notifications" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "notifications_sent_created_idx" ON "application_notifications" USING btree ("is_sent","created_at");--> statement-breakpoint
CREATE INDEX "status_logs_application_idx" ON "application_status_logs" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "status_logs_app_changed_idx" ON "application_status_logs" USING btree ("application_id","changed_at");--> statement-breakpoint
CREATE UNIQUE INDEX "applications_tracking_code_idx" ON "applications" USING btree ("tracking_code");--> statement-breakpoint
CREATE INDEX "applications_session_idx" ON "applications" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "applications_procedure_idx" ON "applications" USING btree ("procedure_id");--> statement-breakpoint
CREATE INDEX "applications_status_idx" ON "applications" USING btree ("status_id");--> statement-breakpoint
CREATE INDEX "applications_citizen_idx" ON "applications" USING btree ("citizen_id");--> statement-breakpoint
CREATE INDEX "applications_snapshot_idx" ON "applications" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "applications_draft_expires_idx" ON "applications" USING btree ("draft_expires_at");--> statement-breakpoint
CREATE INDEX "applications_status_submitted_idx" ON "applications" USING btree ("status_id","submitted_at");--> statement-breakpoint
CREATE INDEX "applications_submitted_at_idx" ON "applications" USING btree ("submitted_at");--> statement-breakpoint
CREATE INDEX "audit_logs_kiosk_occurred_idx" ON "audit_logs" USING btree ("kiosk_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_session_occurred_idx" ON "audit_logs" USING btree ("session_id","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_event_occurred_idx" ON "audit_logs" USING btree ("event_type","occurred_at");--> statement-breakpoint
CREATE INDEX "audit_logs_occurred_at_idx" ON "audit_logs" USING btree ("occurred_at");--> statement-breakpoint
CREATE INDEX "ca_subs_application_idx" ON "ca_submissions" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "ca_subs_app_attempt_idx" ON "ca_submissions" USING btree ("application_id","attempt_number");--> statement-breakpoint
CREATE INDEX "ca_subs_sent_at_idx" ON "ca_submissions" USING btree ("sent_at");--> statement-breakpoint
CREATE UNIQUE INDEX "services_code_idx" ON "citizen_services" USING btree ("code");--> statement-breakpoint
CREATE INDEX "services_active_order_idx" ON "citizen_services" USING btree ("is_active","display_order");--> statement-breakpoint
CREATE UNIQUE INDEX "citizens_cccd_hash_idx" ON "citizens" USING btree ("cccd_hash");--> statement-breakpoint
CREATE INDEX "feedbacks_application_idx" ON "feedbacks" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "feedbacks_session_idx" ON "feedbacks" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "feedbacks_type_created_idx" ON "feedbacks" USING btree ("feedback_type","created_at");--> statement-breakpoint
CREATE INDEX "snapshots_citizen_idx" ON "identity_snapshots" USING btree ("citizen_id");--> statement-breakpoint
CREATE INDEX "snapshots_expires_at_idx" ON "identity_snapshots" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "snapshots_citizen_expires_idx" ON "identity_snapshots" USING btree ("citizen_id","expires_at");--> statement-breakpoint
CREATE INDEX "kiosks_status_idx" ON "kiosks" USING btree ("status");--> statement-breakpoint
CREATE INDEX "kiosks_last_online_idx" ON "kiosks" USING btree ("last_online_at");--> statement-breakpoint
CREATE INDEX "print_jobs_kiosk_started_idx" ON "print_jobs" USING btree ("kiosk_id","started_at");--> statement-breakpoint
CREATE INDEX "print_jobs_application_idx" ON "print_jobs" USING btree ("application_id");--> statement-breakpoint
CREATE INDEX "print_jobs_status_idx" ON "print_jobs" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "form_versions_procedure_version_idx" ON "procedure_form_versions" USING btree ("procedure_id","version");--> statement-breakpoint
CREATE INDEX "procedures_service_idx" ON "procedures" USING btree ("service_id");--> statement-breakpoint
CREATE UNIQUE INDEX "procedures_code_idx" ON "procedures" USING btree ("code");--> statement-breakpoint
CREATE INDEX "procedures_active_service_idx" ON "procedures" USING btree ("is_active","service_id");--> statement-breakpoint
CREATE INDEX "purge_logs_job_started_idx" ON "purge_job_logs" USING btree ("job_name","started_at");--> statement-breakpoint
CREATE INDEX "session_messages_session_idx" ON "session_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "session_messages_session_created_idx" ON "session_messages" USING btree ("session_id","created_at");--> statement-breakpoint
CREATE INDEX "session_messages_sender_type_idx" ON "session_messages" USING btree ("sender_type","message_type");--> statement-breakpoint
CREATE INDEX "sessions_kiosk_idx" ON "sessions" USING btree ("kiosk_id");--> statement-breakpoint
CREATE INDEX "sessions_citizen_idx" ON "sessions" USING btree ("citizen_id");--> statement-breakpoint
CREATE INDEX "sessions_snapshot_idx" ON "sessions" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "sessions_started_at_idx" ON "sessions" USING btree ("started_at");--> statement-breakpoint
CREATE INDEX "sessions_kiosk_started_idx" ON "sessions" USING btree ("kiosk_id","started_at");--> statement-breakpoint
CREATE INDEX "snapshot_access_snapshot_idx" ON "snapshot_access_logs" USING btree ("snapshot_id");--> statement-breakpoint
CREATE INDEX "snapshot_access_session_idx" ON "snapshot_access_logs" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "snapshot_access_combo_idx" ON "snapshot_access_logs" USING btree ("snapshot_id","accessed_at");