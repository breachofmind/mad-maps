CREATE TYPE "public"."layer_source_type" AS ENUM('local', 'geojson-url', 'pmtiles-url');--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "source_type" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "source_type" SET DATA TYPE layer_source_type USING "source_type"::layer_source_type;--> statement-breakpoint
ALTER TABLE "layers" ALTER COLUMN "source_type" SET DEFAULT 'local';--> statement-breakpoint
ALTER TABLE "layers" ADD COLUMN "source_layer" text;--> statement-breakpoint
ALTER TABLE "layers" ADD COLUMN "pmtiles_metadata" jsonb;