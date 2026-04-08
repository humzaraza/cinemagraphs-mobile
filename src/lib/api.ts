import * as SecureStore from 'expo-secure-store';
import type { Film, FilmDetail, ReviewSubmission } from '../types/film';

const API_BASE = 'https://cinemagraphs.ca/api';

export async function getToken(): Promise<string | null> {
  return SecureStore.getItemAsync('auth_token');
}

export async function setToken(token: string): Promise<void> {
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

  return fetch(`${API_BASE}${path}`, {
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
// Profile placeholders (return mock data until auth is wired in Prompt 9)
// ---------------------------------------------------------------------------

import {
  mockUser,
  mockFilms,
  mockWatchlist,
  mockLists,
  type MockUser,
  type MockFilm,
  type MockWatchlistFilm,
  type MockList,
} from '../data/mockProfile';

// TODO: Replace with GET /api/user/[id] after auth (Prompt 9)
export async function fetchUserProfile(): Promise<MockUser> {
  return mockUser;
}

// TODO: Replace with GET /api/user/[id]/films after auth (Prompt 9)
export async function fetchUserFilms(): Promise<MockFilm[]> {
  return mockFilms;
}

// TODO: Replace with GET /api/user/[id]/watchlist after auth (Prompt 9)
export async function fetchUserWatchlist(): Promise<MockWatchlistFilm[]> {
  return mockWatchlist;
}

// TODO: Replace with GET /api/user/[id]/lists after auth (Prompt 9)
export async function fetchUserLists(): Promise<MockList[]> {
  return mockLists;
}
