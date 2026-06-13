# VoiceOver QA Script - Batch 5 Accessibility

Run on a physical iOS device with VoiceOver enabled (Settings > Accessibility > VoiceOver). Right-swipe advances focus to the next element, left-swipe moves back. Listen at each focus stop and confirm the spoken words match the line below. For sliders, focus the control then swipe up to increase and swipe down to decrease.

Convention: each line gives the label VoiceOver should speak, followed in parentheses by the role it should announce (button / adjustable / link). VoiceOver reads the label first, then the role.

Last updated: 2026-06-13 (Batch 5 accessibility pass: a11y/batch5-pass-v2)
Last run on device: <fill on each test run>

## Android / TalkBack note

This branch is written for VoiceOver (iOS) as the primary pass, since the developer tests on iPhone only. TalkBack (Android) verification is deferred until an Android device is available pre-launch. The Android-specific attribute on the Explore ticker (importantForAccessibility="no-hide-descendants") is present in code but unverified on-device; the iOS equivalent (accessible + single accessibilityLabel) is what this script checks. When an Android device is available, re-run every section below under TalkBack and confirm the same focus order and announcements, paying special attention to the ticker collapsing to one element.

## Explore tab - Movie Market ticker

Reach it: open the Explore tab. The ticker is the horizontally scrolling Movie Market row at the very top.

The ticker animates and renders three duplicate copies of the film set for a seamless loop. It is intentionally collapsed into a single accessibility element so VoiceOver does not read dozens of moving, duplicated items.

- [ ] Ticker (whole row, one focus stop) -> "Market ticker showing today's film scores" (no role, reads as a single summary element)

Pass/fail notes:
- [ ] The ticker MUST read as ONE summary element. Individual film items inside it must NOT be focusable.
- [ ] Right-swiping from the ticker lands on the next screen element (the hero card below it), NOT on a film inside the ticker.
- [ ] You should never hear the same film announced two or three times in a row (that would mean the duplicate copies leaked into the accessibility tree).

## Explore tab - "See all" section grid (section.tsx)

Reach it: on the Explore tab, find a feed row that shows a gold "See all" link on the right (for example a Now Playing or arc-shape row), and tap it. This opens the section grid. Tiles here show poster, title, and a gold score.

Right-swipe through the grid. Each tile is one focus stop:

- [ ] Poster tile, not reviewed, with score -> "<title>, <year>. Score <X>." (button). Example: "Dune, 2021. Score 8.4." (button)
- [ ] Poster tile, reviewed (ticket stub showing) -> "<title>, <year>. Score <X>. Reviewed." (button). Example: "Dune, 2021. Score 8.4. Reviewed." (button)
- [ ] Poster tile with no score available -> "<title>, <year>." (button), score clause omitted. If reviewed: "<title>, <year>. Reviewed." (button)

Pass/fail notes:
- [ ] The word "Reviewed." is spoken ONLY when the ticket-stub badge is visible on that tile.
- [ ] The score is the merged/overall score (one decimal place), not a personal score.

## Search tab - Browse category rows (search.tsx)

Reach it: open the Search tab and do not type anything. The idle state shows the BROWSE list of category rows.

- [ ] "BROWSE" heading text -> "BROWSE"
- [ ] Each category row -> "Browse <category>" (button). Examples: "Browse Drama" (button), "Browse Highest rated" (button), "Browse Most dramatic arcs" (button), "Browse Release date" (button)

Pass/fail notes:
- [ ] The chevron glyph at the end of each row should not be a separate focus stop; the whole row is one button.

## Search tab - search results (search.tsx ResultCard)

Reach it: on the Search tab, type a film name. Results appear as cards with poster, title, year, and director.

- [ ] Result card, title and year only -> "<title>, <year>" (button). Example: "Inception, 2010" (button)
- [ ] Result card, with director -> "<title>, <year>, directed by <director>" (button). Example: "Inception, 2010, directed by Christopher Nolan" (button)
- [ ] Result card, year missing -> "<title>" (button), with the director clause appended only if a director is present

Pass/fail notes:
- [ ] The poster, title, year, and director must all be one focus stop (the whole card), not separate stops.

## Search tab - category grid (category/[key].tsx)

Reach it: from the Search tab Browse list, tap a category row (for example Drama). This opens the category grid. Tiles here are poster-only (no title or score shown on screen).

Right-swipe through the grid. Each tile is one focus stop:

- [ ] Poster tile, not reviewed -> "<title>, <year>" (button). Example: "Sicario, 2015" (button)
- [ ] Poster tile, reviewed (ticket stub showing) -> "<title>, <year>. Reviewed." (button). Example: "Sicario, 2015. Reviewed." (button)

