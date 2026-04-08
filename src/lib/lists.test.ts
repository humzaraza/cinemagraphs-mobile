import { describe, it, expect } from 'vitest';
import { validateListName, createList, addFilmToList, removeFilmFromList } from './lists';
import type { MockList } from '../data/mockProfile';

const stub = (overrides: Partial<MockList> = {}): MockList => ({
  id: 'list-1',
  name: 'Test list',
  genreTag: 'Drama',
  filmIds: [],
  createdAt: '2026-01-01',
  ...overrides,
});

describe('validateListName', () => {
  it('returns error for empty name', () => {
    expect(validateListName('', [])).toBe('Name is required');
    expect(validateListName('   ', [])).toBe('Name is required');
  });

  it('returns error for name exceeding 40 chars', () => {
    const long = 'a'.repeat(41);
    expect(validateListName(long, [])).toMatch(/40 characters/);
  });

  it('returns error for duplicate name (case-insensitive)', () => {
    const existing = [stub({ name: 'Best of 2024' })];
    expect(validateListName('best of 2024', existing)).toMatch(/already exists/);
    expect(validateListName('BEST OF 2024', existing)).toMatch(/already exists/);
  });

  it('returns null for valid unique name', () => {
    const existing = [stub({ name: 'Best of 2024' })];
    expect(validateListName('Best of 2025', existing)).toBeNull();
  });
});

describe('createList', () => {
  it('creates a list with trimmed name', () => {
    const list = createList('  My list  ', 'Sci-Fi', ['film-1'], []);
    expect(list.name).toBe('My list');
    expect(list.genreTag).toBe('Sci-Fi');
    expect(list.filmIds).toEqual(['film-1']);
    expect(list.id).toMatch(/^list-/);
  });

  it('throws on invalid name', () => {
    expect(() => createList('', 'Drama', [], [])).toThrow('Name is required');
  });

  it('throws on duplicate name', () => {
    const existing = [stub({ name: 'Dup' })];
    expect(() => createList('Dup', 'Drama', [], existing)).toThrow(/already exists/);
  });

  it('caps film IDs at 50', () => {
    const ids = Array.from({ length: 60 }, (_, i) => `film-${i}`);
    const list = createList('Big list', 'Action', ids, []);
    expect(list.filmIds).toHaveLength(50);
  });
});

describe('addFilmToList', () => {
  it('adds a film to the list', () => {
    const list = stub({ filmIds: ['a'] });
    const updated = addFilmToList(list, 'b');
    expect(updated.filmIds).toEqual(['a', 'b']);
  });

  it('does not add duplicate', () => {
    const list = stub({ filmIds: ['a'] });
    const updated = addFilmToList(list, 'a');
    expect(updated.filmIds).toEqual(['a']);
    expect(updated).toBe(list); // same reference
  });

  it('respects 50-film cap', () => {
    const ids = Array.from({ length: 50 }, (_, i) => `f-${i}`);
    const list = stub({ filmIds: ids });
    const updated = addFilmToList(list, 'overflow');
    expect(updated.filmIds).toHaveLength(50);
    expect(updated).toBe(list);
  });
});

describe('removeFilmFromList', () => {
  it('removes a film', () => {
    const list = stub({ filmIds: ['a', 'b', 'c'] });
    const updated = removeFilmFromList(list, 'b');
    expect(updated.filmIds).toEqual(['a', 'c']);
  });

  it('returns new list if film not present (no-op)', () => {
    const list = stub({ filmIds: ['a'] });
    const updated = removeFilmFromList(list, 'z');
    expect(updated.filmIds).toEqual(['a']);
  });
});
