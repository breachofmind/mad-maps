import fs from 'node:fs';
import path from 'node:path';
import type { FeatureType, MapFeaturePropertiesDTO, PluginPanelResponse } from '@mad-maps/shared';

export interface PluginHandlerArgs {
  feature: {
    id: string;
    type: FeatureType;
    geometry: GeoJSON.Geometry;
    properties: MapFeaturePropertiesDTO;
  };
  layer: { id: string; name: string };
  map: { id: string; title: string };
}

export type PluginHandler = (args: PluginHandlerArgs) => PluginPanelResponse | Promise<PluginPanelResponse>;

export interface MadMapsPlugin {
  name: string;
  description: string;
  handler: PluginHandler;
}

interface LoadedPlugin extends MadMapsPlugin {
  id: string;
}

const registry = new Map<string, LoadedPlugin>();

function isValidPlugin(mod: unknown): mod is MadMapsPlugin {
  return (
    typeof mod === 'object' &&
    mod !== null &&
    typeof (mod as MadMapsPlugin).name === 'string' &&
    typeof (mod as MadMapsPlugin).description === 'string' &&
    typeof (mod as MadMapsPlugin).handler === 'function'
  );
}

// Loads every top-level .js file in `dir` as a CommonJS plugin module,
// replacing the current registry. A malformed file (missing/wrong-typed
// name/description/handler, or one that throws on require) is logged and
// skipped rather than aborting startup — one bad plugin shouldn't take down
// the server. Plugin id is the filename minus its .js extension; directory
// entries are inherently unique, so no collision handling is needed.
export function loadPlugins(dir: string): void {
  registry.clear();

  let entries: string[];
  try {
    entries = fs.readdirSync(dir);
  } catch (err) {
    console.warn(`[plugins] Could not read PLUGINS_DIR "${dir}": ${(err as Error).message}`);
    return;
  }

  for (const entry of entries) {
    if (!entry.endsWith('.js')) continue;
    const id = entry.slice(0, -'.js'.length);
    const absolutePath = path.resolve(dir, entry);

    let mod: unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      mod = require(absolutePath);
    } catch (err) {
      console.warn(`[plugins] Failed to load plugin "${entry}": ${(err as Error).message}`);
      continue;
    }

    if (!isValidPlugin(mod)) {
      console.warn(`[plugins] Skipping "${entry}": must export { name: string, description: string, handler: function }`);
      continue;
    }

    registry.set(id, { id, name: mod.name, description: mod.description, handler: mod.handler });
  }

  console.log(`[plugins] Loaded ${registry.size} plugin(s) from ${dir}`);
}

export function listPlugins(): LoadedPlugin[] {
  return Array.from(registry.values());
}

export function getPlugin(id: string): LoadedPlugin | undefined {
  return registry.get(id);
}
