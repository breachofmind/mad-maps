import { z } from 'zod';
import type { FeatureType } from './types';

// The request Mad Maps sends to a layer's plugin endpoint when a local
// feature is selected. Deliberately minimal — only `properties.title`, not
// color/icon/strokeWidth/etc — so a third-party endpoint only ever learns
// what it needs to look up its own data for this location, not this
// feature's Mad Maps styling.
export interface PluginPanelRequestBody {
  feature: {
    id: string;
    type: FeatureType;
    geometry: GeoJSON.Geometry;
    properties: { title: string };
  };
  layer: { id: string; name: string };
}

const httpUrlSchema = z.string().url().refine((value) => {
  const protocol = new URL(value).protocol;
  return protocol === 'http:' || protocol === 'https:';
}, 'Must be an http(s) URL');

const headingBlockSchema = z.object({ type: z.literal('heading'), text: z.string().max(200) });
const textBlockSchema = z.object({ type: z.literal('text'), text: z.string().max(2000) });
const keyValueBlockSchema = z.object({
  type: z.literal('keyValue'),
  items: z.array(z.object({ label: z.string().max(200), value: z.string().max(200) })).max(20),
});
const imageBlockSchema = z.object({
  type: z.literal('image'),
  url: httpUrlSchema,
  alt: z.string().max(200).optional(),
});
const linkBlockSchema = z.object({
  type: z.literal('link'),
  text: z.string().max(200),
  href: httpUrlSchema,
});

export const pluginPanelBlockSchema = z.discriminatedUnion('type', [
  headingBlockSchema,
  textBlockSchema,
  keyValueBlockSchema,
  imageBlockSchema,
  linkBlockSchema,
]);

export type PluginPanelBlock = z.infer<typeof pluginPanelBlockSchema>;

export const pluginPanelResponseSchema = z.object({
  blocks: z.array(pluginPanelBlockSchema).max(50),
});

export type PluginPanelResponse = z.infer<typeof pluginPanelResponseSchema>;

// A URL-based plugin's identity, fetched via GET to the same
// pluginEndpointUrl the POST content request uses (see
// pluginMetadata.service.ts). Local plugins don't need this — their name/
// description come directly from the loaded registry.
export const pluginMetadataSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(1000),
});

export type PluginMetadata = z.infer<typeof pluginMetadataSchema>;
