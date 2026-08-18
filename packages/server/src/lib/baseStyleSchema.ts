import { z } from 'zod';

// Shared by routes/maps.ts (Map.baseStyle) and routes/mapStyles.ts
// (MapStyle.styleUrl) — both accept either a mapbox://styles/... URL or an
// inline Mapbox style spec object (e.g. a raster tile basemap with no
// Mapbox style behind it, like USGS National Map).
const mapboxStyleUrlSchema = z
  .string()
  .regex(/^mapbox:\/\/styles\/[^/]+\/[^/]+$/, 'Must be a mapbox://styles/{username}/{style_id} URL');

const inlineMapStyleSchema = z
  .object({
    version: z.number(),
    sources: z.record(z.unknown()),
    layers: z.array(z.unknown()),
  })
  .passthrough();

export const baseStyleSchema = z.union([mapboxStyleUrlSchema, inlineMapStyleSchema]);
