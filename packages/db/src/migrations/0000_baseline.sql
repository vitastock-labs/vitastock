CREATE TABLE "email_verification_codes" (
	"code" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "email_verification_codes_code_unique" UNIQUE("code"),
	CONSTRAINT "email_verification_codes_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "password_reset_tokens" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"retried_at" timestamp with time zone DEFAULT now() NOT NULL,
	"retry_count" integer DEFAULT 1 NOT NULL,
	"token_hash" text NOT NULL,
	"user_id" uuid NOT NULL,
	CONSTRAINT "password_reset_tokens_email_unique" UNIQUE("email"),
	CONSTRAINT "password_reset_tokens_tokenHash_unique" UNIQUE("token_hash"),
	CONSTRAINT "password_reset_tokens_userId_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"email_verified_at" timestamp with time zone,
	"full_name" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL,
	"login_retry_count" integer DEFAULT 0 NOT NULL,
	"must_change_password" boolean DEFAULT false NOT NULL,
	"password_changed_at" timestamp with time zone,
	"password_hash" text NOT NULL,
	"refresh_token_array" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"temporary_password_issued_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "drugs" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"form" text,
	"generic_name" text NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"low_stock_threshold" integer,
	"name" text NOT NULL,
	"strength" text,
	"unit" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "drug_low_stock_threshold_nonnegative_check" CHECK ("drugs"."low_stock_threshold" >= 0)
);
--> statement-breakpoint
CREATE TABLE "inventory_alert_outbox" (
	"alert_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" text NOT NULL,
	"dispatched_at" timestamp with time zone,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"recipient_email" text NOT NULL,
	"recipient_name" text NOT NULL,
	"type" text NOT NULL,
	"workspace_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "inventory_alerts" (
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by_user_id" uuid,
	"batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"dedupe_key" text NOT NULL,
	"drug_id" uuid NOT NULL,
	"expiry_date" date,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"last_notified_at" timestamp with time zone,
	"quantity_affected" integer,
	"resolved_at" timestamp with time zone,
	"status" text DEFAULT 'active' NOT NULL,
	"threshold" integer,
	"type" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workspace_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock_batches" (
	"batch_number" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"drug_id" uuid NOT NULL,
	"expiry_date" date NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quantity_available" integer NOT NULL,
	"quantity_received" integer NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "stock_batch_quantity_available_check" CHECK ("stock_batches"."quantity_available" >= 0),
	CONSTRAINT "stock_batch_quantity_received_check" CHECK ("stock_batches"."quantity_received" > 0),
	CONSTRAINT "stock_batch_available_lte_received_check" CHECK ("stock_batches"."quantity_available" <= "stock_batches"."quantity_received")
);
--> statement-breakpoint
CREATE TABLE "stock_logs" (
	"batch_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"drug_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"log_type" text NOT NULL,
	"notes" text,
	"performed_by_user_id" uuid NOT NULL,
	"quantity" integer NOT NULL,
	"reason" text,
	"stock_transaction_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "stock_log_quantity_positive_check" CHECK ("stock_logs"."quantity" > 0)
);
--> statement-breakpoint
CREATE TABLE "stock_transactions" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"idempotency_key" uuid NOT NULL,
	"operation" text NOT NULL,
	"performed_by_user_id" uuid NOT NULL,
	"request_hash" text NOT NULL,
	"workspace_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspace_invitations" (
	"accepted_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"default_password_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invited_by_user_id" uuid NOT NULL,
	"invitee_email" text NOT NULL,
	"invitee_name" text NOT NULL,
	"role" text DEFAULT 'pharmacist' NOT NULL,
	"token_hash" text NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"workspace_id" uuid NOT NULL,
	CONSTRAINT "workspace_invitations_tokenHash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "workspace_memberships" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"role" text NOT NULL,
	"suspended_at" timestamp with time zone,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"user_id" uuid NOT NULL,
	"workspace_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "workspaces" (
	"alert_email" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email_alert_delivery_policy" text DEFAULT 'critical_immediate' NOT NULL,
	"email_alerts_enabled_at" timestamp with time zone,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"low_stock_threshold" integer DEFAULT 10 NOT NULL,
	"name" text NOT NULL,
	"near_expiry_days" integer DEFAULT 90 NOT NULL,
	"timezone" text DEFAULT 'Africa/Lagos' NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workspaces_name_unique" UNIQUE("name")
);
--> statement-breakpoint
ALTER TABLE "email_verification_codes" ADD CONSTRAINT "email_verification_codes_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "password_reset_tokens" ADD CONSTRAINT "password_reset_tokens_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "drugs" ADD CONSTRAINT "drugs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alert_outbox" ADD CONSTRAINT "inventory_alert_outbox_alert_id_inventory_alerts_id_fk" FOREIGN KEY ("alert_id") REFERENCES "public"."inventory_alerts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alert_outbox" ADD CONSTRAINT "inventory_alert_outbox_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_acknowledged_by_user_id_users_id_fk" FOREIGN KEY ("acknowledged_by_user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_batch_id_stock_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_drug_id_drugs_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."drugs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_drug_id_drugs_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."drugs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_batches" ADD CONSTRAINT "stock_batches_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_logs" ADD CONSTRAINT "stock_logs_batch_id_stock_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."stock_batches"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_logs" ADD CONSTRAINT "stock_logs_drug_id_drugs_id_fk" FOREIGN KEY ("drug_id") REFERENCES "public"."drugs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_logs" ADD CONSTRAINT "stock_logs_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_logs" ADD CONSTRAINT "stock_logs_stock_transaction_id_stock_transactions_id_fk" FOREIGN KEY ("stock_transaction_id") REFERENCES "public"."stock_transactions"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_logs" ADD CONSTRAINT "stock_logs_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_performed_by_user_id_users_id_fk" FOREIGN KEY ("performed_by_user_id") REFERENCES "public"."users"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_invited_by_user_id_users_id_fk" FOREIGN KEY ("invited_by_user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_invitations" ADD CONSTRAINT "workspace_invitations_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "workspace_memberships" ADD CONSTRAINT "workspace_memberships_workspace_id_workspaces_id_fk" FOREIGN KEY ("workspace_id") REFERENCES "public"."workspaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "drug_workspace_identity_index" ON "drugs" USING btree ("workspace_id",lower(btrim("name")),lower(btrim("generic_name")),coalesce(lower(btrim("strength")), ''),coalesce(lower(btrim("form")), ''),coalesce(lower(btrim("unit")), ''));--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_alert_outbox_dedupe_key_index" ON "inventory_alert_outbox" USING btree ("dedupe_key");--> statement-breakpoint
CREATE INDEX "inventory_alert_outbox_dispatched_at_index" ON "inventory_alert_outbox" USING btree ("dispatched_at");--> statement-breakpoint
CREATE UNIQUE INDEX "inventory_alert_workspace_dedupe_key_index" ON "inventory_alerts" USING btree ("workspace_id","dedupe_key");--> statement-breakpoint
CREATE INDEX "inventory_alert_workspace_status_created_index" ON "inventory_alerts" USING btree ("workspace_id","status","created_at");--> statement-breakpoint
CREATE INDEX "inventory_alert_workspace_acknowledged_index" ON "inventory_alerts" USING btree ("workspace_id","acknowledged_at");--> statement-breakpoint
CREATE INDEX "stock_batch_drug_index" ON "stock_batches" USING btree ("drug_id");--> statement-breakpoint
CREATE INDEX "stock_batch_workspace_expiry_index" ON "stock_batches" USING btree ("workspace_id","expiry_date");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_batch_identity_index" ON "stock_batches" USING btree ("workspace_id","drug_id",coalesce(lower(btrim("batch_number")), ''),"expiry_date");--> statement-breakpoint
CREATE INDEX "stock_log_drug_index" ON "stock_logs" USING btree ("drug_id");--> statement-breakpoint
CREATE INDEX "stock_log_workspace_created_index" ON "stock_logs" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE INDEX "stock_log_transaction_index" ON "stock_logs" USING btree ("stock_transaction_id");--> statement-breakpoint
CREATE UNIQUE INDEX "stock_transaction_workspace_idempotency_key_index" ON "stock_transactions" USING btree ("workspace_id","idempotency_key");--> statement-breakpoint
CREATE INDEX "stock_transaction_workspace_created_index" ON "stock_transactions" USING btree ("workspace_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_membership_single_workspace_per_user_index" ON "workspace_memberships" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "workspace_membership_single_owner_index" ON "workspace_memberships" USING btree ("workspace_id") WHERE "workspace_memberships"."role" = 'owner';--> statement-breakpoint
CREATE INDEX "workspace_membership_workspace_index" ON "workspace_memberships" USING btree ("workspace_id");