ALTER TABLE "criteria" ALTER COLUMN "created_at" SET DEFAULT timezone('utc'::text, now());--> statement-breakpoint
ALTER TABLE "criteria" ALTER COLUMN "updated_at" SET DEFAULT timezone('utc'::text, now());--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "status" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "status" SET DEFAULT 'setup';--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "created_at" SET DEFAULT timezone('utc'::text, now());--> statement-breakpoint
ALTER TABLE "events" ALTER COLUMN "updated_at" SET DEFAULT timezone('utc'::text, now());--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "score" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "created_at" SET DEFAULT timezone('utc'::text, now());--> statement-breakpoint
ALTER TABLE "scores" ALTER COLUMN "updated_at" SET DEFAULT timezone('utc'::text, now());--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "created_at" SET DEFAULT timezone('utc'::text, now());--> statement-breakpoint
ALTER TABLE "teams" ALTER COLUMN "updated_at" SET DEFAULT timezone('utc'::text, now());--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "role" SET DEFAULT 'judge';--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "created_at" SET DEFAULT timezone('utc'::text, now());--> statement-breakpoint
ALTER TABLE "users" ALTER COLUMN "updated_at" SET DEFAULT timezone('utc'::text, now());--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "check_event_status" CHECK ("events"."status" IN ('setup', 'active', 'completed'));--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "check_user_role" CHECK ("users"."role" IN ('admin', 'judge'));--> statement-breakpoint
DROP TYPE "public"."event_status";--> statement-breakpoint
DROP TYPE "public"."user_role";