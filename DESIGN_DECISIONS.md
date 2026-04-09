# Cinemagraphs Mobile App - Design Decisions

This document captures all finalized UI/UX decisions. Update this whenever a design decision is made in chat. This prevents decisions from being lost across chat rotations.

## Colors
- Background: #0D0D1A
- Gold: #C8A951 (primary accent, critics graphs, scores)
- Teal: #2DD4A8 (audience graphs, personal scores on profile sparklines)
- Ivory: #F5F0E1 (text)
- Red: #E24B4A (low points, errors, sign out)

## Typography
- Headings: Playfair Display
- Body: DM Sans
- No em dashes anywhere

## Graph Rules
- Y-axis floor: one whole number below the lowest data point (dynamic)
- Y-axis cap: 10
- Teal dot: peak moment
- Red dot: lowest moment
- Gold polyline: critics/overall arc
- Teal polyline: audience arc (film detail)
- Dashed midline at score 5.0

## Graph Line Context
- Personal page: only user's personal arc
- Profile sparklines: site-wide average arc
- Film Detail + Expanded View: all three lines (gold/critics, teal/audience, ivory/merged)

## Profile Tab
- 4 sub-tabs: Profile (hub), My Films, Lists, Watchlist
- Header: consistent 44px avatar + username on all sub-tabs (hub hides header avatar, shows large 56px avatar in content)
- Settings gear visible on all sub-tabs
- Profile hub: avatar, bio, stats card, recently viewed (placeholder), section links with counts

## My Films - Reviewed (Graph View)
- Arc cards with poster thumbnail (50x75) on left
- Dominant color gradient background per film (left to right fade)
- Left border accent (3px) in dominant color
- Films grouped by month watched (e.g. "APRIL 2026")
- Day number in gold next to title
- Gold polyline, dashed midline
- Teal dot on peak, red dot on lowest
- Personal scores in gold, 20px Playfair Bold

## My Films - Reviewed (Poster View)
- 3-column poster grid
- Teal sparklines below each poster
- Personal scores in teal

## My Films - Watched
- 3-column poster grid only
- No sparklines, no scores

## Watchlist
- 3-column poster grid
- No sparklines, no scores

## Arc Card Poster Colors (mock data)
- Oppenheimer: #8B4513 (burnt orange)
- Poor Things: #2E4057 (slate blue)
- Dune Part Two: #B8860B (dark gold)
- The Holdovers: #8B0000 (dark red)
- Killers of the Flower Moon: #556B2F (olive)
- Past Lives: #4A6670 (steel blue)
- Anatomy of a Fall: #87CEEB (ice blue)
- Barbie: #E91E8F (pink)
- Zone of Interest: #3A5F0B (forest green)
- Saltburn: #4A2C7A (purple)

## Share Images
- Single "Graph Hero" style via @vercel/og
- Graph height band: 0.15-0.75 for 9:16 vertical overlays

## Mobile Graph
- No compression on mobile; Expanded Graph uses horizontal scroll with fixed y-axis
- Pinch-to-zoom, beat labels, tooltips

## Recently Viewed (Profile Hub)
- Local-only via AsyncStorage (key: "recently_viewed"), no API endpoint
- Stores up to 20 film IDs with timestamps, deduplicates by filmId
- Film detail page calls addRecentlyViewed(id) on mount
- Profile hub shows horizontal ScrollView of poster thumbnails (60x90, rounded corners)
- Falls back to empty state text when no history

## Lists
- Lists sub-tab shows card per list with poster strip, name, genre tag, film count
- "New list" button opens bottom sheet with name input, genre tag pills, film picker
- Genre tags: Drama, Action, Horror, Sci-Fi, Comedy, Thriller
- List creation validates name (unique, max 40 chars, required)
- Max 50 films per list
- Expanded list detail has poster/graph view toggle
- Graph view: arc card per film showing name, year, merged score, gold sparkline
- Poster view: 3-column grid
- Film detail page: "+" button next to Watched badge opens "Add to list" sheet

