# Story Circle 2.0 — production release notes

16 October 2026 · Target: friends in one group, 2–10 people, one phone each.

## Delivered

- New charcoal/cream/tangerine UI, photographic landing, responsive room and games.
- Guest create/join without registration, public room preview, local QR, copy invite.
- Three games and a mixed playlist of 3/6/9 rounds. Two-player voting becomes Mind Match.
- 120 editorial Thai questions, per-circle deduplication, custom host questions.
- Explicit ready/sit-out, late-join spectator, pause/skip/end, durable results and shareable text summary.
- Horse input 18 seconds, synchronized 12-second race, top-three rule and rank points.
- Jump 3-second preparation + 8-second input, visible fixed quota, survival stars and final-slot bonus.
- PostgreSQL-backed room runtime, revision guard, per-room command queue and serializable transactions.
- One result per round, server deadlines, reconnect snapshots, process-restart recovery.
- Server checks room membership, phase, round identity and host controls. Old socket handlers are retired.
- Host transfer after 30 seconds offline, immediate transfer on leave. Absent seats released after 5 minutes.
- Game scores are separate. Completed v2 room summaries and orphaned v2 guests expire after 24 hours; historical v1 data is retained.
- Request limits, safer guest identity, auth session preserved on transient network errors, zoom and reduced motion.
- deepmerge-ts pinned to patched 8.0.0 through an npm override, with Prisma 6 retained. Both dependency audits currently report zero findings.
- CI builds, lints, runs unit tests and exercises ten clients against PostgreSQL 18.

## Schema and rollback

The reviewed schema diff only adds `User.isGuest BOOLEAN DEFAULT false`, `Room.revision INTEGER DEFAULT 0`, and nullable `Room.runtime JSONB`. No table, row or old column is removed by deployment.

The existing Railway pre-deploy command remains `npm run db:push`. Never add `--accept-data-loss`. Future destructive changes need a migration baseline and a separate reviewed rollout.

Before release, a custom-format `pg_dump` was created through the existing authenticated Railway Console at:

`/var/lib/postgresql/data/story-circle-backups/before-v2-20261016.dump`

`pg_restore --list` read the archive successfully. This verifies archive readability, not a full restoration drill. A preflight room-count query returned no rooms, so no live game was interrupted at that check.

The archive remains in the Railway volume. Native scheduled backups/PITR require a higher Railway plan in the current workspace. No SSH key was registered and the production database was not downloaded to the workstation. A volume-local archive does not protect against loss of that entire volume.

Application rollback: redeploy the previous successful Railway image. The additive columns can remain. V2 rounds need the v2 application to continue; do not promise a v1 image can resume the new protocol. Restore a database archive only into a separately verified target; never restore over production as an automatic rollback step.

## Verification evidence

- Frontend lint: no errors or warnings; Vite production build passes.
- Backend: 17 unit/invariant tests pass; Prisma validation passes.
- Local PostgreSQL 18, UTF-8: ten simultaneous clients exercise room capacity, stranger rejection, hidden votes, race timelines, concurrent jumps, scores, stale-round commands, cancelled timers and host handoff.
- Two-client Mind Match tested through real browser pages; same answer produces matching results. Mobile viewport checked at 390×844 without horizontal overflow.
- Actual local server process stopped during a persisted race; restarted process recovered the same round, finalized it, and counted scores once.
- Limited post-deployment smoke command: `node backend/scripts/smoke-party.mjs --production --url=https://striking-sparkle-production-adf7.up.railway.app`.
- Build output: initial JS about302 kB /95.7 kB gzip, lazy game bundle about55.7 kB /18.9 kB gzip, CSS about41.2 kB /9.3 kB gzip; photographic WebP about211 kB. Gzip figures are build estimates, not measured network transfer.

This is technical QA with simulated clients and desktop-browser mobile emulation. It is not a ten-person bar playtest, iOS backgrounding certification, a monthly bill measurement or a sustained-capacity guarantee. Follow the real-group playtest in GAME-EXPERIENCE-PLAN.md next.

## Cost and operations

One Node app replica and one private PostgreSQL service. No added cloud services, Redis or paid AI calls. The curated deck is entirely local to the application. Keep one replica until socket fanout and host presence are backed by a shared adapter.

Runtime stores bounded command history, round history and scores. It discards horse animation frames after results to reduce repeated snapshot/storage costs. Finished room retention runs hourly, so deletion can occur up to about an hour after the24-hour cutoff.

## Visual asset provenance

Final asset: `frontend/public/images/table-night.webp` (compressed from the generated PNG).

Generated with the built-in imagegen tool. Final prompt:

> Use case: photorealistic-natural. Asset type: wide background photograph for Story Circle, a Thai mobile party game for 2–10 adult friends at a neighborhood bar. Primary request: candid overhead editorial photograph of a cozy circular dark wooden table during a friendly game night, a few adult hands at the outer edge, dice, colorful simple playing pieces, coasters, snacks and a few amber drinks with condensation; no visible faces. Composition: cinematic landscape 3:2, objects arranged around the outer rim, central and left areas dark and calm enough for cream typography placed later by code. Warm tungsten highlights, deep charcoal shadows, subtle film grain, honest tactile materials, premium lifestyle photography. No text, no lettering, no logos, no UI, no collages, no fake interface screens.
