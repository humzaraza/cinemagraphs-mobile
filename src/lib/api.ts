import * as SecureStore from 'expo-secure-store';
import { TERMS_VERSION } from '../constants/legal';
import type {
  Film,
  FilmDataPoint,
  FilmDetail,
  HeroResponse,
  ReviewSubmission,
  ReviewsResponse,
} from '../types/film';

// Origin for the cinemagraphs.ca API. Override via EXPO_PUBLIC_API_BASE_URL
// at build time (e.g., to point at a staging environment). API_BASE composes
// the origin with the /api prefix used by every endpoint in this file.
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'https://cinemagraphs.ca';
const API_BASE = `${API_BASE_URL}/api`;

// ---------------------------------------------------------------------------
// Token pair storage
//
// Stored as a single JSON-encoded string under TOKENS_KEY for atomic writes.
// SecureStore writes are not transactional across keys; encoding both tokens
// in one value means a mid-write crash leaves either the full old pair or
// the full new pair, never a half-updated state.
// ---------------------------------------------------------------------------

const TOKENS_KEY = 'auth_tokens';

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export async function getTokens(): Promise<TokenPair | null> {
  const raw = await SecureStore.getItemAsync(TOKENS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<TokenPair>;
    if (
      typeof parsed.accessToken !== 'string' ||
      !parsed.accessToken ||
      typeof parsed.refreshToken !== 'string' ||
      !parsed.refreshToken
    ) {
      return null;
    }
    return { accessToken: parsed.accessToken, refreshToken: parsed.refreshToken };
  } catch {
    // Malformed JSON; treat as no stored tokens.
    return null;
  }
}

export async function setTokens(pair: TokenPair): Promise<void> {
  if (!pair.accessToken || typeof pair.accessToken !== 'string') {
    throw new Error('setTokens requires a non-empty accessToken string');
  }
  if (!pair.refreshToken || typeof pair.refreshToken !== 'string') {
    throw new Error('setTokens requires a non-empty refreshToken string');
  }
  await SecureStore.setItemAsync(TOKENS_KEY, JSON.stringify(pair));
}

export async function removeTokens(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKENS_KEY);
}

/**
 * Convenience: read just the access token without forcing callers to
 * destructure the pair. Returns null if no pair is stored.
 */
export async function getAccessToken(): Promise<string | null> {
  const pair = await getTokens();
  return pair?.accessToken ?? null;
}

/**
 * Convenience: read just the refresh token. Used by the refresh flow
 * and by signOut for server-side family revocation.
 */
export async function getRefreshToken(): Promise<string | null> {
  const pair = await getTokens();
  return pair?.refreshToken ?? null;
}

/**
 * One-shot cleanup of the legacy 'auth_token' key from pre-PR-3b builds.
 * Called from AuthProvider on mount. Idempotent: a no-op for fresh
 * installs and for users who already cleaned up.
 */
export async function cleanupLegacyTokenKey(): Promise<void> {
  await SecureStore.deleteItemAsync('auth_token');
}

// ---------------------------------------------------------------------------
// Refresh flow (added in PR 3b Chunk B3)
//
// refreshPromise serializes concurrent refresh attempts. When multiple
// requests hit 401 at the same time, all of them share one POST to
// /api/auth/mobile/refresh instead of stampeding the endpoint.
// ---------------------------------------------------------------------------

let refreshPromise: Promise<TokenPair | null> | null = null;

