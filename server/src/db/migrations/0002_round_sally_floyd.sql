CREATE TABLE "kiosk_hardware_events" (
	"id" bigserial PRIMARY KEY NOT NULL,
	"kiosk_id" integer NOT NULL,
	"component" varchar(30) NOT NULL,
	"event_type" varchar(30) NOT NULL,
	"severity" varchar(10) DEFAULT 'info' NOT NULL,
	"detail_json" jsonb,
	"occurred_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "hw_events_component_check" CHECK ("kiosk_hardware_events"."component" IN ('nfc_reader', 'scanner', 'printer', 'camera', 'qr_reader', 'rfid_reader', 'microphone', 'speaker')),
	CONSTRAINT "hw_events_severity_check" CHECK ("kiosk_hardware_events"."severity" IN ('debug', 'info', 'warn', 'error', 'critical'))
);
--> statement-breakpoint
CREATE TABLE "notification_templates" (
	"id" serial PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"channel" varchar(20) NOT NULL,
	"subject_template" text,
	"body_template" text NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "notification_templates_code_unique" UNIQUE("code"),
	CONSTRAINT "notif_templates_channel_check" CHECK ("notification_templates"."channel" IN ('email', 'sms', 'zalo', 'vneid_inbox'))
);
--> statement-breakpoint
ALTER TABLE "purge_job_logs" ALTER COLUMN "id" SET DATA TYPE bigint;--> statement-breakpoint
ALTER SEQUENCE purge_job_logs_id_seq AS bigint;--> statement-breakpoint
ALTER TABLE "kiosk_hardware_events" ADD CONSTRAINT "kiosk_hardware_events_kiosk_id_kiosks_id_fk" FOREIGN KEY ("kiosk_id") REFERENCES "public"."kiosks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "hw_events_kiosk_occurred_idx" ON "kiosk_hardware_events" USING btree ("kiosk_id","occurred_at");--> statement-breakpoint
CREATE INDEX "hw_events_component_idx" ON "kiosk_hardware_events" USING btree ("component","event_type");--> statement-breakpoint
CREATE UNIQUE INDEX "notif_templates_code_channel_idx" ON "notification_templates" USING btree ("code","channel");--> statement-breakpoint
CREATE INDEX "status_logs_to_status_idx" ON "application_status_logs" USING btree ("to_status_id");--> statement-breakpoint
CREATE INDEX "status_logs_from_status_idx" ON "application_status_logs" USING btree ("from_status_id");--> statement-breakpoint
CREATE INDEX "applications_draft_idempotency_idx" ON "applications" USING btree ("session_id","procedure_id") WHERE "applications"."submitted_at" IS NULL AND "applications"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "applications_active_status_idx" ON "applications" USING btree ("status_id","created_at") WHERE "applications"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "applications_citizen_created_idx" ON "applications" USING btree ("citizen_id","created_at") WHERE "applications"."deleted_at" IS NULL;--> statement-breakpoint
CREATE INDEX "sessions_active_idx" ON "sessions" USING btree ("started_at") WHERE "sessions"."ended_at" IS NULL;--> statement-breakpoint
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_severity_check" CHECK ("audit_logs"."event_severity" IN ('debug', 'info', 'warn', 'error', 'critical'));--> statement-breakpoint
ALTER TABLE "feedbacks" ADD CONSTRAINT "feedbacks_rating_score_check" CHECK ("feedbacks"."rating_score" BETWEEN 1 AND 5);--> statement-breakpoint
ALTER TABLE "kiosks" ADD CONSTRAINT "kiosks_status_check" CHECK ("kiosks"."status" IN ('online', 'offline', 'maintenance', 'error'));--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_login_method_check" CHECK ("sessions"."login_method" IN ('cccd_nfc', 'vneid', 'qr', 'guest'));--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_ended_reason_check" CHECK ("sessions"."ended_reason" IS NULL OR "sessions"."ended_reason" IN ('user_exit', 'idle_timeout', 'logout', 'error'));