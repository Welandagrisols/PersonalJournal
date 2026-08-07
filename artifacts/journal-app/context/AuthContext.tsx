import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import {
  getStoredSupabaseSession,
  isSupabaseConfigured,
  signInWithPassword,
  signOutFromSupabase,
  signUpWithPassword,
  type SupabaseUser,
} from '@/lib/supabase';

interface AuthContextValue {
  user: SupabaseUser | null;
  userId: string | null;
  isLoaded: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<{ needsEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<SupabaseUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    getStoredSupabaseSession()
      .then(session => setUser(session?.access_token ? session.user ?? null : null))
      .catch(() => setUser(null))
      .finally(() => setIsLoaded(true));
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    const signedInUser = await signInWithPassword(email, password);
    setUser(signedInUser);
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const result = await signUpWithPassword(email, password);
    if (result.user && !result.needsEmailConfirmation) setUser(result.user);
    return { needsEmailConfirmation: result.needsEmailConfirmation };
  }, []);

  const signOut = useCallback(async () => {
    await signOutFromSupabase();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        userId: user?.id ?? null,
        isLoaded,
        isConfigured: isSupabaseConfigured,
        signIn,
        signUp,
        signOut,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}