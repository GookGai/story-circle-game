# Social party-game theme

Visual thesis: a welcoming cartoon circle of friends, ink navy, cream, sky blue and apricot; a casual game anywhere rather than a nightlife venue.
Content plan: invite friends, choose a game, see named outcomes and a simple “รับบทลงโทษ” marker. No generated challenges or additional punishment workflow, as requested.
Interaction thesis: retain clear ready controls, expressive horses and private-word interactions; use a light illustration entrance and existing selection feedback with reduced-motion support.

The current product has no alcohol instruction, drinking mode, beverage-volume counter or drinking leaderboard. Penalties mean failed-round/capture outcomes, not a prescribed real-world action. Groups can pause, skip or stop. Safe game scores and rankings are unchanged.

Runtime counts use `penalties`, `hasPenalty` and `penaltyIds`. A narrow compatibility upgrade converts persisted prior outcome records without touching choices, user-created words, private assignments or scores. Prisma `PenaltyStat` maps the existing physical table with `@@map` to avoid a destructive data rename. API statistics use `penaltyCount` and `totalPenalties`.

The new illustration replaces the old venue photo in the public asset directory and in bundled Android assets. Android 1.1.0 uses the same application ID and signing key, so installing the update preserves app data. Old APKs contain their old UI/assets and must be updated. These changes alone do not establish Play Store policy approval; privacy/account deletion and store preparation are separate work.

## Illustration asset

Mode: built-in `image_gen`, new image. Final asset: `frontend/public/images/game-circle.webp` (166 KB, WebP encoding of the generated image).

Final prompt: A polished 2D cartoon editorial illustration for a social party-game app called Story Circle. Landscape 16:9 full-bleed website hero artwork, not a UI mockup. Five expressive young adult Thai/Asian friends, men and women, laughing and playing a fun guessing game around a low rounded coffee table in a cozy modern living room. One friend holds a small blank card to their forehead, others point playfully, a couple of smartphones and a few simple blank game cards on the table. Contemporary rounded character design, confident clean linework, matte flat colors with gentle textured shading, charming stylized faces and natural readable gestures, premium mobile-game illustration, warm and welcoming rather than childish. Composition: group and table occupy the right 60 percent; the left 40 percent is quiet deep ink navy wall/curtain with subtle architectural detail and enough plain negative space for large white Thai headline overlay. Palette ink navy, cream, soft sky blue, sage and apricot orange, daylight and a few warm decorative accents. No typography, letters, brand names, logos, UI frames, borders or watermark. Absolutely no alcohol, bottles, drinking glasses, beverage cups, smoking, money, gambling chips, bar/pub/nightclub setting. Make the friends and the friendly game the visual focus.
