# Admin dashboard

Visual thesis: warm paper, charcoal navigation and one orange accent; a quiet operational page matching Story Circle.
Content plan: period/refresh controls, a compact totals strip, game popularity and the latest 100 activity records. No per-player detail pages.
Interaction thesis: fast range changes, local search/filter of the latest records, and a restrained loading transition with reduced-motion support.

`/admin` is restricted to registered accounts explicitly listed in `ADMIN_USERNAMES`. Production owner: `gaiyang`. The backend checks the current database account on every admin request; Guest accounts and client-supplied roles cannot grant access. Empty configuration denies everyone. Passwords are never changed by this feature.

The server records sign-in/account creation, connection changes, circle creation/join/leave, game starts/ends/pause/resume and failed socket commands or HTTP 5xx. It never stores request bodies, tokens, passwords, IP addresses, raw user agents, vote choices, horse picks or secret/custom words. Existing Android APKs get server-side activity logging without an update. Anonymous visitors who never set a name/sign in are not identified.

Events are batched every five seconds, bounded to 500 in memory, and logging failure does not block gameplay. The dashboard reports queued/dropped records. Retention is 30 days with an hourly 100,000-row cap in the existing PostgreSQL database. Displayed users are distinct authenticated account IDs, not verified people: one person's Guest accounts on different devices count separately. Historical events from before this deployment cannot be recovered.

Schema change: one additive `UsageEvent` table, no foreign keys to transient game records, so normal 24-hour guest/room cleanup does not erase retained operational history. No new paid service, dependency or emulator run is needed.
