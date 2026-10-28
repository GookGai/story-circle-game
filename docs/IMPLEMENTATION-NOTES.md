# Production development — 16 October 2026

Visual thesis: a warm, tactile game night in charcoal, cream and tangerine, with generous Thai typography and a clear action on each screen.

Content plan: a full-bleed table photograph and unmistakable Story Circle wordmark; create/join actions; a concise preview of the three games; a mobile room and game workspace with durable results.

Interaction thesis: a short staggered entrance on the landing page, gentle photo depth on scroll, and responsive selection/result transitions. Respect reduced motion throughout.

Implementation: persisted, versioned room runtime; transactional commands; server deadlines; per-player snapshots; explicit host handoff; curated questions; unified game screens. Existing gameplay protocols are retired to avoid competing writers. Database changes are additive.

## Horse game restoration — 19 October 2026

### Mobile live race — 28 October 2026

Visual thesis: one cream racecourse fills the available phone screen, with eight stable colored lanes and a strong marker for the viewer's horse.
Content plan: compact race controls/countdown, current leaders, all eight lanes, personal live rank and an optional named-picks sheet. Selection profiles, gurus and detailed results stay outside the live race.
Interaction thesis: enter the full-screen layout automatically during RACING, move every horse on the same course without scrolling, and return to the normal result screen when the server finishes. Preserve exit/host skip confirmations and reduced motion; freeze background scrolling while the mobile race is mounted. The picks sheet can scroll independently without making the course taller.

Visual thesis: a cream race programme on the existing dark table, with eight illustrated horse identities carried through selection, race lanes and results.

Content plan: explicit top-three rule; three opinionated gurus; selectable profiles with actual abilities, form and named supporters; readable lanes; personal outcome and named penalty/safe/missed groups; full finish order and guru reactions.

Interaction thesis: one-tap guru following, durable selected-horse feedback, and smooth movement in fixed race lanes, respecting reduced motion. Players have 45 seconds to read and pick; the host can start early once everyone chooses.

Gurus are generated locally once per round and persist across reconnects. They do not know the simulated result and incur no AI cost. Rankings 1–3 are safe; 4–8 receive a penalty marker. Missing players receive no result. The server records explicit penalty outcomes and counts them exactly once. No database migration or extra infrastructure is needed.

## Ready flow clarity — 19 October 2026

Visual thesis: one unmistakable action at the bottom of the screen, with a calm named readiness roll call above the workspace.

Content plan: next-round context, named ready/waiting/sitting-out/offline players, persistent personal or host action, then secondary room controls. The host's automatic readiness must match the server, and blocked starts must explain why.

Interaction thesis: immediate pending/confirmed feedback without optimistic success, a fixed action dock that reserves its own space, and explicit confirmation for skipping or ending a session. Preserve readable results and respect reduced motion.

The roster excludes offline and resting members from the start count, and distinguishes active participants from late observers. Start/NEXT/close-input intents rejected only for a stale revision may sync and retry once with the same command ID, provided the host, phase, round and settings are unchanged. Destructive commands never auto-retry. Tests check UI/server readiness agreement for 1,536 seating/game combinations, plus final-summary, presence and retry boundaries.
