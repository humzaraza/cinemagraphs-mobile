# Cinemagraphs Mobile Redesign — Master Spec

**Last updated:** May 3, 2026
**Status:** All screens specced. Typography shipped (PR #8). Implementation pending across 7 planned PRs.
**Repo:** `~/Code/cinemagraphs-mobile`

---

## Table of contents

1. [Core product principles](#core-product-principles)
2. [PR sequence](#pr-sequence)
3. [Profile screen](#profile-screen)
4. [Header picker screen](#header-picker-screen)
5. [Onboarding flow](#onboarding-flow)
6. [Lists — standalone screen](#lists--standalone-screen)
7. [List detail page](#list-detail-page)
8. [Film detail page](#film-detail-page)
9. [Search tab](#search-tab)
10. [Explore tab](#explore-tab)
11. [Stats screen](#stats-screen)
12. [Watchlist](#watchlist)
13. [Settings screen](#settings-screen)
14. [Cross-cutting features and gestures](#cross-cutting-features-and-gestures)
15. [Permanent product decisions](#permanent-product-decisions)
16. [Parked followups](#parked-followups)

---

## Core product principles

These guide every individual decision. When in doubt, refer back here.

- **Shape over aggregate.** The differentiator is arc shape, not score. Features that pull users back into aggregate-score thinking are anti-brand. The "Avg Arc" stat was killed for this reason.
- **Sparklines belong on detail pages, NOT list views.** Tested on device May 2 2026: under-poster sparklines on home carousels and full-row sparklines in search results both removed. Most films are visually flat in sparkline form; many small sparklines stacked dilute the differentiator. Exceptions exist (4 favorites with personal arcs, list detail rows when user opts into list view via toggle) but the default is no sparklines on list views.
- **Cinemagraphs-pure film detail page.** No external scores ever (IMDb, RT, Metacritic). Permanent product decision. Page stays Cinemagraphs-only forever.
- **Recommendations: content-based primary, arc-shape secondary.** Genre/theme/director/era is the primary recommendation axis. Arc-shape similarity is a secondary lens (sort/filter), not the primary. Users discover by topic, not by emotional structure.
- **Blind mode is a hidden superpower.** Letterboxd users complain that ratings prime experience. Cinemagraphs can show arc shape without revealing the score. This is product-defining.
- **Free shape-native stats.** Letterboxd paywalls stats. Cinemagraphs unpaywalls them — and adds shape-native stats Letterboxd cannot have.
- **Mobile-first design language.** No em dashes anywhere in code, comments, JSX, or commit messages. Direct, clean copy.
- **Visual mockup before implementation.** Hard requirement for any UI work. Approved mockup must exist before writing the CC prompt. Skipping this step makes CC guess wrong.
- **Every CC session starts with a STOP-and-report inventory step before changes are made.** Pattern proven on PR #7 and PR #8.

---

## PR sequence

Each PR is roughly 1-3 days of CC work. Sequenced by dependency.

### PR 1 — Profile redesign + Header picker
- Gradient banner system (8 presets)
- New profile header (banner, avatar, bio, 3-stat row)
- 4 favorites strip with personal arc sparklines (review-gated)
- Recent Reviews horizontal cards (5 cards, "All →" link)
- Lists section preview (3 lists, mosaic covers)
- Stats teaser (placeholder card if data not ready, average arc + distribution when data exists)
- Header picker screen with 8 gradients, photo upload, film backdrop option

The biggest visible change. Sets the design language for everything downstream.

### PR 2 — Onboarding flow
- 3-screen taste-gathering (decade / genre / film grid)
- Posters accumulate visually across screens
- Final assembly: posters dissolve into gradient that becomes user's header
- Skip option → random gradient
- Reset taste in Settings re-runs flow
- **Depends on:** gradient system from PR 1
- **Depends on:** `react-native-image-colors` re-enabled (currently hash fallback for Expo Go per memory #10)

### PR 3 — Lists redesign
- Standalone Lists screen (filter pills, 2×2 mosaic cards)
- List detail page (backdrop hero, averaged sparkline, view toggle)
- Watchlist as fixed pinned list

### PR 4 — Film detail redesign
- Includes the broken similar films algorithm fix
- Blind mode toggle (per-film top-right + Settings global default)
- Similar films section rebuilt with content-based primary + arc-shape secondary
- "Write review" CTA repositioned (smaller, between Summary and User Reviews)
- Section order finalized

### PR 5 — Explore tab redesign
- 13 sections (mix of ArcCards and poster cards)
- Today's Peak hero
- Shape-native sections (Slow burns, Steady greats, etc.)
- Algorithms for each section

### PR 6 — Stats screen
- New dedicated screen
- Lead with Cinemagraphs-only shape stats
- Letterboxd-parity numbers below

### PR 7 — Settings cleanup + global gestures
- Settings restructured (grouped, search bar)
- Blind mode global default toggle
- Global long-press to add to Watchlist (gesture on any film card across the app)

### Out of scope for this redesign series

- **Web typography swap** (Playfair → DM Sans on web). Mobile shipped May 3 2026 as PR #8. Web parked.
- **Server-side search refactor** (memory #23). Multi-PR multi-day; schedule as separate focused work.
- **TV tracking.** Permanently out of scope. Cinemagraphs is films-only.
- **Server-side video renderer.** Abandoned April 28 2026 (memory #19). Manual CapCut workflow remains.
- **Most divisive films / Critics-loved-audiences-didn't sections.** Defer until audience-side data exists at scale. Currently most films say "no audience data yet."

---

## Profile screen

Single scrolling page (NOT tabbed). Mostly preserves current architecture, with new visual treatment.

### Structure (top to bottom)

1. **Gradient banner header** with picker affordance
2. **Avatar** overlapping banner, left-aligned
3. **Display name + handle + bio**
4. **3-stat row:** Films / Following / Followers
5. **4 favorite films** strip (review-gated, personal arc sparklines underneath)
6. **Stats teaser** card (between favorites and Recent Reviews)
7. **Recent Reviews** horizontal scroll (5 cards, "All →" top-right)
8. **Lists section** preview (3 most recent lists, mosaic covers, "All →" top-right)

### Locked decisions

- **Avg Arc stat removed.** Three stats only: Films, Following, Followers. Reason: contradicts shape-over-aggregate thesis.
- **4 favorites are review-gated.** User must have reviewed a film with sliders before they can set it as a favorite. Forces engagement with core feature at the moment of declaring a favorite. Adds friction but is on-brand.
- **Personal arc sparklines under each favorite poster.** No axes, no labels. Spotify waveform / Apple Stocks app pattern. Section header does the work; sparkline is signature, not chart.
- **Recent Reviews are horizontal, 1.5 cards visible** (1 full + edge of next peeking). Cards: ~75% screen width, poster as background, score badge top-right, sparkline mid-card, "Title · Year · dir. Director" at bottom. "Peak X.X" metadata removed.
- **Recent Reviews "All →" goes to existing My Films Reviewed arc card view** (per memory #8). Not a new screen.
- **Lists section shows 3 most recent of YOUR OWN lists.** "All →" opens dedicated Lists screen with filter pills.
- **Stats teaser is the combined version:** average arc sparkline + 3-bar distribution preview + "View all stats →" link. NOT just a single stat.
- **Recently Viewed is NOT on profile.** Lives at top of Search tab below the search bar.

### Rationale notes

- Shape-native content lives in two places: 4 favorites strip (signature) and Stats teaser (taste data). Together they make the profile feel Cinemagraphs-native instead of generic-Letterboxd.
- The decision to NOT make Profile tabbed (Films / Reviews / Lists / Stats) was about complexity. Single-page profile + dedicated Stats screen via "View all →" is simpler navigation on a phone.

---

## Header picker screen

Accessed from Profile (banner tap) and from Settings → Profile section.

### Structure

1. **Live preview** of profile header at top (updates as user picks)
2. **"Header Style" section:**
   - Upload a photo (JPG or PNG, up to 5MB) — auto-crop to 16:9 with position adjuster
   - Use a film backdrop (pick any film in catalog) — Cinemagraphs-native, distinguishes from Letterboxd Pro's photo-only
   - Choose a gradient (8 presets)
3. **Save button**

### Locked decisions

- **8 gradient presets:** Midnight, Ember, Ocean, Dusk, Forest, Gold, Rose, Steel
- **Film backdrop option uses any film in catalog**, not just user's reviewed films
- **Auto-crop with position adjuster** for uploaded photos (not freeform crop)
- **Default for new users is the onboarding-derived gradient** (custom, assembled from chosen films). If user skips onboarding, random gradient assigned.

### Rationale notes

- The film backdrop option is a Cinemagraphs differentiator. Letterboxd Pro only allows uploaded images.
- The onboarding-derived gradient is unique per user (assembled from their chosen films' poster colors), making each header literally unique. The 8 presets remain available for users who want to swap.

---

## Onboarding flow

Runs on first signup. Skip available on every screen.

### Structure (3 screens)

**Screen 1 — "Pick the years you keep returning to"**
- Multi-select chips: 1920s–30s, 40s–50s, 60s–70s, 80s, 90s, 2000s, 2010s, 2020s
- Max 4 selections
- As user taps chips, matching film posters appear and accumulate visually

**Screen 2 — "What films wreck you?"**
- Multi-select chips: Drama, Horror, Comedy, Sci-fi, Thriller, Romance, Action, Documentary, Animation, Indie
- Max 5 selections
- More posters accumulate as chips are tapped, narrowed by previous decade selection

**Screen 3 — "Which of these have you seen?"**
- Grid of 12 popular films chosen based on screens 1 & 2
- Multi-select, tap to mark seen
- Skip option ("none of these")

**Final transition: gradient assembly**
- Accumulated posters animate / dissolve / blend into a gradient based on their dominant colors
- That gradient becomes the user's profile header (custom, not one of the 8 presets — unique per user)
- "Your profile is ready" reveal screen showing completed profile with the assigned gradient

### Locked decisions

- **3 screens, not 4.** Decade + genre chips + film grid is sufficient signal.
- **Skippable on every screen.** Required onboarding is the biggest friction in mobile apps.
- **Reset taste in Settings re-runs the same flow.**
- **NO upfront feature tutorial.** Replaced with in-context tooltips on first encounter + "How it works" page in Settings → About.
- **Posters follow user across screens, then dissolve into gradient at end.** This is the brand-defining moment.

### Visual quality requirements

- **Live header preview that builds as you choose.** As user taps chips, gradient assembles in top portion of screen.
- **Posters slide in with motion** when chips are tapped.
- **Microcopy with personality.** "What films wrecked you?" beats "Select genres."
- **Final reveal screen.** Shows the completed profile with the assigned gradient header.

### Dependencies

- Gradient banner system (from PR 1)
- `react-native-image-colors` re-enabled for color extraction (currently hash fallback per memory #10)

### Rationale notes

- Onboarding solves three problems at once: (1) thematic gradient header, (2) seeds Recommended For You with relevant films, (3) gives the algorithm signal so cold-start sections aren't empty.
- The poster-dissolve-into-gradient ending is what makes the moment cinematic. Without it, the flow is just a Spotify-Wrapped-style quiz with personalized output.

---

## Lists — standalone screen

Accessed from Profile via "All →" on the Lists section.

### Structure

- **Header:** "Lists" title + "+ New" button
- **Filter pills:** All / My Lists / Friends / Staff Picks
- **Sort control:** "Sorted by Popular" with sort menu
- **List cards** (vertical list):
  - 2×2 poster mosaic (always first 4 films)
  - Title + description + film count + author
  - Averaged arc sparkline + arc score + heart count

### Locked decisions

- **Default filter when entering from Profile = My Lists.** Context-aware default. From other entry points, defaults to All.
- **2×2 mosaic always shows the first 4 films of the list.** Cannot be customized. Mosaic is automatic and predictable.
- **For lists with fewer than 4 films, posters repeat** (poster1/poster2/poster1/poster2). No placeholder graphics.
- **Averaged arc sparkline on each list card** is included, but flagged as the riskiest sparkline decision because averaged arcs across 20-50 films may converge toward similar shapes (the failure mode that killed sparklines in search results).
- **Mitigation:** when CC builds this, add a config flag `SHOW_LIST_CARD_SPARKLINES` defaulting true. If real-data testing shows them all looking similar, flip the flag without a refactor.

---

## List detail page

Accessed by tapping a list card.

### Structure (top to bottom)

1. **Customizable backdrop hero** (full-bleed image, gradient scrim for legibility)
2. **List title + description + film count + author** overlaid on backdrop
3. **Averaged arc sparkline** (single sparkline summarizing emotional shape across all films)
4. **Action row:** Like / Share / Edit (if owner)
5. **Filter / sort controls + view toggle** (icon pair top-right of films section)
6. **Films in the list** (renders based on view toggle)

### Locked decisions

- **Backdrop default = first film in the list.** User can override and pick any film in the list to be the cover.
- **Customization affects ONLY the list detail backdrop.** The 2×2 mosaic on cards always uses first-film logic and is never customizable. Two distinct treatments, no propagation.
- **View toggle is grid/list visual density** (Option A from the discussion):
  - **Grid view:** 3-column poster grid, posters only, no metadata
  - **List view:** rows with poster + title + year + score + sparkline per row
- **Default view on entry: grid view.** First impression should be the visual one.
- **Sparklines DO appear on list-view rows** (Humza's deliberate exception to the no-sparklines-in-list-views rule). Justification: user opts into list view via toggle = wants details.

### Rationale notes

- The backdrop hero is the Apple Music / Spotify playlist pattern. Mosaic on cards = "list feels like a curated collection at a glance." Backdrop hero on detail = "list feels cinematic and authored when you commit to viewing."
- The averaged sparkline directly below the backdrop is one sparkline per list (not 24), so it doesn't trigger the failure mode.

---

## Film detail page

The most product-defining screen. Where blind mode and similar films live.

### Structure (top to bottom)

1. **Backdrop hero** — full-bleed image, gradient scrim
2. **Metadata row** — small poster left, title + year + runtime + director + bookmark + add + **blind mode toggle** icons top-right
3. **Sentiment arc section** — header + score + source pill + graph + Expand affordance
4. **Beat pills** — horizontal scroll, color-coded by score
5. **Peak / Lowest moment cards** — two cards side by side
6. **Summary** — critic-aggregated text
7. **Write review CTA** (smaller, secondary placement)
8. **User Reviews** — preview, "See all" link
9. **Films like this** — horizontal scroll, content-based primary + arc-shape secondary

### Locked decisions

- **Score placement stays inline with section header** ("Sentiment arc" left, "Critics 9.2" right). The current design works. Score is contextually attached to the graph, not a floating hero number.
- **Blind mode toggle lives top-right next to bookmark + add icons** (not inline with score, not in graph expanded view). Reason: must be tappable BEFORE user scrolls to score.
- **Blind mode is per-film by default**, with a global default in Settings ("Always blind for unwatched films").
- **CTA is positioned BETWEEN Summary and User Reviews** (above reviews, not below). Reason: reviews grow over time and the CTA would get pushed deep. YouTube/Reddit pattern: comment box on top, comments below.
- **CTA is smaller and secondary**, not the dominant gold banner the current design has.
- **Similar films section is rebuilt** to do real content-based recommendations (genre, theme, director, era). Currently broken — returns alphabetically-adjacent films and the source film itself.
- **Similar films secondary axis** = arc-shape sort/filter. Optional toggle, not the primary.
- **External scores never on this page.** Permanent decision.

### Pre-existing bug to fix

The current "Similar films" algorithm is broken. For 12 Angry Men (1957 courtroom drama) it returns:
- Wuthering Heights, (500) Days of Summer, 10 Things I Hate About You, **12 Angry Men itself**, 16 Wishes

The source film appearing in its own list is a clear bug. Recommendations look like alphabetical/numerical adjacency. Fix the algorithm during PR 4.

This bug is also live on cinemagraphs.ca (web) — same backend. Worth a separate quick PR for web if that matters.

---

## Search tab

### Structure (top to bottom)

1. **Search input** (sticky at top)
2. **Films / People sub-tab toggle** (current implementation)
3. **Filter pills** (visible only when search is active): All / Genre ▾ / Decade ▾ / Director ▾ / Sort ▾
4. **Recently Viewed strip** (5-6 posters, horizontal scroll, empty state only — slides off when typing) — post-auth
5. **Category grid** (current implementation, w500 sharpness fix shipped PR #7)
6. **Search results** (when typing): rows with poster + film metadata, NO sparklines

### Locked decisions

- **Search input at the top is sticky.** Standard mobile pattern. Recently Viewed lives BELOW the search bar, not above.
- **Films / People sub-tab toggle stays as current implementation.**
- **Filter pills are chips above results** (not a bottom sheet). Each pill opens a small picker for that filter only.
- **Director filter is a primary attribute filter** (Letterboxd users complain frequently).
- **Recently Viewed is posters only, no metadata.** 5-6 posters in horizontal scroll. Slides off when user starts typing.
- **Category grid stays as-is.** Already w500-sharp from PR #7.

### Dependencies

- Recently Viewed needs auth (PR 9 in the broader sequence) + AsyncStorage local tracking or new API endpoint to log film detail page views per user.

---

## Explore tab

### Structure (top to bottom)

1. **Top ticker** — recent score changes with movement sparklines (current, kept)
2. **Today's Peak** — single hero, full ArcCard, refreshes daily
3. **Trending arcs** — horizontal scroll, ArcCards
4. **Biggest sentiment swings** — horizontal scroll, ArcCards
5. **Now Playing** — horizontal poster cards (current, kept)
6. **Hidden peaks** — horizontal scroll, ArcCards (films where one beat dramatically exceeds the rest)
7. **Emotional rollercoasters** — horizontal scroll, ArcCards (high beat-to-beat variance)
8. **Films that nosedive** — horizontal scroll, ArcCards (high opening, low finale)
9. **Best recovery** — horizontal scroll, ArcCards (V-shape: dip then recover)
10. **Slow burns** — horizontal poster cards (clustered shape)
11. **Steady greats** — horizontal poster cards (clustered shape)
12. **Perfect endings** — horizontal poster cards (clustered shape)
13. **Recommended for you** — horizontal poster cards, conditional (only when user has 5+ reviews)

### Locked decisions

- **Mixed format.** ArcCard format for sections where films have visually distinct shapes. Poster cards for sections where films cluster by curation (because the shape is then redundant with the section name).
- **Horizontal scroll for ALL sections.** Vertical lists with sparklines (current "Trending arcs" implementation) get killed in this redesign.
- **Conversion: existing vertical "Trending arcs" → horizontal ArcCards.**
- **Today's Peak is the only full hero**, not a horizontal scroll.
- **Recommended for you is conditional.** Hidden until user has 5+ reviews. Don't show "Recommended" with random films during cold start.

### Volume note

13 sections is a lot. Apple Music has roughly that many. When CC populates each section with real data, kill any section that has fewer than 8 strong entries. Better 8 strong sections than 13 mixed.

### Deferred until audience data exists

- Most divisive films
- Critics loved it, audiences didn't

---

## Stats screen

Dedicated screen, accessed from Profile via "View all stats →" link on the Stats teaser. Publicly visible (other users can see).

### Structure (top to bottom)

**Lead with Cinemagraphs-only shape stats:**
1. **Your taste in arcs** — distribution of arc shape categories (slow burns, steady greats, etc.)
2. **Your average arc** — composite signature shape graph (averaged across all personal review arcs)
3. **Where your peaks happen** — runtime % distribution heatmap or histogram
4. **Year in arcs** — chronological timeline of films reviewed, peak heights = scores
5. **Your highest peaks** — film grid of your highest Peak moments
6. **Films where you most disagreed with critics** — biggest delta films (partial; needs audience data for full version)
7. **Reviewing patterns** — longest streak, most-reviewed month, weekday breakdown

**Then Letterboxd-parity numbers:**
8. **Numbers row:** Films / Hours / Directors / Countries / Longest streak / 2+ film days
9. **By year** — bar chart (Films / Ratings toggle)
10. **By decade** — with highest-rated decade poster grid
11. **Genres** — bar chart (Most-Watched / Highest-Rated toggle)
12. **Countries** — bar chart + world map
13. **Most-watched actors** — circular avatars + film counts
14. **Most-watched directors** — same format
15. **Crew & Studios** — writers, producers, editors, cinematographers, studios
16. **Rated higher than average** — film grid
17. **Rated lower than average** — film grid
18. **Collections** — franchise progress (Godfather, Mission Impossible, etc.)

### Locked decisions

- **Lead with shape stats**, not Letterboxd-style numbers. First scroll = your taste signature, your peak patterns. Familiar numbers come BELOW.
- **Most-Watched / Highest-Rated toggles** within Genres, Cast, Directors sections. Same data sliced two ways.
- **All public for v1.** No per-stat privacy toggle. Don't build it until users ask.
- **Diary tab on year chart removed** — Cinemagraphs is review-first, no separate diary concept.
- **Themes & Nanogenres skipped** — Letterboxd-proprietary data.
- **List Progress (Letterboxd Top 500, AFI 100, etc.) deferred.** Could be added later as canonical lists.

### Stats teaser on profile (separate from full screen)

- Combined card: average arc sparkline + 3-bar distribution + "View all stats →" link
- Placement: between 4 favorites and Recent Reviews
- ~5-6 lines of vertical space (more compact than the full screen, more visual than a single stat)

---

## Watchlist

### Locked decisions

- **Watchlist is a fixed pinned list.** Always appears first on the Lists screen, above user-created lists.
- **Cannot be deleted.** It's a system list, not user-created.
- **Default name is "Watchlist."** Renaming TBD — your call when CC builds it.
- **2×2 mosaic cover** like any other list. Consistency over special treatment.
- **Privacy toggle works** like any other list (default public, can set private).
- **Standard list detail page** (backdrop hero, view toggle, etc.).
- **Entry points:**
  - Bookmark icon top-right of film detail page
  - Global long-press anywhere on a film poster/card across the entire app

### Global long-press gesture

Per the locked cross-cutting decision: long-press to add to Watchlist works on **any film poster/card across the app**:
- List views
- Search results
- Explore tab
- Profile recent reviews
- Lists previews
- Anywhere a film poster appears

One consistent gesture, one universal entry point.

---

## Settings screen

### Structure

- **Search bar** at top (iOS Settings pattern, scales as app grows)
- **Profile section** — Edit profile, Header style → picker, Reset taste preferences (re-runs onboarding)
- **Privacy section** — Profile privacy, Watchlist privacy, Default list privacy, Always blind for unwatched films (global blind mode default)
- **Notifications section** — Push, Email
- **Connected accounts section** — Apple, Google
- **Account section** — Email, Password, Sign out, Delete account
- **About section** — Help, Terms, Privacy policy, Version, "How it works" (app feature explainer)

### Locked decisions

- **Grouped sections, not flat list.** Standard iOS pattern.
- **Search bar at top.** Settings will grow; searchability matters.
- **Header style entry point lives in Profile section** (not Display/Appearance). Header is profile customization, not display preference.
- **Blind mode global default lives in Privacy section** (not Display). It's a "control what's revealed to yourself" toggle.
- **Reset taste preferences re-runs onboarding** — user gets a fresh gradient + Recommended seed.
- **"How it works" page in About** for users who want feature explanations on their own time. Replaces the upfront feature tutorial we explicitly dropped from onboarding.

---

## Cross-cutting features and gestures

### Blind mode

- **Per-film toggle** at top-right of film detail metadata row (alongside bookmark + add icons)
- **Global default** in Settings → Privacy → "Always blind for unwatched films"
- **What's hidden in blind mode:** the score number. Arc shape remains visible.
- **Why it matters:** Letterboxd users complain that ratings prime experience. Cinemagraphs can spoil-protect verdict while preserving shape signal. This is product-defining.

### Long-press to add to Watchlist

- **Works on every film poster/card across the entire app.** One universal gesture.
- Single tap → goes to film detail page (current behavior, unchanged)
- Long-press → adds to Watchlist (new behavior, global)

### Recommendations (across the app)

- **Primary axis: content-based** (genre, theme, director, era). This is what users want when they discover.
- **Secondary axis: arc-shape similarity.** Optional sort/filter on the similar films section.
- **NOT the primary recommendation engine.** Users discover by topic, not by emotional structure.

### In-context tooltips

- First-time-only tooltips on key features (the graph, beat pills, blind mode toggle, long-press gesture, 4 favorites slot)
- Dismissable, never repeats
- Replaces the rejected upfront feature tutorial in onboarding

---

## Permanent product decisions

These are NEVER revisited unless there's a fundamental product pivot.

- **No external scores on the film detail page** (IMDb, RT, Metacritic). Page stays Cinemagraphs-pure forever. Showing external scores would dilute the message and pull users back into aggregate-score thinking.
- **No TV tracking.** Cinemagraphs is films-only.
- **No em dashes** in code, comments, JSX, copy, or commit messages.
- **Sparklines belong on detail pages, not list views** (with explicit exceptions noted: 4 favorites, list-view-of-list-detail).

---

## Parked followups

These survive across sessions and need to be addressed eventually.

### From PR #7 (TMDB poster helper)
- Extract `getAvatarUrl(user, context)` sibling helper for user-avatar URLs in UserCard.tsx, FollowersModal.tsx, and app/user/[id].tsx:31. User schema is `user.image` / `profilePath`, distinct from film schema.
- Normalize `src/data/mockProfile.ts` to use bare `posterPath` values instead of full TMDB URLs so mock data flows through the helper's size mapping instead of being short-circuited by the http startsWith check.

### From the redesign session
- **Onboarding gradient assembly** depends on `react-native-image-colors` re-enabled (currently hash fallback per memory #10). Must be re-enabled before EAS production builds AND before PR 2 ships.
- **Tabular-nums on stats numbers** — preserve where exists during typography swap, audit and add where missing AFTER typography ships if visible misalignment shows on device.
- **Web typography swap** (Playfair → DM Sans on cinemagraphs.ca). Mobile shipped May 3 2026. Web parked.

### Other open work (from earlier memory)
- **Periodic backfill sweep cron** — PR #21 flip-trigger missed pre-release→released orphans.
- **Letterboxd Apify integration** — in package.json, not wired up.
- **Guardian URL encoding bug** — `src/lib/sources/guardian.ts` HTTP 400 on titles with special characters (¿ ?).
- **Server-side search refactor** — fetchAllFilms paginates ~1334 films on Search mount (27 HTTP calls). Multi-PR multi-day; schedule as focused session.
- **Live Reactions** — built but intentionally hidden, all code intact, TODO comments mark unhide points.
- **EAS Android build prep** — generate Android keystore SHA-1, create Android OAuth client ID in GCP, add `EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID` to .env.
- **Google OAuth iOS client bundle ID update** — must change from `com.cinemagraphs.mobile` to `ca.cinemagraphs.app` before any standalone iOS build (TestFlight, production), or Google Sign-In will fail silently.
- **Apple Sign In JWT secret regeneration** — expires September 2026. Use Key ID `SCR59ABFVK`, Team ID `639P4Q2VAB`, Services ID `ca.cinemagraphs.web`, and the `.p8` file.
- **Two-layer halo for poster generator** — gold score legibility on bright backdrops (Help!, Heathers, M:I-2). Future fix: 0.20 outer glow w9 + 0.55 inner w4.5 + gold w2.5 + warm-color auto-detect.

---

## How to use this document

When starting a new CC session for a redesign PR:

1. Read the "Core product principles" section to recalibrate.
2. Read the section for the specific screen the PR is about.
3. Read "Cross-cutting features and gestures" if relevant.
4. Cross-reference with the latest memory entries in Claude (which have the highest-level decisions).
5. Write the CC prompt with the same rigor used for PR #7 and PR #8: STOP-and-report inventory step before any changes, explicit verification greps, manual smoke test plan, no `git add -A`, never use em dashes.

When this document is updated:

- Mark shipped PRs in the PR sequence section
- Move parked followups to "Other open work" once they're shipped or canceled
- Add new decisions as locked items, not as parked questions
- Don't delete history — strikethrough or move to "shipped" instead

---

**End of spec.**
