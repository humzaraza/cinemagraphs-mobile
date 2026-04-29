# Cinemagraphs Mobile — State

## Overview

This is the Cinemagraphs mobile app: a standalone React Native / Expo project (SDK 54) that consumes the same backend as the web app at cinemagraphs.ca. It is not a monorepo and shares no packages with web.

- Framework: Expo + Expo Router (file-based routing, typed routes enabled)
- UI: React Native with `react-native-svg` for all graphs/charts (no WebView)
- Auth storage: `expo-secure-store` for JWT + cached user
- Other storage: `@react-native-async-storage/async-storage` for onboarding flags and recently-viewed films
- Fonts: Playfair Display (headings), DM Sans (body) via `@expo-google-fonts`
- Animations: `react-native-reanimated`
- Third-party auth: `expo-auth-session` (Google) and `expo-apple-authentication` (Apple)
- Image picker: `expo-image-picker` (avatar uploads)
- Bundle id: `ca.cinemagraphs.app`, URL scheme: `cinemagraphsmobile`
- New Architecture: enabled

The root layout (`app/_layout.tsx`) loads fonts, holds the splash screen until fonts are ready, wraps everything in `AuthProvider`, and registers all stack routes. `app/index.tsx` is a router: it redirects to `/onboarding` for first-time authenticated users, `/(tabs)/explore` for returning authenticated users, and `/(auth)/landing` otherwise.

## Screen Map

### Auth stack (`app/(auth)/`)
- **landing.tsx** — Animated splash with logo, tagline, and three sign-in buttons: Google (via `expo-auth-session`), Apple (iOS only), and "Continue with email" which routes to `auth.tsx`.
- **auth.tsx** — Unified sign-in / sign-up screen with a tab toggle. On sign-up, navigates to OTP verification.
- **otp.tsx** — Six-digit OTP verification after sign-up. Auto-advancing inputs, resend with a five-second cooldown.
- **forgot-password.tsx** — Email-only form that calls the `forgotPassword` endpoint and shows a success state.
- **_layout.tsx** — Stack layout for the auth group.

### Tabs (`app/(tabs)/`)
- **explore.tsx** — Home feed: sticky auto-scrolling ticker (~44.8s loop), Now Playing poster row, Trending arcs (sparklines), Recommended films. Pull-to-refresh. Contains a ticket-stub feature gated behind `{false && ...}` — **built but disabled**.
- **search.tsx** — Dual-mode search. Films mode is client-side with 400ms debounce over a fetched corpus; People mode hits the users API with 300ms debounce. Browse categories include genre, release date, trending arcs, and ratings.
- **profile.tsx** — Sub-tabs for Profile, My Films, Lists, Watchlist. Shows avatar, stats, recently viewed films. My Films has a reviewed/watched/reactions filter and poster/graph toggle. List creation modal with film picker. Watchlist is partially hidden — some UI is **built but disabled**.
- **_layout.tsx** — Three-tab bar (Explore, Search, Profile) with `expo-blur` background.

### Stack routes (`app/`)
- **film/[id].tsx** — Film detail: backdrop, poster, metadata, overall score, sentiment graph with critics/audience/both/merged toggle, review card, similar films. Watchlist and add-to-list actions are gated via `AuthGate`. Tracks recently viewed.
- **graph/[id].tsx** — Full-screen expanded graph viewer with SVG axes, timestamp labels, and tap-to-reveal tooltips.
- **list/[id].tsx** — List detail (owned or public). Poster-grid or arc-card view toggle, owner-only menu for edit/delete/visibility, and an add-film modal with search.
- **live-react/index.tsx** — Live reaction session: continuous slider plus reaction buttons (like, dislike, wow, shock, funny) with a ~3s cooldown. Posts reactions as the user watches; live points feed a real-time graph. Share button for the session.
- **user/[id].tsx** — Public user profile: stats, reviews (default tab), lists tab, follow/unfollow with optimistic UI, followers/following modal, not-found fallback.
- **review.tsx** — Multi-stage review form: overall rating slider, then per-beat ratings for up to eight algorithmically-chosen beats, arc reveal animation, preview, submit.
- **onboarding.tsx** — Three-slide swipeable carousel (arc explanation, beat rating, lists). Skip/Next. On finish, calls `clearOnboarding` and routes to Explore.
- **+not-found.tsx** — Redirects to `/(tabs)` on mount.
- **index.tsx** — Auth-aware router described above.

### Settings (`app/settings/`)
- **index.tsx** — Hub with user card, Account section (change password, notifications), Privacy toggles (public profile, allow followers, private graphs). Toggles call `updateUserSettings`.
- **edit-profile.tsx** — Name / username / bio editing, avatar picker (camera or library, 2MB cap). Validates name (required, <=50), username (3-20 chars, alphanumeric + underscore), bio (<=160). Handles 409 username conflict.
- **change-password.tsx** — Current / new / confirm form with min-8 validation; auto-dismisses success message after 800ms.
- **notifications.tsx** — Toggles for new followers, review likes, list updates. Note at bottom says push notifications are coming soon.
- **about.tsx** — Static "How it works" cards (arcs, ticket stub, beat sliders, live react, lists).
- **contact.tsx** — Email / X / Instagram links opened via `Linking.openURL`.
- **terms.tsx** — Static ToS + privacy policy copy.
- **_layout.tsx** — Headerless stack for settings sub-routes.

