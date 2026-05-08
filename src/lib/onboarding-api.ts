import { API_BASE_URL } from './api-config';

export type Screen3Film = {
  id: string;
  tmdbId: number;
  title: string;
  year: number;
  posterPath: string | null;
};

export type Screen3Fallback = 'exact' | 'adjacent' | 'genre-dropped' | 'top-global';

export type Screen3Response = {
  films: Screen3Film[];
  fallback: Screen3Fallback;
};

export async function fetchScreen3Candidates(
  eras: string[],
  genres: string[],
): Promise<Screen3Response> {
  const res = await fetch(`${API_BASE_URL}/api/onboarding/screen3-candidates`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ eras, genres }),
  });
  if (!res.ok) {
    throw new Error(`Screen3 candidates fetch failed: ${res.status}`);
  }
  return res.json();
}
