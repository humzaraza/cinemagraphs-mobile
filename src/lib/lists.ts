import type { MockList } from '../data/mockProfile';

const MAX_NAME_LENGTH = 40;
const MAX_FILMS_PER_LIST = 50;

export function validateListName(
  name: string,
  existingLists: MockList[]
): string | null {
  const trimmed = name.trim();
  if (trimmed.length === 0) return 'Name is required';
  if (trimmed.length > MAX_NAME_LENGTH)
    return `Name must be ${MAX_NAME_LENGTH} characters or fewer`;
  if (existingLists.some((l) => l.name.toLowerCase() === trimmed.toLowerCase()))
    return 'A list with this name already exists';
  return null;
}

export function createList(
  name: string,
  genreTag: string,
  filmIds: string[],
  existingLists: MockList[]
): MockList {
  const error = validateListName(name, existingLists);
  if (error) throw new Error(error);
  return {
    id: `list-${Date.now()}`,
    name: name.trim(),
    genreTag,
    filmIds: filmIds.slice(0, MAX_FILMS_PER_LIST),
    createdAt: new Date().toISOString().slice(0, 10),
  };
}

export function addFilmToList(list: MockList, filmId: string): MockList {
  if (list.filmIds.includes(filmId)) return list;
  if (list.filmIds.length >= MAX_FILMS_PER_LIST) return list;
  return { ...list, filmIds: [...list.filmIds, filmId] };
}

export function removeFilmFromList(list: MockList, filmId: string): MockList {
  return { ...list, filmIds: list.filmIds.filter((id) => id !== filmId) };
}
