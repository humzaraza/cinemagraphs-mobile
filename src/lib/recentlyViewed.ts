import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'recently_viewed';
const MAX = 20;

export interface RecentFilm {
  filmId: string;
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

export async function addRecentlyViewed(filmId: string): Promise<void> {
  const list = await getRecentlyViewed();
  const filtered = list.filter((r) => r.filmId !== filmId);
  const next = [{ filmId, timestamp: Date.now() }, ...filtered].slice(0, MAX);
  await AsyncStorage.setItem(KEY, JSON.stringify(next));
}
