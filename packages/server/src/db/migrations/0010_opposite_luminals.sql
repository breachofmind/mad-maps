ALTER TABLE "maps" ALTER COLUMN "base_style" DROP DEFAULT;
ALTER TABLE "maps" ALTER COLUMN "base_style" SET DATA TYPE jsonb USING to_jsonb("base_style");
ALTER TABLE "maps" ALTER COLUMN "base_style" SET DEFAULT '"mapbox://styles/mapbox/streets-v12"'::jsonb;