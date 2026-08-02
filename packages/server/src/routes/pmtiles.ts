import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { PmtilesInspectError, inspectPmtiles } from '../services/pmtilesInspect.service';

const inspectSchema = z.object({
  url: z.string().trim().url().max(2000),
});

export const pmtilesRouter = Router();
pmtilesRouter.use(requireAuth);

pmtilesRouter.post('/inspect', async (req, res) => {
  const parsed = inspectSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const metadata = await inspectPmtiles(parsed.data.url);
    res.json(metadata);
  } catch (err) {
    if (err instanceof PmtilesInspectError) {
      return res.status(err.statusCode).json({ error: err.message });
    }
    throw err;
  }
});
