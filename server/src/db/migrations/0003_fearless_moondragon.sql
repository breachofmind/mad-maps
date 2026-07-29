CREATE TABLE IF NOT EXISTS "map_features" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"layer_id" uuid NOT NULL,
	"feature_type" text NOT NULL,
	"geometry" geometry(Geometry, 4326) NOT NULL,
	"properties" jsonb DEFAULT '{"title":"","descriptionHtml":"","icon":"marker","color":"#1976d2"}'::jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "map_features" ADD CONSTRAINT "map_features_layer_id_layers_id_fk" FOREIGN KEY ("layer_id") REFERENCES "public"."layers"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
 WHEN duplicate_object THEN null;
END $$;
