import * as SecureStore from 'expo-secure-store';
import type { Film, FilmDetail, ReviewSubmission } from '../types/film';

const API_BASE = 'https://cinemagraphs.ca/api';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('auth_token');
}

export async function setToken(token: string): Promise<void> {
  if (typeof token !== 'string' || !token) {
    throw new Error('setToken requires a non-empty string');
  }
  await SecureStore.setItemAsync('auth_token', token);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync('auth_token');
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken();

  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;
  console.log('[API]', options.method ?? 'GET', url);
  return fetch(url, {
    ...options,
    headers,
  });
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

export async function fetchTrendingFilms(): Promise<Film[]> {
  return extractFilms(await apiFetch('/films?sort=highest&limit=6'));
}

export async function fetchRecommendedFilms(): Promise<Film[]> {
  return extractFilms(await apiFetch('/films?sort=recent&limit=10'));
}

export async function fetchFilmDetail(id: string): Promise<FilmDetail | null> {
  const res = await apiFetch(`/films/${id}`);
  if (!res.ok) return null;
  return res.json();
}

export async function fetchAllFilms(): Promise<Film[]> {
  const all: Film[] = [];
  let page = 1;
  while (true) {
    const batch = await extractFilms(await apiFetch(`/films?limit=50&page=${page}`));
    all.push(...batch);
    if (batch.length < 50) break;
    page++;
  }
  return all;
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

export async function fetchSimilarFilms(filmId: string, genre: string): Promise<Film[]> {
  // TODO: If the API doesn't support genre filtering, fall back to /films?limit=6
  return extractFilms(
    await apiFetch(`/films?genre=${encodeURIComponent(genre)}&limit=6&exclude=${filmId}`)
  );
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
  token: string;
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
    body: JSON.stringify({ email, password, name }),
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
    body: JSON.stringify({ idToken }),
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
    body: JSON.stringify({ identityToken, fullName }),
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

export async function fetchUserProfile(): Promise<any> {
  const token = await getToken();
  const res = await apiFetch('/user/profile');
  if (!res.ok) {
    console.error('[API] fetchUserProfile failed:', res.status, 'token:', token?.slice(0, 20) ?? 'null');
    return null;
  }
  return res.json();
}

export async function fetchUserFilms(type?: string): Promise<any[]> {
  const q = type ? `?type=${type}` : '';
  const res = await apiFetch(`/user/films${q}`);
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.films ?? [];
}

export async function fetchUserWatchlist(): Promise<any[]> {
  const res = await apiFetch('/user/watchlist');
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.films ?? [];
}

export async function fetchUserLists(): Promise<any[]> {
  const res = await apiFetch('/user/lists');
  if (!res.ok) return [];
  const data = await res.json();
  return Array.isArray(data) ? data : data.lists ?? [];
}

export async function createUserList(name: string, genreTag: string, filmIds: string[]): Promise<any> {
  const res = await apiFetch('/user/lists', {
    method: 'POST',
    body: JSON.stringify({ name, genreTag, filmIds }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    console.error('[API] createUserList failed:', res.status, err);
    throw new Error(err.error || 'Failed to create list');
  }
  return res.json();
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
