ALTER TABLE "layers" ADD COLUMN "source_type" text DEFAULT 'local' NOT NULL;--> statement-breakpoint
ALTER TABLE "layers" ADD COLUMN "source_url" text;