### Reusable components (`src/components/`)
- **ArcCard** — Poster + sparkline card with a hash-derived color accent and long-press support.
- **AuthGate** — Wrapper + `useAuthGate` hook that shows a "Sign in to continue" bottom sheet when an unauthenticated user taps a gated action.
- **BottomSheet** — Keyboard-aware modal sheet with handle, title, cancel, dismissible overlay.
- **FollowersModal** — Modal with followers/following tabs, tappable user cards, optimistic follow/unfollow.
- **GraphToggle** — Pill with popover dropdown for Critics/Audience/Both/Merged modes, with a lock state for missing audience data. Haptic feedback on selection.
- **RatingSlider** — PanResponder-based 1-10 slider (0.5 step) for beat ratings; no native slider dependency.
- **Sparkline** — SVG line chart with optional axes, midline, peak/low dots, runtime labels. Used across explore, search, profile, lists.
- **UserCard** — Avatar (with initial fallback) + name/username + optional review/follower counts.

### Local logic (`src/lib/`)
- **api.ts** — Single fetch wrapper + every backend endpoint used by the app (see API section).
- **auth.tsx** — Thin token-only context that wraps the SecureStore helpers in `api.ts`. Not the primary auth context — that lives in `src/providers/AuthProvider.tsx`.
- **lists.ts** — Local helpers: name validation, mock list creation, add/remove film, 50-film cap.
- **live-react.ts** — Pure scoring logic: clamp to 1-10, reaction weight application, 3s cooldown check, beat selection (up to 8 moments: peak, low, first, last, evenly spaced), divergence calculation.
- **recentlyViewed.ts** — AsyncStorage-backed list capped at 10 items; prepends new films, de-dupes.

## Auth Flow

Primary provider: `src/providers/AuthProvider.tsx`. Exposes `signIn`, `signUp`, `verifyOtp`, `signOut`, `signInWithGoogle`, `signInWithApple`, plus `isAuthenticated`, `isLoading`, `needsOnboarding`, and `clearOnboarding`.

- **Session restore on mount** — Reads `auth_token` from SecureStore and calls `/user/profile`. On 401/403/404 it clears stored auth. On other errors (network, 500s) it falls back to the `auth_user` cached JSON in SecureStore so the app still works offline.
- **Email sign-in** — Posts to `/auth/mobile/login`, stores token + user, no OTP.
- **Email sign-up** — Posts to `/auth/register`. Backend emails an OTP; the screen navigates to `otp.tsx`.
- **OTP verify** — Posts to `/auth/verify-otp` with `{ email, code, mobile: true }`. Response includes the JWT.
- **Forgot/reset password** — `/auth/forgot-password` sends a reset email; `/auth/reset-password` consumes a token.
- **Google sign-in** — `expo-auth-session/providers/google` with `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and the `cinemagraphsmobile` scheme. The resulting `idToken` is posted to `/auth/mobile/google`.
- **Apple sign-in** — iOS only (`Platform.OS === 'ios'`). `expo-apple-authentication` requests FULL_NAME and EMAIL scopes; the resulting `identityToken` (and first/last name on first sign-in) is posted to `/auth/mobile/apple`.
- **Onboarding gate** — After any successful auth, `handlePostAuth` checks `AsyncStorage` for `has_seen_onboarding_<userId>`. If unset, `needsOnboarding` flips true and `app/index.tsx` redirects to `/onboarding`. `clearOnboarding` writes `"true"` when the carousel finishes.

## API Integration

All backend calls go to `https://cinemagraphs.ca/api` (the same Next.js deployment as the web app), defined in `src/lib/api.ts`. Every request runs through `apiFetch`, which:

1. Reads the JWT from SecureStore.
2. Adds `Authorization: Bearer <token>` when present (cookies are not used on mobile).
3. Sets `Content-Type: application/json`.
4. Logs the method and URL to the console.

Endpoints used, grouped by feature:

- **Films** — `/films` (with `ticker`, `nowPlaying`, `sort=highest`, `sort=recent`, `genre`, `exclude`, `limit`, `page` query params), `/films/:id`, `/films/:id/reviews` (POST), `/films/:id/audience-data`.
- **Live reactions** — `/films/:id/reaction-sessions` (GET / POST), `/films/:id/reactions` (POST).
- **Auth** — `/auth/mobile/login`, `/auth/register`, `/auth/verify-otp`, `/auth/resend-otp`, `/auth/forgot-password`, `/auth/reset-password`, `/auth/mobile/google`, `/auth/mobile/apple`, `/auth/change-password`.
- **User profile** — `/user/profile` (GET, PATCH), `/user/avatar` (multipart POST), `/user/films`, `/user/watchlist` (GET / POST / DELETE), `/user/settings` (GET / PUT).
- **Lists** — `/user/lists` (GET / POST), `/user/lists/:id` (GET / PATCH / DELETE), `/user/lists/:id/films` (POST / DELETE), `/lists/:id` (public).
- **Social** — `/users/search`, `/users/:id`, `/users/:id/follow` (POST / DELETE), `/users/:id/followers`, `/users/:id/following`.

