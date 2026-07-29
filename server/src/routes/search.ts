import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../middleware/requireAuth';
import { searchPlaces } from '../services/googlePlaces.service';

export const searchRouter = Router();
searchRouter.use(requireAuth);

const querySchema = z.object({ q: z.string().trim().min(1).max(200) });

searchRouter.get('/', async (req, res) => {
  const parsed = querySchema.safeParse(req.query);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  try {
    const results = await searchPlaces(parsed.data.q);
    res.json(results);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('Places search failed:', err);
    res.status(502).json({ error: 'Search is temporarily unavailable' });
  }
});
