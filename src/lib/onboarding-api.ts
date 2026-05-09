import { API_BASE_URL } from './api';

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

export type BannerSpec = {
  bannerType: 'BACKDROP' | 'GRADIENT';
  bannerValue: { filmId: string; backdropPath: string } | string;
  source: 'screen3' | 'genre' | 'era' | 'gradient-fallback' | 'error-fallback';
};

// POST to /api/onboarding/select-banner with the user's accumulated
// selections and return a banner spec the Reveal screen can render.
//
// On any failure (non-2xx, network error, JSON parse), this resolves to
// a local 'error-fallback' midnight gradient so the Reveal screen always
// gets a usable spec without needing its own try/catch. 'error-fallback'
// is a sentinel that the API never emits, so callers can distinguish a
// local-fallback from an API-decided 'gradient-fallback'.
export async function fetchSelectBanner(
  filmIds: string[],
  genres: string[],
  eras: string[],
): Promise<BannerSpec> {
  try {
    const res = await fetch(`${API_BASE_URL}/api/onboarding/select-banner`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filmIds, genres, eras }),
    });
    if (!res.ok) {
      throw new Error(`select-banner failed: ${res.status}`);
    }
    return res.json();
  } catch {
    return {
      bannerType: 'GRADIENT',
      bannerValue: 'midnight',
      source: 'error-fallback',
    };
  }
}