The audience-data helper normalizes the backend's beat-average map into an ordered array aligned to the film's beat list, returning `null` entries where data is missing and `null` overall when nothing is available. Avatar upload uses a raw `fetch` with multipart FormData rather than `apiFetch` because `Content-Type` must be set by the runtime.

## Local Storage

### SecureStore (`expo-secure-store`)
- `auth_token` — the JWT. Read on every `apiFetch`. Written via `setToken` after any successful sign-in or OTP verification. Cleared on sign-out or when the server rejects the token during session restore.
- `auth_user` — cached JSON of the last-known `AuthUser`. Used as an offline fallback during session restore when the server is unreachable.

### AsyncStorage (`@react-native-async-storage/async-storage`)
- `has_seen_onboarding_<userId>` — set to `"true"` when the user completes the onboarding carousel. Keyed per user so multiple accounts on one device each see onboarding once.
- Recently-viewed films list — maintained by `src/lib/recentlyViewed.ts`, capped at 10 entries, updated from the film detail screen.

Settings toggles (public profile, allow followers, private graphs, notification preferences) are persisted server-side via `/user/settings`, not locally.

## Known Gotchas

- **Apple Sign In is iOS-only.** The button is rendered inside `Platform.OS === 'ios'` on the landing screen. Android users only see Google and email options.
- **Google Sign In requires a dev client or standalone build.** `expo-auth-session` with the `cinemagraphsmobile` scheme and a native Apple Auth plugin both require a real EAS build; they won't work in the generic Expo Go client. `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` must be set at build time.
- **SecureStore is native-only.** It is not available on web, so the `web` target under the Expo config is not expected to support real auth; it exists mainly for Metro/debug.
- **New Architecture is on** (`newArchEnabled: true`). Any third-party module that isn't Fabric/TurboModule-compatible will crash. Keep this in mind when adding dependencies.
- **Session restore is best-effort.** If `/user/profile` returns 500 or the network fails, the user stays signed in via the cached `auth_user`. A 401/403/404 does sign them out.
- **Live reaction cooldown is enforced in two places.** The UI state and `src/lib/live-react.ts` (`canReact`) both check ~3s between reactions. CLAUDE.md specifies 2s; the code currently uses 3s — worth reconciling.
- **Hidden / disabled UI.**
  - `app/(tabs)/explore.tsx` renders a ticket-stub feature inside `{false && ...}` — **built but disabled.**
  - `app/(tabs)/profile.tsx` has partially hidden Watchlist UI — **built but disabled.**
- **Uncommitted dumps.** `mock-dump.txt` and `profile-dump.txt` sit untracked at the repo root; they appear to be scratch captures.
- **iOS predictive back gesture** is enabled by default in Expo Router stacks; Android explicitly disables it in `app.json` (`predictiveBackGestureEnabled: false`).
- **Avatar upload path bypasses `apiFetch`.** If `API_BASE` or the auth header shape ever changes, this call has to be updated in both places.
- **Runtime fonts.** `RootLayout` returns `null` until Playfair and DM Sans are loaded; the splash screen is held via `SplashScreen.preventAutoHideAsync()`.

## Security Follow-ups

### npm audit (snapshot 2026-04-27)

`npm audit` reports 22 vulnerabilities (21 moderate, 1 high). All are confirmed dev / build-time only and do not ship in the iOS or Android bundle. No action required now.

- **High: `@xmldom/xmldom@0.8.12`** under `@expo/cli` plist tooling. Four advisories: DoS via uncontrolled XML recursion, plus three XML-injection class issues. Reachable only during `expo prebuild` and EAS Build, never on user devices. Fixed by upgrading to Expo SDK 55+, which pulls the patched `0.8.13`.
- **Moderate (15): Expo SDK chain.** `expo`, `expo-asset`, `expo-auth-session`, `expo-constants`, `expo-linking`, `expo-router`, `expo-splash-screen`, plus the build-time tooling (`@expo/cli`, `@expo/config`, `@expo/config-plugins`, `@expo/metro-config`, `@expo/prebuild-config`, `xcode`, `uuid`, `postcss`). The vulnerable code in every case lives in build-time CLI / config tooling, not in the JS that ships to users. Cleared by the same Expo SDK 55+ upgrade.
- **Moderate (6): `react-native-image-colors` chain.** Vulns in `node-vibrant`, `@vibrant/image-node`, `@jimp/custom`, `@jimp/core`, `file-type`. These sit on the Node-only web fallback path; the package uses native iOS / Android implementations on device, so the vulnerable JS does not bundle into the app. Fixed by `react-native-image-colors@2.4.0` (semver-major). The codebase currently uses the hash-derived color fallback in `ArcCard` rather than calling `react-native-image-colors`, so this upgrade can wait until the image-colors path is re-enabled for EAS production builds.

All 22 should be re-evaluated after the next Expo SDK upgrade. No action needed in the meantime.