async function refreshTokensViaApi(): Promise<TokenPair | null> {
  if (refreshPromise) {
    return refreshPromise;
  }

  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) return null;

      const res = await fetch(`${API_BASE}/auth/mobile/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      if (!res.ok) return null;

      const data = await res.json();
      if (
        typeof data?.accessToken !== 'string' ||
        !data.accessToken ||
        typeof data?.refreshToken !== 'string' ||
        !data.refreshToken
      ) {
        return null;
      }

      const newPair: TokenPair = {
        accessToken: data.accessToken,
        refreshToken: data.refreshToken,
      };
      await setTokens(newPair);
      return newPair;
    } catch {
      return null;
    } finally {
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}

type SignOutHandler = () => void | Promise<void>;
let onAuthFailure: SignOutHandler | null = null;

export function setOnAuthFailure(handler: SignOutHandler | null): void {
  onAuthFailure = handler;
}

/**
 * Fire-and-forget server-side family revocation. Returns immediately;
 * the network call runs in the background with a 2-second abort timeout.
 *
 * Used by AuthProvider.signOut. Does NOT throw on network failure.
 * Worst case: server keeps the family alive until the refresh token
 * expires naturally (30 days) or the family is invalidated by replay.
 */
export function requestServerLogout(refreshToken: string): void {
  if (!refreshToken) return;

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);

  fetch(`${API_BASE}/auth/mobile/logout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
    signal: controller.signal,
  })
    .catch(() => {
      // Swallow: network errors, timeouts, server 500s. Local cleanup
      // already happened; this call was best-effort.
    })
    .finally(() => {
      clearTimeout(timeoutId);
    });
}

async function attachAuthAndFetch(
  url: string,
  options: RequestInit,
  accessToken: string | null,
): Promise<Response> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };
  if (accessToken) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${accessToken}`;
  }
  if (__DEV__) {
    console.log('[API]', options.method ?? 'GET', url);
  }
  return fetch(url, { ...options, headers });
}

export async function apiFetch(
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const url = `${API_BASE}${path}`;

  // Snapshot the access token from before the first attempt. If the
  // first attempt comes back 401 and we DID send a token, that means
  // the token was rejected and we should try to refresh. If we did NOT
  // send a token, the 401 just means the endpoint requires auth and
  // we don't have any. Skip the refresh attempt.
  const initialToken = await getAccessToken();
  const firstRes = await attachAuthAndFetch(url, options, initialToken);

  if (firstRes.status !== 401 || !initialToken) {
    return firstRes;
  }

  // Try to refresh and retry once.
  const newPair = await refreshTokensViaApi();
  if (!newPair) {
    // Refresh failed. Trigger auto-signout, return the original 401 so
    // the caller can handle the response shape they expected.
    if (onAuthFailure) {
      try {
        await onAuthFailure();
      } catch {
        // Don't let signout errors bubble into apiFetch's contract.
      }
    }
    return firstRes;
  }

  // Refresh succeeded. Retry the original request once with the new
  // access token. Return whatever this attempt produces, even if also
  // 401 (don't re-refresh; that path means something deeper is wrong).
  return attachAuthAndFetch(url, options, newPair.accessToken);
}

async function extractFilms(res: Response): Promise<Film[]> {
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.films ?? [];
}

export async function fetchTickerFilms(): Promise<Film[]> {
  return extractFilms(await apiFetch('/films?ticker=true&limit=20'));
}

export async function fetchNowPlayingFilms(): Promise<Film[]> {
  return extractFilms(await apiFetch('/films?nowPlaying=true&limit=10'));
}

// Live recommendation engine (replaces the sort=recent placeholder).
// GET /api/recommendations returns { films } where each film carries a
// flat `score` instead of the nested sentimentGraph the /films listings
// use, so remap it onto sentimentGraph.overallScore for the poster
// cards. The server excludes unscored films, but a null score maps to
// a null graph rather than crashing. Same silent-degrade convention as
// the other Explore rows: [] on any failure.
export async function fetchRecommendations(): Promise<Film[]> {
  try {
    const raw = (await extractFilms(await apiFetch('/recommendations'))) as (Film & {
      score?: number | null;
    })[];
    return raw.map(({ score, ...film }) => ({
      ...film,
      sentimentGraph:
        score != null
          ? { overallScore: score, dataPoints: [], biggestSwing: null }
          : null,
    }));
  } catch {
    return [];
  }
}

// arcShape values contain spaces; keep them URL-encoded inline.
export async function fetchHiddenPeakFilms(): Promise<Film[]> {
  return extractFilms(await apiFetch('/films?arcShape=hidden%20peak&limit=10'));
}

export async function fetchSlowBurnFilms(): Promise<Film[]> {
  return extractFilms(await apiFetch('/films?arcShape=slow%20burn&limit=10'));
}

// Daily hero pick (backend PR #55). Public, no params; the server owns
// the angle-to-day mapping and the eligibility/no-repeat rules. Returns
// null on any failure so the Explore screen can collapse the hero
// section instead of showing an error card.
export async function fetchHero(): Promise<HeroResponse | null> {
  try {
    const res = await apiFetch('/hero');
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.film || !data?.angle?.label) return null;
    return data as HeroResponse;
  } catch {
    return null;
  }
}

export async function fetchFilmDetail(id: string): Promise<FilmDetail | null> {
  const res = await apiFetch(`/films/${id}`);
  if (!res.ok) return null;
  return res.json();
}

// Search films by text query. Hits the FTS endpoint shipped in web
// PR #26. Supports AbortSignal for cancellation when the user keeps
// typing. Returns at most 20 films, ranked by relevance.
export async function searchFilms(
  query: string,
  signal?: AbortSignal,
): Promise<Film[]> {
  if (!query.trim()) return [];
  const res = await apiFetch(
    `/films/search?q=${encodeURIComponent(query.trim())}`,
    { signal },
  );
  if (!res.ok) return [];
  const data = await res.json();
  return (data?.films ?? []) as Film[];
}

// Banner picker (PR 1b) film listing. Hits /api/films with the popular
// sort + hasBackdrop filter shipped in web PR #28. Default browse and
// search both go through here; the only difference is whether `q` is
// passed. `limit` defaults to 12 to match the picker's two-row 3-column
// grid in the default browse state.
export async function fetchBackdropFilms(
  options: { q?: string; limit?: number; signal?: AbortSignal } = {},
): Promise<Film[]> {
  const { q, limit = 12, signal } = options;
  const params = new URLSearchParams({
    sort: 'popular',
    hasBackdrop: 'true',
    limit: String(limit),
  });
  const trimmed = q?.trim();
  if (trimmed) params.set('q', trimmed);
  const res = await apiFetch(`/films?${params.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`Failed to load films (${res.status})`);
  }
  const data = await res.json();
  return (Array.isArray(data) ? data : data?.films ?? []) as Film[];
}

