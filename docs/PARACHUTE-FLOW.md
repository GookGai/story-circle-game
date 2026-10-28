# Parachute timing game

Visual thesis: a shared cartoon sky with a dominant countdown and warm target ring, named parachutes and a clear landing zone, sized to the phone viewport.
Content plan: random target/penalty count, preparation, seven-second countdown, one persistent action, shared landing, accuracy results and next-round readiness.
Interaction thesis: a ring meets its target at the shared-clock instant; accepted parachutes unfold while the flight continues; result rows reveal from closest to furthest without live rankings.

New rounds (jumpFlow 3) support 2–10 people. The server persists a random integer target 2–5 and a penalty count from 1 to floor(players/2), then prepares for three seconds. The countdown always runs from 7 to 0 at one second per unit; targetAt is the instant it reaches the selected target. Early completion never moves the target, deadline, or three-second landing. No speed variation or fake countdown is used.

The first JUMP per participant wins, scored by absolute distance from targetAt (early and late are symmetric). Finger-contact timestamps use the shared display clock, accepted only within 350ms before server receipt and after the start; invalid/future/old timestamps fall back to server receipt. This bounds network adjustment; it does not claim identical accuracy on every network. Public live openers are rounded down to 500ms, with no exact timestamp, error, rank, or score. Private scoring records remain server-only until results.

Errors are grouped in 100ms bands. The furthest penaltyCount places receive a penalty, with boundary ties all safe (so fewer penalties are possible). A missing press always counts as a miss/penalty, consumes a penalty place, and can exceed the announced count when too many people do not press. The UI states this separately. Safe players earn 1 star and the closest accuracy band earns 2; penalized players earn 0. No mid-round score is awarded. Restart/reconnect uses the persisted target/deadline and cannot double-score.

The following describes legacy jumpFlow 2 only; older rounds without jumpFlow retain their original deadline.

New rounds prepare for 3 seconds, allow up to 12 seconds of decisions, then land for 3 seconds. If everyone opens early, input closes but the shared flight lasts at least 4.5 seconds before landing. The canonical phase remains INPUT until reveal, with persisted absolute `landingAt`/`revealAt` timestamps. Timers schedule the reveal, not an expired input deadline. Reconnect/restart reconstructs the same scene without scoring twice. Legacy rounds keep their old timing.

Existing scoring remains: the first opener misses the safe places, the next quota of players are safe, and the final safe place earns 2 stars. Missing input stays a skipped personal outcome. Early/late/stale commands are rejected. Public snapshots show who opened with timestamps rounded to 100ms in participant order; other players' exact action order/timestamps stay private until results. No fake crowd action or optimistic win is inserted.

Phones use safe areas and locked background scrolling. Openers slow down, unopened players keep falling, and everyone transitions to landing before results. Reduced motion retains the same state/timing without decorative cloud/plane motion. Existing leave/skip confirmations remain. No APK rebuild or additional service is needed.
