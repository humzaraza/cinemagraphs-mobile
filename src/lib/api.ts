import * as SecureStore from 'expo-secure-store';
import { Film, FilmDetail } from '../types/film';

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

export async function fetchFilmDetail(id: string): Promise<FilmDetail> {
  const res = await apiFetch(`/films/${id}`);
  if (!res.ok) {
    throw new Error(`Failed to fetch film detail: ${res.status}`);
  }
  return res.json();
}

// TODO: If the web app API does not support genre filtering, remove the genre/exclude params
export async function fetchSimilarFilms(filmId: string, genre: string): Promise<Film[]> {
  const res = await apiFetch(`/films?genre=${encodeURIComponent(genre)}&limit=6&exclude=${filmId}`);
  if (!res.ok) {
    // Fall back to fetching without genre filter
    const fallback = await apiFetch('/films?limit=6');
    if (!fallback.ok) {
      throw new Error(`Failed to fetch similar films: ${fallback.status}`);
    }
    return fallback.json();
  }
  return res.json();
}
