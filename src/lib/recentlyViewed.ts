import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'recently_viewed';
export const MAX_RECENTLY_VIEWED = 20;

export interface RecentFilm {
  filmId: string;
  title: string;
  posterUrl: string | null;
  timestamp: number;
}

export async function getRecentlyViewed(): Promise<RecentFilm[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function addRecentlyViewed(
  filmId: string,
  title: string,
  posterUrl: string | null,
): Promise<void> {
  const list = await getRecentlyViewed();
  const filtered = list.filter((r) => r.filmId !== filmId);
  const next = [{ filmId, title, posterUrl, timestamp: Date.now() }, ...filtered].slice(0, MAX_RECENTLY_VIEWED);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
