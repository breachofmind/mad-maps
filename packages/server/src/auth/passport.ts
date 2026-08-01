import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { eq } from 'drizzle-orm';
import { db } from '../db/client';
import { users, type User } from '../db/schema';
import { env } from '../config/env';

passport.use(
  new GoogleStrategy(
    {
      clientID: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      callbackURL: env.GOOGLE_CALLBACK_URL,
    },
    async (_accessToken, _refreshToken, profile, done) => {
      try {
        const email = profile.emails?.[0]?.value ?? '';
        const avatarUrl = profile.photos?.[0]?.value ?? null;

        const [existing] = await db.select().from(users).where(eq(users.googleId, profile.id));

        if (existing) {
          const [updated] = await db
            .update(users)
            .set({ email, displayName: profile.displayName, avatarUrl, updatedAt: new Date() })
            .where(eq(users.id, existing.id))
            .returning();
          return done(null, updated);
        }

        const [created] = await db
          .insert(users)
          .values({ googleId: profile.id, email, displayName: profile.displayName, avatarUrl })
          .returning();
        return done(null, created);
      } catch (err) {
        return done(err as Error);
      }
    },
  ),
);

passport.serializeUser((user, done) => {
  done(null, (user as User).id);
});

passport.deserializeUser(async (id: string, done) => {
  try {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    done(null, user ?? false);
  } catch (err) {
    done(err as Error);
  }
});

export { passport };
