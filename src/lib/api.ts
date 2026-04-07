import * as SecureStore from 'expo-secure-store';
import type { Film, FilmDetail } from '../types/film';

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

export async function fetchSimilarFilms(filmId: string, genre: string): Promise<Film[]> {
  // TODO: If the API doesn't support genre filtering, fall back to /films?limit=6
  return extractFilms(
    await apiFetch(`/films?genre=${encodeURIComponent(genre)}&limit=6&exclude=${filmId}`)
  );
}
