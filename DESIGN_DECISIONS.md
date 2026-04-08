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
- Currently empty state placeholder
- Wire up after auth (Prompt 9)
- Needs AsyncStorage local tracking or API endpoint for page view logging

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

## Instagram Stories Sharing
- Use Instagram Share API (not Web Share API) for mobile
- Reference Spotify share sheet UX
- Web app uses Web Share API as interim
