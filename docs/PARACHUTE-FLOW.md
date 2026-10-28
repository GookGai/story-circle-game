# Parachute game flow

Visual thesis: a shared sky scene with named avatars, opening parachutes and a visible landing zone, sized to the phone viewport.
Content plan: preparation/rules, live freefall and opened-player count, persistent personal action, landing sequence, named results and next-round readiness.
Interaction thesis: watch friends before choosing when to open; acknowledge server-accepted actions; keep watching after pressing; never jump straight from the last tap to a scoreboard.

New rounds prepare for 3 seconds, allow up to 12 seconds of decisions, then land for 3 seconds. If everyone opens early, input closes but the shared flight lasts at least 4.5 seconds before landing. The canonical phase remains INPUT until reveal, with persisted absolute `landingAt`/`revealAt` timestamps. Timers schedule the reveal, not an expired input deadline. Reconnect/restart reconstructs the same scene without scoring twice. Legacy rounds keep their old timing.

Existing scoring remains: the first opener misses the safe places, the next quota of players are safe, and the final safe place earns 2 stars. Missing input stays a skipped personal outcome. Early/late/stale commands are rejected. Public snapshots show who opened with timestamps rounded to 100ms in participant order; other players' exact action order/timestamps stay private until results. No fake crowd action or optimistic win is inserted.

Phones use safe areas and locked background scrolling. Openers slow down, unopened players keep falling, and everyone transitions to landing before results. Reduced motion retains the same state/timing without decorative cloud/plane motion. Existing leave/skip confirmations remain. No APK rebuild or additional service is needed.
