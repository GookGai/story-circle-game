# Personal forbidden words — 27 October 2026

Visual thesis: sealed personal word, visible friends' word slips, and one persistent personal action on the existing charcoal and cream table.

Content plan: ready lobby with categories and custom word bank; own hidden status and conversation prompt; named friend cards with Kill; explicit hit/penalty feedback, fresh-word action, and auditable captures; separate hunter and caught totals at the end.

Interaction thesis: confirm the exact person/word before Kill, refresh the board immediately from acknowledged server state, and visibly allow five seconds before each new assignment becomes catchable. Respect reduced motion. No microphone or external AI is used.

Rules: 2–10 players; one word by default, optional two-word mode. **Words rotate every 180 seconds per person**, as requested on 27 October, with a five-second grace period. A valid capture awards the hunter one point and records one caught/drink event for the target, regardless of how many words they hold. The target must request a fresh assignment after capture. Only the host can replace an active exposed word without penalty or void a capture; voiding returns the score and gives a fresh word if necessary. Targets may request review. Never charge a capture twice, and never accept a capture against an expired assignment version.

Word content and pool/history data that would disclose the viewer's current assignment are removed by server projection, including for the host. Custom categories support bulk lines and optional aliases separated by `|`. Changing enabled categories affects future assignments only. No currently assigned conflicting words, immediately previous personal words, or publicly captured words are reused. An exhausted pool leaves only the affected player waiting for words; the host may add a category or enable more words.

The mode is a standalone continuous session (10/15 minutes or until host ends it), not part of the short mixed playlist. It uses the existing persisted room JSON, transactions, host transfer and authenticated socket protocol. No schema migration or additional service is required. Global pause freezes remaining session/rotation/prompt time; personal rest freezes that person's rotation. Late players explicitly join, reconnects recover current assignments, and offline players cannot capture or be captured. All active commands are scoped to the session ID. Conversation prompts appear every 45 seconds and can be disabled in lobby settings.

Validation: 35 backend tests plus frontend lint/build; ten concurrent clients across all four games, including a real 180-second rotation after reconnect and pause, private projections, concurrent capture rejection, reset, void, custom bank and host transfer. Browser QA covers custom category creation, both player views, Kill, fresh words, score reversal and pause. Pause/resume/end controls for a live forbidden session tolerate timer-only revision changes while still requiring the correct host and session ID.

Rollback: finish active forbidden-word sessions before rolling back to a release that predates this mode; that release cannot render its continuous phase. Database fields are unchanged, but the new runtime game data requires a compatible app version.
