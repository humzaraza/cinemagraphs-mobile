import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';
import type { Screen3Film } from '../lib/onboarding-api';

type OnboardingState = {
  eras: string[];
  genres: string[];
  filmIds: string[];
  // Parallel to filmIds: full Screen3Film records for the user's Screen 3
  // picks. Carried in context so the Reveal screen's dissolution animation
  // can render the selected films' posters without refetching. filmIds
  // remains the source of truth for "is this film selected"; filmDetails
  // is UI data used by surfaces that need more than the id.
  filmDetails: Screen3Film[];
  setEras: (next: string[]) => void;
  setGenres: (next: string[]) => void;
  setFilmIds: (next: string[]) => void;
  setFilmDetails: (next: Screen3Film[]) => void;
  reset: () => void;
};

export const OnboardingContext = createContext<OnboardingState | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [eras, setEras] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [filmIds, setFilmIds] = useState<string[]>([]);
  const [filmDetails, setFilmDetails] = useState<Screen3Film[]>([]);

  const reset = useCallback(() => {
    setEras([]);
    setGenres([]);
    setFilmIds([]);
    setFilmDetails([]);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{
        eras,
        genres,
        filmIds,
        filmDetails,
        setEras,
        setGenres,
        setFilmIds,
        setFilmDetails,
        reset,
      }}
    >
      {children}
    </OnboardingContext.Provider>
  );
}

export function useOnboarding(): OnboardingState {
  const ctx = useContext(OnboardingContext);
  if (!ctx) {
    throw new Error('useOnboarding must be used inside OnboardingProvider');
  }
  return ctx;
}
