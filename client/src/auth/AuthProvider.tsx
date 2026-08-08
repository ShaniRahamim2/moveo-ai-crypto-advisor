import { createContext, useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { apiFetch, getToken, setToken } from '../lib/api';
import type { AuthResponse, AuthUser } from './types';

interface AuthContextValue {
  user: AuthUser | null;
  status: 'loading' | 'authenticated' | 'anonymous';
  signIn: (credentials: { email: string; password: string }) => Promise<AuthUser>;
  signUp: (input: { name: string; email: string; password: string }) => Promise<AuthUser>;
  signOut: () => void;
  setUser: (user: AuthUser) => void;
}

export const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [user, setUser] = useState<AuthUser | null>(null);
  // With no stored token there is nothing to verify, so the anonymous state is
  // the initial state rather than something an effect corrects afterwards.
  const [status, setStatus] = useState<AuthContextValue['status']>(() =>
    getToken() ? 'loading' : 'anonymous',
  );

  // A stored token may be expired or belong to a deleted account, so it is only
  // trusted once /me confirms it.
  useEffect(() => {
    if (!getToken()) {
      return;
    }

    let active = true;
    apiFetch<{ user: AuthUser }>('/api/auth/me')
      .then(({ user: me }) => {
        if (!active) return;
        setUser(me);
        setStatus('authenticated');
      })
      .catch(() => {
        if (!active) return;
        setToken(null);
        setStatus('anonymous');
      });

    return () => {
      active = false;
    };
  }, []);

  const authenticate = useCallback(
    async (path: string, body: unknown) => {
      const result = await apiFetch<AuthResponse>(path, {
        method: 'POST',
        body: JSON.stringify(body),
      });

      // Cached dashboards and votes belong to whoever was signed in before. They
      // must never paint under a new session, even for a frame.
      queryClient.clear();

      setToken(result.token);
      setUser(result.user);
      setStatus('authenticated');
      return result.user;
    },
    [queryClient],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      status,
      signIn: (credentials) => authenticate('/api/auth/login', credentials),
      signUp: (input) => authenticate('/api/auth/register', input),
      signOut: () => {
        setToken(null);
        setUser(null);
        setStatus('anonymous');
        queryClient.clear();
      },
      setUser,
    }),
    [user, status, authenticate, queryClient],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
