import express from 'express';
import helmet from 'helmet';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import session from 'express-session';
import connectPgSimple from 'connect-pg-simple';
import { eq } from 'drizzle-orm';
import { env } from './config/env';
import { db, pool } from './db/client';
import { users } from './db/schema';
import { passport } from './auth/passport';
import { authRouter } from './auth/routes';
import { mapsRouter } from './routes/maps';
import { layersRouter, mapLayersRouter } from './routes/layers';
import { layerMapFeaturesRouter, mapFeaturesRouter } from './routes/mapFeatures';
import { searchRouter } from './routes/search';
import { mapExportRouter } from './routes/export';
import { mapImportRouter, newMapImportRouter } from './routes/import';
import { pmtilesRouter } from './routes/pmtiles';

const PgSession = connectPgSimple(session);

export function createApp() {
  const app = express();

  app.use(helmet());
  // exposedHeaders is needed so client-side JS can read Content-Disposition
  // cross-origin (client/server run on different ports) — without it the
  // browser hides that header even though the response includes it, and
  // file downloads (map export) silently fall back to a generic filename.
  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true, exposedHeaders: ['Content-Disposition'] }));
  app.use(express.json({ limit: '10mb' }));
  app.use(cookieParser());

  app.use(
    session({
      store: new PgSession({ pool, tableName: 'session', createTableIfMissing: true }),
      secret: env.SESSION_SECRET,
      resave: false,
      saveUninitialized: false,
      cookie: {
        httpOnly: true,
        secure: env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 1000 * 60 * 60 * 24 * 7,
      },
    }),
  );

  app.use(passport.initialize());
  app.use(passport.session());

  app.get('/api/health', (_req, res) => res.json({ ok: true }));
  app.use('/api/auth', authRouter);
  app.use('/api/maps', mapsRouter);
  app.use('/api/maps/:mapId/layers', mapLayersRouter);
  app.use('/api/layers', layersRouter);
  app.use('/api/layers/:layerId/mapFeatures', layerMapFeaturesRouter);
  app.use('/api/mapFeatures', mapFeaturesRouter);
  app.use('/api/search', searchRouter);
  app.use('/api/pmtiles', pmtilesRouter);
  app.use('/api/maps/:mapId/export', mapExportRouter);
  app.use('/api/maps/import', newMapImportRouter);
  app.use('/api/maps/:mapId/import', mapImportRouter);

  // Test-only: establishes a real Passport session for a given user id, so
  // route tests can authenticate without driving a real Google OAuth flow.
  // Keyed off JEST_WORKER_ID (always set under Jest) rather than NODE_ENV,
  // since NODE_ENV may already be set to something else in the shell.
  if (process.env.JEST_WORKER_ID !== undefined) {
    app.post('/api/test/login', async (req, res) => {
      const { userId } = req.body as { userId?: string };
      if (!userId) return res.status(400).json({ error: 'userId is required' });
      const [user] = await db.select().from(users).where(eq(users.id, userId));
      if (!user) return res.status(404).json({ error: 'test user not found' });
      req.login(user, (err) => {
        if (err) return res.status(500).json({ error: 'login failed' });
        res.status(204).end();
      });
    });
  }

  return app;
}
