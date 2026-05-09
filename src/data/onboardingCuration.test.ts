import { describe, it, expect } from 'vitest';
import { ERA_BLOCKS, GENRE_BLOCKS, ALL_BLOCKS } from './onboardingCuration';

describe('onboardingCuration', () => {
  it('ERA_BLOCKS has length 8', () => {
    expect(ERA_BLOCKS).toHaveLength(8);
  });

  it('GENRE_BLOCKS has length 9', () => {
    expect(GENRE_BLOCKS).toHaveLength(9);
  });

  it('ALL_BLOCKS has length 17', () => {
    expect(ALL_BLOCKS).toHaveLength(17);
  });

  it('every block has exactly 4 films', () => {
    for (const block of ALL_BLOCKS) {
      expect(block.films).toHaveLength(4);
    }
  });

  it('every film has non-empty title, year in [1900, 2030], posterPath starting with /', () => {
    for (const block of ALL_BLOCKS) {
      for (const film of block.films) {
        expect(film.title.length).toBeGreaterThan(0);
        expect(film.year).toBeGreaterThanOrEqual(1900);
        expect(film.year).toBeLessThanOrEqual(2030);
        expect(film.posterPath.startsWith('/')).toBe(true);
      }
    }
  });

  it('all ERA_BLOCKS have kind "era"', () => {
    for (const block of ERA_BLOCKS) {
      expect(block.kind).toBe('era');
    }
  });

  it('all GENRE_BLOCKS have kind "genre"', () => {
    for (const block of GENRE_BLOCKS) {
      expect(block.kind).toBe('genre');
    }
  });

  it('all block ids are unique across ALL_BLOCKS', () => {
    const ids = ALL_BLOCKS.map((b) => b.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('57 unique posterPaths across ALL_BLOCKS', () => {
    const allPosters = ALL_BLOCKS.flatMap((b) => b.films.map((f) => f.posterPath));
    expect(new Set(allPosters).size).toBe(57);
  });

  it('68 total film entries across ALL_BLOCKS', () => {
    const total = ALL_BLOCKS.reduce((sum, b) => sum + b.films.length, 0);
    expect(total).toBe(68);
  });

  it('11 cross-block duplicates between era and genre blocks', () => {
    const eraPosters = new Set(ERA_BLOCKS.flatMap((b) => b.films.map((f) => f.posterPath)));
    const genrePosters = new Set(GENRE_BLOCKS.flatMap((b) => b.films.map((f) => f.posterPath)));
    const intersection = new Set([...eraPosters].filter((p) => genrePosters.has(p)));
    expect(intersection.size).toBe(11);
  });
});
