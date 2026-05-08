import { describe, it, expect, vi } from 'vitest';
import TestRenderer, { type ReactTestRenderer } from 'react-test-renderer';
import { OnboardingProvider, useOnboarding } from './onboarding-context';

type State = ReturnType<typeof useOnboarding>;

function setup() {
  let captured: State | undefined;
  function Capture() {
    const state = useOnboarding();
    captured = state;
    return null;
  }
  let tree: ReactTestRenderer | undefined;
  TestRenderer.act(() => {
    tree = TestRenderer.create(
      <OnboardingProvider>
        <Capture />
      </OnboardingProvider>,
    );
  });
  if (!tree || !captured) throw new Error('renderer never assigned');
  return {
    state: () => captured as State,
  };
}

describe('OnboardingContext', () => {
  it('initial state is four empty arrays', () => {
    const { state } = setup();
    const s = state();
    expect(s.eras).toEqual([]);
    expect(s.genres).toEqual([]);
    expect(s.filmIds).toEqual([]);
    expect(s.filmDetails).toEqual([]);
  });

  it('setEras updates eras only; genres and filmIds untouched', () => {
    const { state } = setup();
    TestRenderer.act(() => {
      state().setEras(['era_1990s', 'era_2010s']);
    });
    const s = state();
    expect(s.eras).toEqual(['era_1990s', 'era_2010s']);
    expect(s.genres).toEqual([]);
    expect(s.filmIds).toEqual([]);
  });

  it('setGenres updates genres only; eras and filmIds untouched', () => {
    const { state } = setup();
    TestRenderer.act(() => {
      state().setGenres(['genre_drama']);
    });
    const s = state();
    expect(s.genres).toEqual(['genre_drama']);
    expect(s.eras).toEqual([]);
    expect(s.filmIds).toEqual([]);
  });

  it('setFilmIds updates filmIds only; eras, genres, filmDetails untouched', () => {
    const { state } = setup();
    TestRenderer.act(() => {
      state().setFilmIds(['film_a', 'film_b']);
    });
    const s = state();
    expect(s.filmIds).toEqual(['film_a', 'film_b']);
    expect(s.eras).toEqual([]);
    expect(s.genres).toEqual([]);
    expect(s.filmDetails).toEqual([]);
  });

  it('setFilmDetails updates filmDetails only; other arrays untouched', () => {
    const { state } = setup();
    const film = {
      id: 'film_a',
      tmdbId: 1,
      title: 'A',
      year: 2020,
      posterPath: '/a.jpg',
    };
    TestRenderer.act(() => {
      state().setFilmDetails([film]);
    });
    const s = state();
    expect(s.filmDetails).toEqual([film]);
    expect(s.eras).toEqual([]);
    expect(s.genres).toEqual([]);
    expect(s.filmIds).toEqual([]);
  });

  it('reset clears all four arrays back to empty', () => {
    const { state } = setup();
    const film = {
      id: 'film_a',
      tmdbId: 1,
      title: 'A',
      year: 2020,
      posterPath: '/a.jpg',
    };
    TestRenderer.act(() => {
      state().setEras(['era_1990s']);
      state().setGenres(['genre_drama']);
      state().setFilmIds(['film_a']);
      state().setFilmDetails([film]);
    });
    expect(state().eras).toEqual(['era_1990s']);
    expect(state().filmDetails).toEqual([film]);
    TestRenderer.act(() => {
      state().reset();
    });
    const s = state();
    expect(s.eras).toEqual([]);
    expect(s.genres).toEqual([]);
    expect(s.filmIds).toEqual([]);
    expect(s.filmDetails).toEqual([]);
  });

  it('useOnboarding outside provider throws expected message', () => {
    function Throws() {
      useOnboarding();
      return null;
    }
    const errSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => {
      TestRenderer.act(() => {
        TestRenderer.create(<Throws />);
      });
    }).toThrow('useOnboarding must be used inside OnboardingProvider');
    errSpy.mockRestore();
  });
});
