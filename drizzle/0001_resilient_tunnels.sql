ALTER TABLE "domains" ADD COLUMN "access_token" text;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "basic_auth_username" text;
--> statement-breakpoint
ALTER TABLE "domains" ADD COLUMN "basic_auth_password_hash" text;
--> statement-breakpoint
ALTER TABLE "domain_logs" ADD COLUMN "bytes_in" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "domain_logs" ADD COLUMN "bytes_out" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
ALTER TABLE "domain_logs" ADD COLUMN "error_message" text;
--> statement-breakpoint
ALTER TABLE "domain_logs" ADD COLUMN "request_headers" jsonb;
--> statement-breakpoint
ALTER TABLE "domain_logs" ADD COLUMN "response_headers" jsonb;
--> statement-breakpoint
ALTER TABLE "domain_logs" ADD COLUMN "request_body" text;
--> statement-breakpoint
ALTER TABLE "domain_logs" ADD COLUMN "response_body" text;
--> statement-breakpoint
CREATE TABLE "cli_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"api_key" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"completed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "active_tunnels" (
	"subdomain" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"instance_id" text NOT NULL,
	"instance_url" text NOT NULL,
	"connection_id" text NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"public_url" text NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_heartbeat_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_tunnels" ADD CONSTRAINT "active_tunnels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
CREATE TABLE "active_tcp_tunnels" (
	"public_port" integer PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"instance_id" text NOT NULL,
	"instance_url" text NOT NULL,
	"connection_id" text NOT NULL,
	"public_host" text NOT NULL,
	"connected_at" timestamp DEFAULT now() NOT NULL,
	"last_heartbeat_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "active_tcp_tunnels" ADD CONSTRAINT "active_tcp_tunnels_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
