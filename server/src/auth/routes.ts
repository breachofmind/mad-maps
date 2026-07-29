import { Router } from 'express';
import { passport } from './passport';
import type { User } from '../db/schema';
import type { UserDTO } from '@mapinski/shared';
import { env } from '../config/env';

export const authRouter = Router();

authRouter.get('/google', passport.authenticate('google', { scope: ['profile', 'email'] }));

authRouter.get(
  '/google/callback',
  passport.authenticate('google', { failureRedirect: `${env.CLIENT_ORIGIN}/login?error=1` }),
  (_req, res) => {
    res.redirect(env.CLIENT_ORIGIN);
  },
);

authRouter.post('/logout', (req, res, next) => {
  req.logout((err) => {
    if (err) return next(err);
    req.session.destroy(() => {
      res.status(204).end();
    });
  });
});

authRouter.get('/me', (req, res) => {
  if (!req.isAuthenticated() || !req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  const user = req.user as User;
  const dto: UserDTO = {
    id: user.id,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    createdAt: user.createdAt.toISOString(),
  };
  res.json(dto);
});
