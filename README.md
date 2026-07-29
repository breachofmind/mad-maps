# Mapinski

A web app for creating and viewing custom maps on Mapbox — a more flexible, modern alternative to Google's "My Maps" that can export to KML. See `SDD.md` for the full spec.

## Stack

Monorepo (npm workspaces): `shared` (types + GeoJSON zod schemas), `server` (Express + TypeScript + Drizzle/PostGIS API), `client` (Vite + React + TypeScript + MUI + Mapbox GL JS).

## Prerequisites

- Node.js 20+ and npm 10+
- Docker (for local PostGIS via `docker-compose.yml`)
- A [Mapbox](https://account.mapbox.com/) access token
- A Google Cloud project with:
  - An OAuth 2.0 Client ID (Web application) for sign-in
  - A Maps Platform API key (Places/Geocoding), used from Phase 6 onward

## Setup

```bash
cp .env.example .env
cp .env.example client/.env.local   # Vite only reads VITE_-prefixed vars from client/.env.local
npm install
docker compose up -d
npm run db:migrate
npm run dev
```

Fill in `.env` (server) and `client/.env.local` (client) with real credentials before starting — see `.env.example` for the full list of required variables.

- Client: http://localhost:5173
- Server: http://localhost:4000

## Testing

```bash
npm test
```

Runs the Jest suite across all three workspaces (`shared`, `server`, `client`).
