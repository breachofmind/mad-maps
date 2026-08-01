ALTER TABLE "map_features" ADD COLUMN "order_index" integer DEFAULT 0 NOT NULL;
--> statement-breakpoint
WITH ordered AS (
	SELECT id, ROW_NUMBER() OVER (PARTITION BY layer_id ORDER BY created_at) - 1 AS rn
	FROM "map_features"
)
UPDATE "map_features" AS mf
SET order_index = ordered.rn
FROM ordered
WHERE mf.id = ordered.id;