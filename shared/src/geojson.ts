import { z } from 'zod';

const position = z.tuple([z.number(), z.number()]).rest(z.number());

export const pointGeometrySchema = z.object({
  type: z.literal('Point'),
  coordinates: position,
});

export const lineStringGeometrySchema = z.object({
  type: z.literal('LineString'),
  coordinates: z.array(position).min(2),
});

export const polygonGeometrySchema = z.object({
  type: z.literal('Polygon'),
  coordinates: z.array(z.array(position).min(4)).min(1),
});

export const geometrySchema = z.discriminatedUnion('type', [
  pointGeometrySchema,
  lineStringGeometrySchema,
  polygonGeometrySchema,
]);

export type Geometry = z.infer<typeof geometrySchema>;

export const featureTypeSchema = z.enum(['point', 'line', 'polygon']);

export const mapFeaturePropertiesSchema = z.object({
  title: z.string().max(200).default(''),
  descriptionHtml: z.string().default(''),
  icon: z.string().default('marker'),
  color: z.string().default('#1976d2'),
  strokeWidth: z.number().positive().optional(),
  lineStyle: z.enum(['solid', 'dashed', 'dotted']).optional(),
});

export const geoJsonFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: geometrySchema,
  properties: mapFeaturePropertiesSchema.partial().and(z.record(z.string(), z.unknown())),
});

export const geoJsonFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(geoJsonFeatureSchema),
});

export function geometryToFeatureType(geometry: Geometry): 'point' | 'line' | 'polygon' {
  switch (geometry.type) {
    case 'Point':
      return 'point';
    case 'LineString':
      return 'line';
    case 'Polygon':
      return 'polygon';
  }
}

// A more permissive schema for GeoJSON pulled from external/public data
// sources (e.g. a wildfire perimeter feed). Unlike geometrySchema above —
// which backs individually user-editable map_features rows and is
// deliberately narrow — real-world datasets commonly use Multi* geometry
// types, so those are accepted here. GeometryCollection is still rejected
// (rendered inconsistently across the layer styling below) and the feature
// count is capped to keep an arbitrary external payload from overwhelming
// the map renderer.
export const multiPointGeometrySchema = z.object({
  type: z.literal('MultiPoint'),
  coordinates: z.array(position),
});

export const multiLineStringGeometrySchema = z.object({
  type: z.literal('MultiLineString'),
  coordinates: z.array(z.array(position).min(2)),
});

export const multiPolygonGeometrySchema = z.object({
  type: z.literal('MultiPolygon'),
  coordinates: z.array(z.array(z.array(position).min(4)).min(1)),
});

export const externalGeometrySchema = z.discriminatedUnion('type', [
  pointGeometrySchema,
  lineStringGeometrySchema,
  polygonGeometrySchema,
  multiPointGeometrySchema,
  multiLineStringGeometrySchema,
  multiPolygonGeometrySchema,
]);

export type ExternalGeometry = z.infer<typeof externalGeometrySchema>;

export const EXTERNAL_GEOJSON_MAX_FEATURES = 20_000;

export const externalGeoJsonFeatureSchema = z.object({
  type: z.literal('Feature'),
  geometry: externalGeometrySchema,
  properties: z.record(z.string(), z.unknown()).nullable().optional(),
});

export const externalGeoJsonFeatureCollectionSchema = z.object({
  type: z.literal('FeatureCollection'),
  features: z.array(externalGeoJsonFeatureSchema).max(EXTERNAL_GEOJSON_MAX_FEATURES),
});