Pass/fail notes:
- [ ] Even though the tile shows no on-screen title, VoiceOver MUST still announce the title and year (the label carries information the sighted layout omits).
- [ ] No score is spoken here (this grid has no score, unlike the Explore section grid).

## Profile tab - My films grid (profile.tsx PosterCell)

Reach it: open the Profile tab, go to My films. The Reviewed grid shows a sparkline and personal score under each poster; the Watched and Reactions grids are poster-only.

- [ ] Reviewed grid, poster view -> "<title>. Your score <X>." (button). Example: "Whiplash. Your score 9.0." (button)
- [ ] Watched grid, poster view -> "<title>" (button), no score (showSparkline is false here)
- [ ] Reactions grid -> "<title>" (button), no score

Pass/fail notes:
- [ ] "Your score" is the user's personal rating (one decimal), spoken only in the Reviewed grid where the sparkline and score are visible.
- [ ] The sparkline graphic must not be a separate focus stop; the whole cell is one button.

## Profile tab - Watchlist grid (profile.tsx WatchlistCell)

Reach it: open the Profile tab and go to the Watchlist.

- [ ] Watchlist poster cell -> "<title>" (button). Example: "Arrival" (button)

Pass/fail notes:
- [ ] Title only, no score (watchlist films may be unwatched and unscored by the user).

## Profile tab - section headers "See all" link (SectionHeader.tsx)

Reach it: open the Profile tab hub. The RECENT REVIEWS and LISTS section headers show an "All" link on the right when the section is non-empty (it is hidden when the section is empty).

- [ ] "RECENT REVIEWS" heading -> "RECENT REVIEWS"
- [ ] "All" link (RECENT REVIEWS) -> "All" (link). The visible label is "All" followed by a right-arrow glyph; VoiceOver may also speak "right arrow".
- [ ] "LISTS" heading -> "LISTS"
- [ ] "All" link (LISTS) -> "All" (link)

Pass/fail notes:
- [ ] The link announces the role "link", not "button".
- [ ] 44pt target: the link wraps only the short "All" text but now has an enlarged hitSlop (14pt top/bottom, 12pt left/right). Confirm it is comfortably tappable by touch without precise aiming. The visible layout must NOT have shifted (the header stays baseline-aligned; hitSlop was used instead of a min-height for exactly this reason).

## List detail screen - view-mode toggles (list/[id].tsx)

Reach it: open the Profile tab, go to Lists, and open any list (or open a public list from another user's profile). The header has three small icon buttons on the right: poster view, graph view, and a menu.

- [ ] Poster-view toggle (grid icon) -> "button" (no descriptive name in this batch)
- [ ] Graph-view toggle (list icon) -> "button"
- [ ] Menu toggle (three lines) -> "button"

Pass/fail notes:
- [ ] 44pt target: each icon is about 16pt with padding 4 (about 24pt box) and now carries hitSlop 10 on every side, giving a roughly 44pt touch area. Confirm each is easily tappable without hitting a neighbor.
- [ ] Known gap (not a failure for this pass): these three toggles announce only as "button" with no descriptive label. Adding labels ("Poster view", "Graph view", "List options") is a recommended follow-up; this batch only enlarged the touch targets.

## Write Review screen - sliders (review.tsx)

Reach it: open any film detail page, tap the Write review CTA. The review screen has one Overall rating slider near the top and one slider per story beat below it.

For each slider: right-swipe to it, confirm it announces as "adjustable" with its current value, then swipe up once (increase) and swipe down once (decrease) and confirm the new value is re-announced each time. The step is 0.5, range 1 to 10.

- [ ] Overall rating slider -> "Your rating, <X> out of 10" (adjustable). Example at default: "Your rating, 5.5 out of 10" (adjustable)
- [ ] Overall slider, swipe up -> value increases by 0.5 and re-announces, e.g. "Your rating, 6.0 out of 10"
- [ ] Overall slider, swipe down -> value decreases by 0.5 and re-announces
- [ ] Each beat slider -> "<beat name>, <X> out of 10" (adjustable). Example: "Opening image, 5.0 out of 10" (adjustable)
- [ ] Beat slider, swipe up / down -> the beat's own value re-announces with the beat name

Pass/fail notes:
- [ ] Every slider MUST announce the role "adjustable" (not "button"). If it says "button", the adjustable role did not apply.
- [ ] The announced value must update on every swipe-up / swipe-down; a stale value that does not change is a failure.
- [ ] Each beat slider announces its OWN beat name and value, not a shared label.

## Sign-off

- [ ] All sections above pass under VoiceOver on a physical iPhone.
- [ ] Android / TalkBack pass deferred (see note at top); re-run before launch on a physical Android device.
