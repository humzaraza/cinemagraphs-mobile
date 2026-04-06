import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { getToken, setToken, removeToken } from './api';

interface AuthContextValue {
  token: string | null;
  isLoading: boolean;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    getToken().then((stored) => {
      setTokenState(stored);
      setIsLoading(false);
    });
  }, []);

  const signIn = async (newToken: string) => {
    await setToken(newToken);
    setTokenState(newToken);
  };

  const signOut = async () => {
    await removeToken();
    setTokenState(null);
  };

  return (
    <AuthContext.Provider value={{ token, isLoading, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
