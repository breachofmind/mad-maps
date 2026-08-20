import { Router } from 'express';
import type { PluginSummaryDTO } from '@mad-maps/shared';
import { requireAuth } from '../middleware/requireAuth';
import { listPlugins } from '../plugins/pluginRegistry';

export const pluginsRouter = Router();
pluginsRouter.use(requireAuth);

// The plugin registry is server-wide (loaded once from PLUGINS_DIR at
// startup, same for every user), so this list is not scoped by ownership.
pluginsRouter.get('/', (_req, res) => {
  const summaries: PluginSummaryDTO[] = listPlugins().map(({ id, name, description }) => ({ id, name, description }));
  res.json(summaries);
});
