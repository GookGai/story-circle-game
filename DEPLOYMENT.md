# Story Circle on Railway

Deploy the repository root using `Dockerfile`. One Node service serves the Vite
build, REST API, and Socket.IO. Keep **one replica**: game/socket state and AI
budgets are process-local. PostgreSQL is the second service. Do not use a Vite
development server in production.

Required app variables:

- `DATABASE_URL=${{Postgres.DATABASE_URL}}` (Railway private network reference)
- `JWT_SECRET`: generate a cryptographically random secret; never commit it
- `NODE_ENV=production`
- `AI_DAILY_REQUEST_LIMIT=0` initially; offline questions work without a key
- Optional `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`
- Optional `FRONTEND_URL` for additional browser origins, comma separated

No `VITE_API_URL` is needed for the combined service. For separate hosting it is
a build-time variable. Local Vite development proxies API and socket requests.

For a new Railway service configure the Dockerfile builder, pre-deploy command
`npm run db:push` (the image working directory is `/app/backend`), healthcheck path `/health/ready`, one replica,
and restart-on-failure in Railway Settings. New services cannot
use the deprecated `railway.json` format. This repository has no migration baseline.
`db push` does not accept data loss automatically. Introduce reviewed migrations
before making destructive schema changes to a populated database.

Cost controls:

- One app process and one private database; no Redis or extra frontend service.
- Hashed assets cache for one year; game pages load only when needed.
- Global stats use two queries rather than one per player.
- AI has a daily request allowance, 15-second per-user cooldown, two concurrent
  requests, a 250-token output limit, and a 10-second timeout. Denied/failed calls
  use local questions. Attempts count even on provider failure. Daily counters
  reset at UTC midnight and process restart; set a provider key credit limit for
  a durable spending ceiling. Request caps are not currency budgets.
- Measure Railway CPU, RAM, database storage, and egress after real game sessions
  before estimating monthly savings. Persistent sockets keep the app active.

Checks: `npm ci --prefix frontend`, `npm ci --prefix backend`,
`npm run build --prefix frontend`, `npm test --prefix backend`, and
`backend/node_modules/.bin/prisma validate --schema backend/prisma/schema.prisma`.

Before calling a deployment verified, exercise registration, guest joining,
all three games with multiple clients, reconnect, and room cleanup against the
deployed database. A successful build alone does not verify multiplayer behavior.

## Verified deployment (2026-10-16)

This section records the original v1 deployment. See [PRODUCTION-V2.md](docs/PRODUCTION-V2.md) for the current v2 runtime, additive schema rollout, backup and verification. The previously listed three backend audit findings are resolved in v2 with a tested deepmerge-ts 8.0.0 override.

- Project: `story circle` (`df48eb41-8348-416b-827d-c61b55974071`)
- App service: `striking-sparkle`; PostgreSQL service: `Postgres`
- Source branch: `codex/optimize-railway`
- URL: https://striking-sparkle-production-adf7.up.railway.app
- Public domain target port: `8080` (Railway's injected `PORT`)
- Three-client checks passed for horse race, minority vote, offline questions,
  Panic Jump public user fields, and reconnect. QA guests leave the room afterward.
- Frontend audit: zero findings. Backend retains three high-severity findings
  in the Prisma CLI / `@prisma/config` / `deepmerge-ts` dependency chain; upgrading
  across Prisma major versions requires separate compatibility validation.
- Actual monthly cost and behavior under sustained load have not been measured.
