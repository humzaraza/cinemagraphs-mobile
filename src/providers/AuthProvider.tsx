import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import * as SecureStore from 'expo-secure-store';
import { useRouter } from 'expo-router';
import { InteractionManager } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  loginWithEmail,
  registerWithEmail,
  verifyOTP,
  loginWithGoogle,
  loginWithApple,
  getToken,
  setToken,
  removeToken,
  apiFetch,
  type AuthUser,
  type AuthResponse,
} from '../lib/api';

interface AuthContextValue {
  user: AuthUser | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, name: string) => Promise<void>;
  verifyOtp: (email: string, code: string) => Promise<void>;
  signOut: () => Promise<void>;
  signInWithGoogle: (idToken: string) => Promise<void>;
  signInWithApple: (identityToken: string, fullName?: string | null) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  token: null,
  isLoading: true,
  isAuthenticated: false,
  signIn: async () => {},
  signUp: async () => {},
  verifyOtp: async () => {},
  signOut: async () => {},
  signInWithGoogle: async () => {},
  signInWithApple: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

async function storeAuth(data: AuthResponse) {
  const token = data.token;
  if (typeof token !== 'string' || !token) {
    throw new Error('Auth response missing token');
  }
  await setToken(token);
  await SecureStore.setItemAsync('auth_user', JSON.stringify(data.user ?? {}));
}

async function clearAuth() {
  await removeToken();
  await SecureStore.deleteItemAsync('auth_user');
}

async function checkOnboarding(): Promise<boolean> {
  const seen = await AsyncStorage.getItem('has_seen_onboarding');
  return seen !== 'true';
}

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [token, setTokenState] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  // Restore session on mount
  useEffect(() => {
    (async () => {
      try {
        const stored = await getToken();
        if (!stored) {
          setIsLoading(false);
          return;
        }
        const res = await apiFetch('/user/profile');
        if (res.ok) {
          const profile = await res.json();
          setUser(profile.user ?? profile);
          setTokenState(stored);
        } else {
          const cachedUser = await SecureStore.getItemAsync('auth_user');
          if (cachedUser) {
            setUser(JSON.parse(cachedUser));
            setTokenState(stored);
          } else {
            await clearAuth();
          }
        }
      } catch {
        const stored = await getToken();
        const cachedUser = await SecureStore.getItemAsync('auth_user');
        if (stored && cachedUser) {
          setUser(JSON.parse(cachedUser));
          setTokenState(stored);
        } else {
          await clearAuth();
        }
      }
      setIsLoading(false);
    })();
  }, []);

  // No navigation guard -- _layout.tsx declaratively renders (auth) or (tabs)
  // based on isAuthenticated. No imperative router.replace calls needed.

  const handlePostAuth = useCallback(async (data: AuthResponse) => {
    await storeAuth(data);
    setUser(data.user);
    const needsOnboarding = await checkOnboarding();
    if (needsOnboarding) {
      await AsyncStorage.setItem('has_seen_onboarding', 'true');
    }
    // Setting token makes isAuthenticated true, which causes _layout.tsx
    // to declaratively switch from (auth) to (tabs) screens.
    setTokenState(data.token);
    // After tabs mount, push onboarding if needed
    if (needsOnboarding) {
      InteractionManager.runAfterInteractions(() => {
        router.push('/settings/about' as any);
      });
    }
  }, [router]);

  const signIn = useCallback(async (email: string, password: string) => {
    const data = await loginWithEmail(email, password);
    await handlePostAuth(data);
  }, [handlePostAuth]);

  const signUp = useCallback(async (email: string, password: string, name: string) => {
    await registerWithEmail(email, password, name);
  }, []);

  const verifyOtp = useCallback(async (email: string, code: string) => {
    const data = await verifyOTP(email, code);
    await handlePostAuth(data);
  }, [handlePostAuth]);

  const signOut = useCallback(async () => {
    await clearAuth();
    setUser(null);
    setTokenState(null);
    // Setting token to null makes isAuthenticated false, which causes
    // _layout.tsx to declaratively switch to (auth) screens.
  }, []);

  const signInWithGoogleFn = useCallback(async (idToken: string) => {
    const data = await loginWithGoogle(idToken);
    await handlePostAuth(data);
  }, [handlePostAuth]);

  const signInWithAppleFn = useCallback(async (identityToken: string, fullName?: string | null) => {
    const data = await loginWithApple(identityToken, fullName);
    await handlePostAuth(data);
  }, [handlePostAuth]);

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAuthenticated: !!token,
        signIn,
        signUp,
        verifyOtp,
        signOut,
        signInWithGoogle: signInWithGoogleFn,
        signInWithApple: signInWithAppleFn,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
