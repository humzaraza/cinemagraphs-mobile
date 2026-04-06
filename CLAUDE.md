# CINEMAGRAPHS MOBILE APP

## THIS IS THE MOBILE APP

This is the React Native/Expo mobile app. It is a standalone project (separate repo/directory from the web app). The web app lives at cinemagraphs.ca. Do NOT attempt to set up a monorepo or shared packages.

## STACK

- React Native with Expo (SDK 52)
- Expo Router (file-based routing)
- TypeScript throughout
- react-native-svg for graph rendering
- expo-secure-store for JWT token storage
- @expo-google-fonts/playfair-display and @expo-google-fonts/dm-sans for custom fonts
- expo-haptics for ticket stub animation

### Backend (shared with web app)
- Next.js 16 API routes (hosted on Vercel at cinemagraphs.ca)
- Prisma + Neon PostgreSQL
- NextAuth JWT (mobile sends token in Authorization header, not cookies)
- Upstash Redis caching

### NOT in the stack
- No NestJS, Socket.io, BullMQ, Docker, or AWS
- No WebView wrappers for graphs (use react-native-svg)
- No Xcode required (use EAS Build)
- No monorepo tooling (no turborepo, no shared packages)

## FILE STRUCTURE

```
cinemagraphs-mobile/
  app/
    _layout.tsx              # Root layout (fonts, splash screen, navigation)
    (auth)/
      _layout.tsx            # Auth stack layout
      landing.tsx            # Splash screen with logo + auth buttons
      signin.tsx             # Sign in (email + password)
      signup.tsx             # Create account (name + email + password)
      verify.tsx             # OTP verification (new users only)
    (tabs)/
      _layout.tsx            # 3-tab bar layout
      index.tsx              # Explore tab
      search.tsx             # Search tab
      profile.tsx            # Profile tab
  src/
    components/              # Reusable components
    constants/
      theme.ts               # Design tokens (colors, fonts, spacing)
    lib/
      api.ts                 # API client (fetch wrapper with auth headers)
    types/                   # TypeScript interfaces
```

## DESIGN TOKENS

```
Background: #0D0D1A
Gold: #C8A951
Teal: #2DD4A8
Ivory/Text: #F5F0E1
Positive green: #00E676
Negative red: #E24B4A

Card borders: 0.5px solid rgba(200,169,81,0.12)
Card background: rgba(245,240,225,0.04)
Input background: rgba(245,240,225,0.06)
Input border: rgba(200,169,81,0.15)
Dashed midline: rgba(255,255,255,0.08)

Tab bar: rgba(13,13,26,0.95) with blur, border-top 0.5px rgba(200,169,81,0.15)
Active tab: #C8A951
Inactive tab: rgba(255,255,255,0.35)

Fonts: Playfair Display (headings), DM Sans (body)
Slider: 3px track, gold fill, 16px gold circle thumb
```

## NAVIGATION

3 bottom tabs:
1. Explore (film strip icon) - Movie Market ticker, Featured/For You feed
2. Search (magnifying glass icon) - search bar, categories, review/live react button top-right
3. Profile (person icon) - avatar, stats, sub-tabs (Profile, My Films, Lists, Watchlist)

No Review tab. Review/Live React entry points are on the Search screen (top-right button) and on film detail pages (CTA buttons).

No Friends feed in v1.

## API CALLS

The mobile app calls the SAME API endpoints as the web app at `https://cinemagraphs.ca/api/`. The only difference is auth: mobile sends JWT in the `Authorization: Bearer <token>` header instead of using cookies.

## KEY RULES

- No em dashes anywhere (not in code, not in UI text, not in comments)
- Never run multiple `rm -rf` or `npm install` commands concurrently
- Never retry a failed `rm -rf` automatically
- Commit after each major prompt with a descriptive message
- All graphs rendered with react-native-svg, never WebView
- Film runtime comes from the database (each film has its own length)
- Ticket stub icon (not eye icon) for "Mark as watched"
- Live reaction cooldown: 2 seconds between reactions
- Private graphs: global toggle in Settings only (no per-review toggle in v1)
- Score display: Lists/Explore/Search show merged/overall score. Profile > Reviewed shows user's personal score
- Story beat labels are film-specific (from NLP analysis), not generic
- No story beat labels on live reaction results (only timestamps + scores)

## BUILD PLAN

### To build (in order)
1. Project scaffold + tab layout + design system + landing screen
2. Auth flow (sign in, create account, OTP, JWT storage)
3. Explore tab (ticker, Now Playing, Trending, Recommended)
4. Film detail page with sentiment graph
5. Search tab with categories
6. Write Review + post-submit arc reveal
7. Live Reactions session + post-session
8. Profile with sub-tabs
9. Lists (creation, detail view)
10. Settings
11. About/onboarding
12. Mark as Watched (ticket stub) system
13. Expanded graph view
14. Merged live + beats graph overlay

### Current phase
Step 1: Scaffold and landing screen (Prompt 1)

## DESIGN REFERENCE

Full design doc: `Cinemagraphs_Mobile_App_Design_Handoff_v3.md`
Upload this file to Claude Code when building specific screens that need detailed design specs.
