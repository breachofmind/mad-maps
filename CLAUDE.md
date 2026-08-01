# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Mapinski is a web app for creating and viewing custom maps on Mapbox — a more flexible alternative to
Google's "My Maps" that can export to KML/GeoJSON. Full feature spec in `docs/SDD.md`.

## Stack & Monorepo layout

npm workspaces, three packages:

- `packages/shared` (`@mapinski/shared`, ESM) — types + Zod GeoJSON schemas shared by client and server.
- `packages/server` (`@mapinski/server`, CommonJS) — Express + TypeScript + Drizzle ORM + PostGIS.
- `packages/client` (`@mapinski/client`, ESM) — Vite + React + TypeScript + MUI + Mapbox GL JS + Zustand + TanStack Query.

## Commands

```bash
npm install
docker compose up -d          # local PostGIS (port 5433)
npm run db:migrate            # apply Drizzle migrations
npm run dev                   # runs client + server together
npm run dev:server            # server only (tsx watch, port 4000)
npm run dev:client            # client only (vite, port 5173)
npm run build                 # builds shared -> server -> client, in that order
npm test                      # jest across all three workspaces
npm run db:generate           # generate a new Drizzle migration from schema.ts changes
```

Env setup: `cp .env.example .env` (server) and `cp .env.example packages/client/.env.local` (client —
Vite only reads `VITE_`-prefixed vars from `.env.local`).

### Running a single test

Each workspace has its own Jest config; run from inside the package directory:

```bash
cd packages/server && npx jest src/routes/layers.test.ts
cd packages/client && npx jest src/lib/map/__tests__/geometryAnchor.test.ts
```

- Server tests: `testEnvironment: 'node'`.
- Client tests: `testEnvironment: 'jsdom'`, setup file `src/setupTests.ts`.
- Server route tests authenticate via `POST /api/test/login` (only registered when `JEST_WORKER_ID` is
  set — see `app.ts`), which drives a real Passport session without a Google OAuth round trip.

### Type checking

Each workspace exposes `npm run typecheck --workspace=@mapinski/<pkg>` (`tsc --noEmit`). The client's
`build` script also runs a full typecheck before `vite build`.

## Architecture

### Data model (`packages/server/src/db/schema.ts`)

`users` → `maps` → `layers` → `map_features`, cascading on delete. A map has a base Mapbox style,
default center/zoom. A layer has an `orderIndex`, visibility, color, and either `sourceType: 'local'`
(features live in `map_features`) or an external source (`sourceUrl`, e.g. `geojson-url`) rendered via
`RemoteLayer`. `layers.styleConfig` holds data-driven styling rules (label/color/icon by feature
property) applied to both local and remote layers.

`map_features.geometry` is a PostGIS `geometry(Geometry, 4326)` column storing mixed Point/LineString/
Polygon. Drizzle's built-in `geometry()` type only supports Point, so this uses a `customType` storing
raw EWKB text — always read/write it through explicit `ST_GeomFromGeoJSON`/`ST_AsGeoJSON` SQL in
`features.service.ts`, never rely on Drizzle's value mapping for this column.

### Server request flow

`routes/*.ts` (Zod validation of request bodies, auth via `requireAuth` middleware, ownership checks)
call into `services/*.ts` (Drizzle queries, business logic, DTO mapping) which is the only layer that
touches the DB directly. Every route/service pair has a co-located `.test.ts`. Routes are scoped both
flat (`/api/layers/:layerId`) and nested under their parent (`/api/maps/:mapId/layers`) — see how
`app.ts` mounts `layersRouter` and `mapLayersRouter` from the same `routes/layers.ts` module.

Auth is Google OAuth via Passport (`auth/passport.ts`, `auth/routes.ts`) with server-side sessions
stored in Postgres (`connect-pg-simple`), not JWTs. `requireAuth` just checks `req.isAuthenticated()`;
ownership (does this map/layer/feature belong to `req.user`) is enforced inside each service function,
not the middleware.

### Client structure

- `components/` — UI, organized by feature area (`map/`, `layers/`, `mapFeatures/`, `draw/`, `auth/`,
  `search/`, `import/`). `lib/` mirrors the same feature folders for business logic: `lib/<feature>/api.ts`
  wraps `apiClient` (axios) calls, and TanStack Query is used for server-state caching/invalidation
  (query keys like `layersQueryKey`, `featuresQueryKey` exported alongside each `api.ts`).
- `lib/state/editorStore.ts` — Zustand store for map-editor-local UI state that doesn't belong in the
  URL or server (active/hovered/selected layer & feature, draw mode, panel open state). Comments in
  that file explain several non-obvious state relationships (e.g. `selectedLayerId` vs `activeLayerId`,
  why `failedIconUrls` lives here instead of as component-local state) — read them before changing it.
- `components/map/MapEditorPage.tsx` is the hub: owns the Mapbox instance, wires together drawing
  (`useMapboxDraw`, `useMapboxRoute`), local features (`FeatureLayer`), external data (`RemoteLayer`),
  selection (`useSelectedFeature`), and persistence (debounced viewport/style patches via
  `useDebouncedCallback`).
- `FeatureLayer` (local `map_features` rows) and `RemoteLayer` (external `geojson-url` layers) are
  separate Mapbox layer sets but share hit-testing conventions defined in `lib/map/featureLayerIds.ts`
  — that module is dependency-free on purpose (no `import.meta.env`) so it can be imported by code that
  must stay Jest-CJS-transformable.
- Routing (`lib/router.tsx`) is just two real pages: `/` (`MapsListPage`, behind `ProtectedRoute`) and
  `/maps/:mapId` (`MapEditorPage`). Auth gating happens in `ProtectedRoute`, not per-page.

### Shared package

`packages/shared/src/geojson.ts` defines Zod schemas for GeoJSON used by both the server (validating
import/export payloads) and client (typing feature geometry). Change schemas here first when the
feature/geometry data shape changes, then propagate to `db/schema.ts` and the client types.

## Notes

- Do not hand-edit files under `packages/server/src/db/migrations/` — they're generated by
  `npm run db:generate` from `db/schema.ts`.
- `data/` at the repo root is git-ignored local/scratch data, not part of the app.