## Settings
- User card with avatar initials, name, email, edit link
- Account section: Edit profile, Change password, Notifications (all placeholder screens)
- Privacy section: Public profile (on), Allow followers (on), Private graphs (off)
- Private graphs is global toggle only (no per-review)
- About section links: How Cinemagraphs works, Contact us, Terms & privacy
- Sign out button with red border/text (#E24B4A)
- Version footer: "Cinemagraphs v1.0.0"

## About / How It Works
- 5 info cards: Sentiment graphs, The ticket stub, Write a review, Live react, Lists
- Cards: gold-tinted background, gold border, 12px border radius
- Accessible from Settings anytime

## Auth Flow
- AuthProvider wraps entire app, stores JWT in expo-secure-store
- On mount: reads stored token, validates via GET /api/user/profile, clears if invalid
- Navigation guard: auto-redirects to (auth)/landing if no token, to (tabs) if token
- Landing screen: reanimated entrance animation (logo fade, dashed line, tagline, buttons slide up)
- Sign in / Create account: single screen with tab toggle, gold active tab
- OTP: 6-digit input boxes (42x50), auto-advance, backspace returns to previous
- Forgot password: email input, teal confirmation on success
- Onboarding: checks AsyncStorage "has_seen_onboarding", redirects to /settings/about on first login

## Auth Gating
- useAuthGate() hook returns { gate, sheet } for any component
- gate(action) checks isAuthenticated; if not, shows bottom sheet "Sign in to continue"
- Sheet has "Sign in" (navigates to landing) and "Not now" (dismisses)
- Does NOT redirect user away from current screen unless they tap Sign in
- Applied to: Add to list (film detail), profile (shows unauthenticated state)

## Google / Apple OAuth
- Apple: expo-apple-authentication, iOS only, sends identityToken to /api/auth/mobile/apple
- Google: placeholder (needs client IDs from Google Cloud Console)
- Both route through handlePostAuth for token storage + onboarding check

## Settings Wiring
- Sign out button calls AuthProvider signOut (clears SecureStore, navigates to landing)
- Privacy toggles (publicProfile, allowFollowers, privateGraphs) load from GET /api/user/settings
- Toggle changes call PUT /api/user/settings, optimistic update with rollback on failure
- User card shows real name/email from AuthProvider

## App Icon and Splash
- App icon: gold C on #0D0D1A, Playfair Display Bold (exported from Canva)
- Splash screen: same motif, #0D0D1A background, resizeMode "contain"
- Android adaptive icon: same foreground, #0D0D1A background (not white)

## Onboarding Carousel
- 3-slide horizontal carousel with dot indicators
- Slide 1: Sentiment graphs (gold polyline arc SVG illustration)
- Slide 2: Write a review (gold slider SVG illustration)
- Slide 3: Lists and watchlist (gold grid SVG illustration)
- "Next" button on slides 1-2, "Get started" on slide 3
- "Skip" top-right on all slides
- Replaces How It Works redirect for first-time login onboarding
- How It Works (about.tsx) still accessible from Settings

## Ticker Speed
- Movie Market ticker slowed by 40% (32s to 44.8s per full cycle)
- Feels like a calm scrolling ticker, not a racing one

## Browse Categories
- 7 categories: Genre, Release date, Highest rated, Most dramatic arcs, Streaming service, Directors, Recently added
- Highest rated: sorts cached films by overallScore descending
- Most dramatic arcs: sorts by max-min range of sentiment datapoints
- Release date: sorts by year descending
- Recently added: reverses the cached film list
- Genre, Streaming service, Directors: pass-through (no filtering data available yet)
- Active category shown as label in results header

## Instagram Stories Sharing
- Use Instagram Share API (not Web Share API) for mobile
- Reference Spotify share sheet UX
- Web app uses Web Share API as interim
