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
