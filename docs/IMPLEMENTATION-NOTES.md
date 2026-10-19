# Production development — 16 October 2026

Visual thesis: a warm, tactile game night in charcoal, cream and tangerine, with generous Thai typography and a clear action on each screen.

Content plan: a full-bleed table photograph and unmistakable Story Circle wordmark; create/join actions; a concise preview of the three games; a mobile room and game workspace with durable results.

Interaction thesis: a short staggered entrance on the landing page, gentle photo depth on scroll, and responsive selection/result transitions. Respect reduced motion throughout.

Implementation: persisted, versioned room runtime; transactional commands; server deadlines; per-player snapshots; explicit host handoff; curated questions; unified game screens. Existing gameplay protocols are retired to avoid competing writers. Database changes are additive.

## Horse game restoration — 19 October 2026

Visual thesis: a cream race programme on the existing dark table, with eight illustrated horse identities carried through selection, race lanes and results.

Content plan: explicit top-three rule; three opinionated gurus; selectable profiles with actual abilities, form and named supporters; readable lanes; personal outcome and named drink/safe/missed groups; full finish order and guru reactions.

Interaction thesis: one-tap guru following, durable selected-horse feedback, and smooth movement in fixed race lanes, respecting reduced motion. Players have 45 seconds to read and pick; the host can start early once everyone chooses.

Gurus are generated locally once per round and persist across reconnects. They do not know the simulated result and incur no AI cost. Rankings 1–3 are safe; 4–8 drink once. Missing players receive no result. The server records explicit drink outcomes and counts them exactly once. No database migration or extra infrastructure is needed.
