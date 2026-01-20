CREATE TABLE "domain_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subdomain" text NOT NULL,
	"user_id" uuid NOT NULL,
	"method" text NOT NULL,
	"path" text NOT NULL,
	"status_code" integer,
	"response_time" integer,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "domains" (
	"subdomain" text PRIMARY KEY NOT NULL,
	"user_id" uuid NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"last_used_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'user' NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"verification_token" text,
	"api_key" text,
	"is_paid" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email"),
	CONSTRAINT "users_api_key_unique" UNIQUE("api_key")
);
--> statement-breakpoint
ALTER TABLE "domain_logs" ADD CONSTRAINT "domain_logs_subdomain_domains_subdomain_fk" FOREIGN KEY ("subdomain") REFERENCES "public"."domains"("subdomain") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domain_logs" ADD CONSTRAINT "domain_logs_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "domains" ADD CONSTRAINT "domains_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;