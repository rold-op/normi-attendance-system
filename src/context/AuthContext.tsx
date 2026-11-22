import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import type { AuthSession, ManagedUser } from '../types/normi';

interface AuthResult {
  success: boolean;
  error?: string;
}

interface AuthContextValue {
  session: AuthSession | null;
  token: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  setupRequired: boolean;
  defaultSuperAdminEmail: string;
  setupSuperAdmin: (fullName: string, email: string, password: string) => Promise<AuthResult>;
  login: (email: string, password: string) => Promise<AuthResult>;
  logout: () => Promise<void>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  refreshAuthStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAuthSession(user: ManagedUser): AuthSession {
  return {
    id: user.id,
    name: user.full_name,
    email: user.email,
    role: user.role,
    isActive: user.is_active,
    signedInAt: new Date().toISOString(),
  };
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  // Server-verified Bearer token held strictly in JS/React memory (never localStorage/sessionStorage)
  const [token, setToken] = useState<string | null>(null);
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [setupRequired, setSetupRequired] = useState(false);
  const [defaultSuperAdminEmail, setDefaultSuperAdminEmail] = useState('admin@normi.edu.ph');

  const tokenRef = useRef<string | null>(null);
  tokenRef.current = token;

  const refreshAuthStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/status');
      if (res.ok) {
        const data = (await res.json()) as {
          setupRequired?: boolean;
          defaultSuperAdminEmail?: string;
        };
        setSetupRequired(Boolean(data.setupRequired));
        if (data.defaultSuperAdminEmail) {
          setDefaultSuperAdminEmail(data.defaultSuperAdminEmail);
        }
      }
    } catch {
      // Network error while checking status
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshAuthStatus();
  }, [refreshAuthStatus]);

  const setupSuperAdmin = useCallback(
    async (fullName: string, email: string, password: string): Promise<AuthResult> => {
      try {
        const res = await fetch('/api/auth/setup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            full_name: fullName.trim(),
            email: email.trim().toLowerCase(),
            password,
          }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          token?: string;
          user?: ManagedUser;
          error?: string;
        };
        if (!res.ok || !data.token || !data.user) {
          return {
            success: false,
            error: data.error ?? 'Failed to initialize Super Admin account.',
          };
        }
        setToken(data.token);
        setSession(toAuthSession(data.user));
        setSetupRequired(false);
        return { success: true };
      } catch {
        return { success: false, error: 'Unable to reach authentication server.' };
      }
    },
    []
  );

  const login = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const cleanedEmail = email.trim().toLowerCase();
    if (!cleanedEmail || !password) {
      return { success: false, error: 'Please enter both your email address and password.' };
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: cleanedEmail, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        token?: string;
        user?: ManagedUser;
        error?: string;
      };
      if (!res.ok || !data.token || !data.user) {
        return {
          success: false,
          error: data.error ?? 'Invalid email address or password.',
        };
      }
      setToken(data.token);
      setSession(toAuthSession(data.user));
      setSetupRequired(false);
      return { success: true };
    } catch {
      return { success: false, error: 'Unable to reach authentication server.' };
    }
  }, []);

  const logout = useCallback(async () => {
    const currentToken = tokenRef.current;
    setToken(null);
    setSession(null);
    if (currentToken) {
      try {
        await fetch('/api/auth/logout', {
          method: 'POST',
          headers: { Authorization: `Bearer ${currentToken}` },
        });
      } catch {
        // Ignore network errors on logout
      }
    }
  }, []);

  const authFetch = useCallback(
    async (input: string, init: RequestInit = {}): Promise<Response> => {
      const headers = new Headers(init.headers);
      if (tokenRef.current) {
        headers.set('Authorization', `Bearer ${tokenRef.current}`);
      }
      const res = await fetch(input, { ...init, headers });
      if (res.status === 401) {
        setToken(null);
        setSession(null);
      }
      return res;
    },
    []
  );

  return (
    <AuthContext.Provider
      value={{
        session,
        token,
        isAuthenticated: Boolean(session && token),
        isLoading,
        setupRequired,
        defaultSuperAdminEmail,
        setupSuperAdmin,
        login,
        logout,
        authFetch,
        refreshAuthStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
