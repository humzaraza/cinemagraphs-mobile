import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

type OnboardingState = {
  eras: string[];
  genres: string[];
  filmIds: string[];
  setEras: (next: string[]) => void;
  setGenres: (next: string[]) => void;
  setFilmIds: (next: string[]) => void;
  reset: () => void;
};

export const OnboardingContext = createContext<OnboardingState | undefined>(undefined);

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const [eras, setEras] = useState<string[]>([]);
  const [genres, setGenres] = useState<string[]>([]);
  const [filmIds, setFilmIds] = useState<string[]>([]);

  const reset = useCallback(() => {
    setEras([]);
    setGenres([]);
    setFilmIds([]);
  }, []);

  return (
    <OnboardingContext.Provider
      value={{ eras, genres, filmIds, setEras, setGenres, setFilmIds, reset }}
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
