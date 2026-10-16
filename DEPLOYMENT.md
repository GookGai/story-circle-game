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
`cd /app/backend && npm run db:push`, healthcheck path `/health/ready`, one replica,
and restart-on-failure with five retries in Railway Settings. New services cannot
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