// Fetch a paginated category. Used by the category browse screen.
// Maps category labels to /api/films query params.
//
// genre filter: ?genre=Drama
// sort filter: ?sort=highest | ?sort=swing | ?sort=recent
//
// hasMore is true when the page returned exactly `limit` items
// (means there's likely another page).
export type CategoryFetchResult = { films: Film[]; hasMore: boolean };

export async function fetchCategoryFilms(
  params: { genre?: string; sort?: 'highest' | 'swing' | 'recent' },
  page: number,
  signal?: AbortSignal,
): Promise<CategoryFetchResult> {
  const limit = 20;
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (params.genre) qs.set('genre', params.genre);
  if (params.sort) qs.set('sort', params.sort);
  const res = await apiFetch(`/films?${qs.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`Failed to load category films (${res.status})`);
  }
  const data = await res.json();
  const films = (data?.films ?? (Array.isArray(data) ? data : [])) as Film[];
  return { films, hasMore: films.length === limit };
}

// Paginated fetch for the Explore "See all" section screens. Accepts the
// same /api/films filters the Explore rows use (arcShape, nowPlaying,
// sort=recent). Same hasMore heuristic as fetchCategoryFilms: a full
// page means there's likely another one.
export interface SectionFilter {
  arcShape?: string;
  nowPlaying?: boolean;
  sort?: 'highest' | 'swing' | 'recent';
}

export async function fetchSectionFilms(
  filter: SectionFilter,
  page: number,
  signal?: AbortSignal,
): Promise<CategoryFetchResult> {
  const limit = 21; // multiple of 3 so full pages end on a complete grid row
  const qs = new URLSearchParams({ page: String(page), limit: String(limit) });
  if (filter.arcShape) qs.set('arcShape', filter.arcShape);
  if (filter.nowPlaying) qs.set('nowPlaying', 'true');
  if (filter.sort) qs.set('sort', filter.sort);
  const res = await apiFetch(`/films?${qs.toString()}`, { signal });
  if (!res.ok) {
    throw new Error(`Failed to load section films (${res.status})`);
  }
  const data = await res.json();
  const films = (data?.films ?? (Array.isArray(data) ? data : [])) as Film[];
  return { films, hasMore: films.length === limit };
}

/**
 * Fetch the review list for a film, plus the current user's own review
 * (if any) as a separate field. When `excludeCurrentUser` is true the
 * server filters the user's own review out of the `reviews` array and
 * total count so the client can render it separately in the "Your
 * review" section without de-duplication.
 *
 * Returns null on non-2xx so callers can render an empty state.
 */
export async function fetchFilmReviews(
  filmId: string,
  options: { excludeCurrentUser?: boolean } = {},
): Promise<ReviewsResponse | null> {
  const params = new URLSearchParams();
  if (options.excludeCurrentUser) {
    params.set('excludeCurrentUser', 'true');
  }
  const qs = params.toString();
  const path = `/films/${filmId}/reviews${qs ? `?${qs}` : ''}`;
  const res = await apiFetch(path);
  if (!res.ok) return null;
  return res.json();
}

export async function submitReview(filmId: string, data: ReviewSubmission): Promise<any> {
  const res = await apiFetch(`/films/${filmId}/reviews`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to submit review');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Review detail (replies & likes)
// ---------------------------------------------------------------------------

// Author / commenter identity as selected by the review-detail and replies
// endpoints. name is nullable; the web renders "Anonymous" for it.
export interface ReviewDetailUser {
  id: string;
  name: string | null;
  image: string | null;
}

export interface ReviewDetailFilm {
  id: string;
  title: string;
  posterUrl: string | null;
  releaseDate: string | null;
  director: string | null;
  runtime: number | null;
  sentimentGraph: { dataPoints: FilmDataPoint[] } | null;
}

export interface ReviewLikes {
  count: number;
  liked: boolean;
}

// GET /api/reviews/[id]. Review fields sit flat at the top level; user,
// film (with sentimentGraph.dataPoints), likes and replyCount are nested.
// `liked` is per-viewer (false when unauthenticated).
export interface ReviewDetail {
  id: string;
  filmId: string;
  overallRating: number;
  beginning: string | null;
  middle: string | null;
  ending: string | null;
  otherThoughts: string | null;
  combinedText: string | null;
  beatRatings: Record<string, number> | null;
  createdAt: string;
  updatedAt: string;
  user: ReviewDetailUser;
  film: ReviewDetailFilm;
  likes: ReviewLikes;
  replyCount: number;
}

export interface ReviewReply {
  id: string;
  body: string;
  createdAt: string;
  parentReplyId: string | null;
  user: ReviewDetailUser;
}

// Top-level comment with its single level of children, as pre-grouped by
// GET /api/reviews/[id]/replies. The server enforces the one-level depth
// rule, so children never carry children of their own.
export interface ReviewComment extends ReviewReply {
  children: ReviewReply[];
}

export interface ReviewRepliesResponse {
  comments: ReviewComment[];
  total: number;
}

export async function fetchReviewDetail(
  reviewId: string,
): Promise<ReviewDetail | null> {
  const res = await apiFetch(`/reviews/${reviewId}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchReviewReplies(
  reviewId: string,
): Promise<ReviewRepliesResponse | null> {
  const res = await apiFetch(`/reviews/${reviewId}/replies`);
  if (!res.ok) return null;
  return res.json();
}

export async function postReply(
  reviewId: string,
  body: string,
  parentReplyId?: string,
): Promise<ReviewReply> {
  const res = await apiFetch(`/reviews/${reviewId}/replies`, {
    method: 'POST',
    body: JSON.stringify(parentReplyId ? { body, parentReplyId } : { body }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to post comment');
  }
  return res.json();
}

export async function deleteReply(replyId: string): Promise<void> {
  const res = await apiFetch(`/reviews/replies/${replyId}`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete comment');
  }
}

export async function likeReview(reviewId: string): Promise<ReviewLikes> {
  const res = await apiFetch(`/reviews/${reviewId}/like`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to like review');
  }
  return res.json();
}

export async function unlikeReview(reviewId: string): Promise<ReviewLikes> {
  const res = await apiFetch(`/reviews/${reviewId}/like`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to unlike review');
  }
  return res.json();
}

export interface AudienceData {
  userReviewCount: number;
  beatAverages: Record<string, number>;
}

export async function fetchAudienceData(
  filmId: string,
): Promise<AudienceData | null> {
  try {
    const res = await apiFetch(`/films/${filmId}/audience-data`);
    if (!res.ok) return null;
    const data = await res.json();
    if (!data?.beatAverages || typeof data.beatAverages !== 'object') return null;
    const map: Record<string, number> = data.beatAverages;
    if (Object.keys(map).length === 0) return null;
    return {
      userReviewCount: data.userReviewCount ?? 0,
      beatAverages: map,
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Live Reactions
// ---------------------------------------------------------------------------

export async function createReactionSession(filmId: string, abandonPrevious?: boolean) {
  const res = await apiFetch(`/films/${filmId}/reaction-sessions`, {
    method: 'POST',
    body: JSON.stringify({ abandonPrevious }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to create session');
  }
  return res.json();
}

export async function getIncompleteSession(filmId: string) {
  const res = await apiFetch(`/films/${filmId}/reaction-sessions`);
  if (!res.ok) return null;
  return res.json();
}

export async function postReaction(filmId: string, data: {
  reaction: string;
  sessionTimestamp: number;
  currentScore: number;
  sessionId: string;
}) {
  const res = await apiFetch(`/films/${filmId}/reactions`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to post reaction');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Auth
// ---------------------------------------------------------------------------

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

export async function loginWithEmail(email: string, password: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/mobile/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Sign in failed');
  }
  return res.json();
}

export async function registerWithEmail(email: string, password: string, name: string): Promise<any> {
  const res = await fetch(`${API_BASE}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, name, termsAccepted: true, termsVersion: TERMS_VERSION }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Registration failed');
  }
  return res.json();
}

export async function verifyOTP(email: string, code: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/verify-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, code, mobile: true }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Verification failed');
  }
  return res.json();
}

export async function resendOTP(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/resend-otp`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not resend code');
  }
}

export async function forgotPassword(email: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/forgot-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not send reset link');
  }
}

export async function resetPassword(token: string, password: string): Promise<void> {
  const res = await fetch(`${API_BASE}/auth/reset-password`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token, password }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Could not reset password');
  }
}

export async function loginWithGoogle(idToken: string): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/mobile/google`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ idToken, termsAccepted: true, termsVersion: TERMS_VERSION }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Google sign in failed');
  }
  return res.json();
}

export async function loginWithApple(identityToken: string, fullName?: string | null): Promise<AuthResponse> {
  const res = await fetch(`${API_BASE}/auth/mobile/apple`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identityToken, fullName, termsAccepted: true, termsVersion: TERMS_VERSION }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Apple sign in failed');
  }
  return res.json();
}

// ---------------------------------------------------------------------------
// Profile (real API calls)
// ---------------------------------------------------------------------------

export type BannerType = 'GRADIENT' | 'PHOTO' | 'BACKDROP';

// A review-derived favorite as hydrated by the profile payload. Mirrors
// UserProfileRecentReview's sparklinePoints (the per-user arc overlay).
// Shape matches the FavoriteFilm type FavoriteSlot renders, so the
// profile screen can pass these through without remapping.
export interface UserProfileFavoriteFilm {
  id: string;
  title: string;
  year: number | null;
  posterUrl: string | null;
  sparklinePoints: number[];
}

export interface UserProfileUser {
  id: string;
  name: string | null;
  username: string | null;
  bio: string | null;
  image: string | null;
  bannerType: BannerType;
  bannerValue: string;
  // Ordered, max 4. May contain the same film more than once: a film can
  // occupy multiple slots, so this is not a deduped set.
  favoriteFilms: UserProfileFavoriteFilm[];
}

export interface UserProfileStats {
  reviewCount: number;
  followingCount: number;
  followerCount: number;
}

export interface UserProfileRecentReview {
  filmId: string;
  title: string;
  year: number | null;
  director: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  score: number;
  sparklinePoints: number[];
}

export interface UserProfileListPreview {
  id: string;
  name: string;
  filmCount: number;
  mosaicPosters: string[];
}

export interface UserProfile {
  user: UserProfileUser;
  stats: UserProfileStats;
  recentReviews: UserProfileRecentReview[];
  lists: UserProfileListPreview[];
}

export async function fetchUserProfile(): Promise<UserProfile | null> {
  const res = await apiFetch('/user/profile');
  if (!res.ok) {
    if (__DEV__) {
      console.error('[API] fetchUserProfile failed:', res.status);
    }
    return null;
  }
  return res.json();
}

// Replace the caller's favorite films with the given ordered list and
// return the rebuilt profile payload. The list is sent verbatim: order is
// preserved and duplicates are allowed (the same film may appear in more
// than one slot). The server caps the list at 4 and rejects films the
// caller has not reviewed, but the UI never sends an invalid list, so
// those guards are not expected to fire from the app.
export async function updateFavorites(filmIds: string[]): Promise<UserProfile> {
  const res = await apiFetch('/user/favorites', {
    method: 'PATCH',
    body: JSON.stringify({ favoriteFilms: filmIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update favorites');
  }
  return res.json();
}

// PR 1c (mobile companion to web PR #29) widened the BACKDROP banner
// shape: bannerValue can now be a structured { filmId, backdropPath }
// object instead of a plain filmId string. The server accepts both
// forms (legacy string + new object) and stringifies the object on
// persist, so this wrapper just forwards whatever shape the caller
// passes. The outer JSON.stringify on the request body serialises the
// nested object correctly. GRADIENT and PHOTO continue to use string
// bannerValue (preset key, blob pathname).
export type BannerValue =
  | string
  | { filmId: string; backdropPath: string | null };

export async function updateUserBanner(
  bannerType: BannerType,
  bannerValue: BannerValue,
): Promise<void> {
  const res = await apiFetch('/user/banner', {
    method: 'PATCH',
    body: JSON.stringify({ bannerType, bannerValue }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update banner');
  }
}

// TMDB backdrop record returned by GET /api/films/<id>/backdrops (web
// PR #29). Server filters out low-quality / text-overlay backdrops and
// sorts by vote_count DESC before returning, so mobile renders the
// array as-is.
export interface Backdrop {
  file_path: string;
  width: number;
  height: number;
  vote_count: number;
  vote_average: number;
}

export async function getBackdrops(filmId: string): Promise<Backdrop[]> {
  const res = await apiFetch(`/films/${encodeURIComponent(filmId)}/backdrops`);
  if (!res.ok) {
    throw new Error(`Failed to load backdrops (${res.status})`);
  }
  const data = await res.json();
  // Server may return { backdrops: [...] } or a bare array; tolerate both.
  const list = Array.isArray(data) ? data : (data?.backdrops ?? []);
  return list as Backdrop[];
}

// One of the caller's own reviewed films, as returned by
// GET /user/films?type=reviewed. The favorite picker only needs id /
// title / poster / year to render its grid; `sparkline` is the canonical
// graph's data points (not the per-user overlay) and is carried for
// parity with the endpoint, not currently rendered in the picker.
export interface UserReviewedFilm {
  id: string;
  title: string;
  posterUrl: string | null;
  year: number | null;
  sparkline: { score: number; label?: string }[] | null;
}

export async function fetchUserFilms(type?: string): Promise<any[]> {
  const q = type ? `?type=${type}` : '';
  const res = await apiFetch(`/user/films${q}`);
  if (!res.ok) return [];
  const data = await res.json();
  const films = Array.isArray(data) ? data : data.films ?? [];
  if (__DEV__) {
    console.log(`[API] fetchUserFilms(${type}) returned ${films.length} films, sample keys:`, films[0] ? Object.keys(films[0]) : 'empty');
  }
  return films;
}

export async function fetchUserWatchlist(): Promise<Film[]> {
  return extractFilms(await apiFetch('/user/watchlist'));
}

export async function addToWatchlist(filmId: string): Promise<void> {
  const res = await apiFetch('/user/watchlist', {
    method: 'POST',
    body: JSON.stringify({ filmId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add to watchlist');
  }
}

export async function removeFromWatchlist(filmId: string): Promise<void> {
  const res = await apiFetch('/user/watchlist', {
    method: 'DELETE',
    body: JSON.stringify({ filmId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to remove from watchlist');
  }
}

export async function fetchUserLists(): Promise<any[]> {
  const res = await apiFetch('/user/lists');
  if (!res.ok) {
    console.error('[API] fetchUserLists failed:', res.status);
    return [];
  }
  const data = await res.json();
  const lists = Array.isArray(data) ? data : data.lists ?? [];
  if (__DEV__) {
    console.log('[API] fetchUserLists returned', lists.length, 'lists, first:', JSON.stringify(lists[0])?.slice(0, 200));
  }
  return lists;
}

export async function fetchUserList(listId: string): Promise<any> {
  const res = await apiFetch('/user/lists/' + listId);
  if (!res.ok) return null;
  const data = await res.json();
  return data.list ?? data;
}

export async function createUserList(name: string, genreTag: string, filmIds: string[], isPublic?: boolean): Promise<any> {
  if (__DEV__) {
    console.log('[API] createUserList called with:', { name, genreTag, filmIds, isPublic });
  }
  const res = await apiFetch('/user/lists', {
    method: 'POST',
    body: JSON.stringify({ name, genreTag, filmIds, ...(isPublic !== undefined && { isPublic }) }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[API] createUserList failed:', res.status, err);
    throw new Error(err.error || 'Failed to create list');
  }
  const data = await res.json();
  if (__DEV__) {
    console.log('[API] createUserList response:', JSON.stringify(data).slice(0, 300));
  }
  return data;
}

export async function addFilmToListAPI(listId: string, filmId: string): Promise<any> {
  const res = await apiFetch(`/user/lists/${listId}/films`, {
    method: 'POST',
    body: JSON.stringify({ filmId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to add film');
  }
  return res.json();
}

export async function removeFilmFromListAPI(listId: string, filmId: string): Promise<void> {
  await apiFetch(`/user/lists/${listId}/films`, {
    method: 'DELETE',
    body: JSON.stringify({ filmId }),
  });
}

export async function deleteUserList(listId: string): Promise<void> {
  await apiFetch(`/user/lists/${listId}`, { method: 'DELETE' });
}

export async function fetchPublicList(listId: string): Promise<any> {
  const res = await apiFetch(`/lists/${listId}`);
  if (!res.ok) return null;
  const data = await res.json();
  return data.list ?? data;
}

export async function updateListVisibility(listId: string, isPublic: boolean): Promise<void> {
  const res = await apiFetch(`/user/lists/${listId}`, {
    method: 'PATCH',
    body: JSON.stringify({ isPublic }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to update list visibility');
  }
}

export async function fetchUserSettings(): Promise<any> {
  const res = await apiFetch('/user/settings');
  if (!res.ok) return null;
  return res.json();
}

export async function updateUserSettings(settings: Record<string, any>): Promise<void> {
  await apiFetch('/user/settings', {
    method: 'PUT',
    body: JSON.stringify(settings),
  });
}

export async function updateUserProfile(data: { name?: string; username?: string; bio?: string }): Promise<any> {
  const res = await apiFetch('/user/profile', {
    method: 'PATCH',
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error: any = new Error(err.error || 'Failed to update profile');
    error.status = res.status;
    throw error;
  }
  return res.json();
}

export async function uploadAvatar(uri: string): Promise<{ url: string }> {
  const token = await getAccessToken();
  const ext = uri.split('.').pop()?.toLowerCase() ?? 'jpg';
  const mimeType = ext === 'png' ? 'image/png' : 'image/jpeg';
  const fileName = ext === 'png' ? 'avatar.png' : 'avatar.jpg';

  const formData = new FormData();
  formData.append('file', {
    uri,
    type: mimeType,
    name: fileName,
  } as any);

  const res = await fetch(`${API_BASE}/user/avatar`, {
    method: 'POST',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to upload avatar');
  }
  return res.json();
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await apiFetch('/auth/change-password', {
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    const error: any = new Error(err.error || 'Failed to change password');
    error.status = res.status;
    throw error;
  }
}

// Permanently delete the authenticated user. Server cascade-removes the
// user row plus all owned content (reviews, lists, watchlist, follows,
// banner/avatar blobs) and invalidates the refresh-token family, so
// callers don't need to fire requestServerLogout afterwards. Local
// token + cached-user cleanup is the caller's responsibility.
export async function deleteAccount(): Promise<void> {
  const res = await apiFetch('/user', { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to delete account');
  }
}

// ---------------------------------------------------------------------------
// User search & social
// ---------------------------------------------------------------------------

export async function searchUsers(query: string, page?: number): Promise<any> {
  const params = new URLSearchParams({ q: query });
  if (page) params.set('page', String(page));
  const res = await apiFetch(`/users/search?${params}`);
  if (!res.ok) return { users: [], total: 0, page: 1, totalPages: 0 };
  return res.json();
}

export async function fetchPublicProfile(userId: string): Promise<any> {
  const res = await apiFetch(`/users/${userId}`);
  if (!res.ok) {
    if (res.status === 404) return null;
    throw new Error('Failed to load profile');
  }
  return res.json();
}

export async function followUser(userId: string): Promise<void> {
  const res = await apiFetch(`/users/${userId}/follow`, { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to follow user');
  }
}

export async function unfollowUser(userId: string): Promise<void> {
  const res = await apiFetch(`/users/${userId}/follow`, { method: 'DELETE' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to unfollow user');
  }
}

export async function fetchFollowers(userId: string, page?: number): Promise<any> {
  const params = page ? `?page=${page}` : '';
  const res = await apiFetch(`/users/${userId}/followers${params}`);
  if (!res.ok) return { users: [], total: 0, page: 1, totalPages: 0 };
  return res.json();
}

export async function fetchFollowing(userId: string, page?: number): Promise<any> {
  const params = page ? `?page=${page}` : '';
  const res = await apiFetch(`/users/${userId}/following${params}`);
  if (!res.ok) return { users: [], total: 0, page: 1, totalPages: 0 };
  return res.json();
}

// ---------------------------------------------------------------------------
// Activity feed
// ---------------------------------------------------------------------------

export type ActivityTab = 'friends' | 'incoming';

export interface FeedActor {
  id: string;
  name: string | null;
  image: string | null;
}

export interface FeedFilm {
  id: string;
  title: string;
  posterUrl: string | null;
}

export interface FeedList {
  id: string;
  name: string;
}

// One activity row as shaped by GET /api/activity. The friends tab carries
// review / follow / watchlist / list_add; incoming carries follow / like /
// reply / reply_to_comment. Referent fields are per-type: review-linked
// types carry review + film, list_add carries film + list, friends-tab
// follow carries targetUser (incoming follow targets the viewer, so it is
// null there), and reply types carry reply with a server-truncated body.
export interface FeedItem {
  id: string;
  type: 'review' | 'follow' | 'watchlist' | 'list_add' | 'like' | 'reply' | 'reply_to_comment';
  createdAt: string;
  actor: FeedActor;
  targetUser: FeedActor | null;
  film: FeedFilm | null;
  review: { id: string } | null;
  list: FeedList | null;
  reply: { id: string; body: string } | null;
}

export interface ActivityFeedPage {
  items: FeedItem[];
  page: number;
  hasMore: boolean;
}

// The server over-fetches to backfill dropped referents, so consecutive
// pages can overlap; callers must dedupe appended pages by item.id.
export async function fetchActivityFeed(
  tab: ActivityTab,
  page: number,
  signal?: AbortSignal,
): Promise<ActivityFeedPage | null> {
  try {
    const res = await apiFetch(`/activity?tab=${tab}&page=${page}`, { signal });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data?.items)) return null;
    return {
      items: data.items as FeedItem[],
      page: data.page ?? page,
      hasMore: !!data.hasMore,
    };
  } catch {
    return null;
  }
}

// Whether the viewer has unread Incoming activity. Server guarantees the
// flag only counts rows the Incoming tab would actually render.
export async function fetchUnreadActivity(): Promise<boolean | null> {
  try {
    const res = await apiFetch('/activity/unread');
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data?.unread === 'boolean' ? data.unread : null;
  } catch {
    return null;
  }
}

export async function markActivitySeen(): Promise<void> {
  const res = await apiFetch('/activity/seen', { method: 'POST' });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to mark activity seen');
  }
}
