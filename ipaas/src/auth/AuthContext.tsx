import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { JSX, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { loginApiUrl, loginUrl, oidcAuthorizeApiUrl, oidcCallbackApiUrl } from '../paths';
import { saveTokens, clearTokens, getAccessToken, revokeToken, setOnAuthFailure, saveRedirectUrl, generateAndSaveOIDCState } from './tokenManager';

const USER_KEY = 'icp_user';

interface UserInfo {
  userId: string;
  username: string;
  displayName: string;
  isOidcUser: boolean;
  requirePasswordChange: boolean;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  userId: string;
  username: string;
  displayName: string;
  isOidcUser: boolean;
  requirePasswordChange: boolean;
  clearRequirePasswordChange: () => void;
  login: (username: string, password: string) => Promise<void>;
  loginWithOIDC: () => Promise<void>;
  handleOIDCCallback: (code: string, state: string | null) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUserInfo(): UserInfo | null {
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    localStorage.removeItem(USER_KEY);
    return null;
  }
}

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [isAuthenticated, setIsAuthenticated] = useState(() => !!getAccessToken());
  const [userInfo, setUserInfo] = useState<UserInfo | null>(() => loadUserInfo());

  useEffect(() => {
    setOnAuthFailure(() => {
      localStorage.removeItem(USER_KEY);
      setUserInfo(null);
      setIsAuthenticated(false);
      queryClient.clear();
      navigate(loginUrl());
    });
  }, [navigate, queryClient]);

  const login = useCallback(async (username: string, password: string) => {
    const res = await fetch(loginApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.text();
      const err: Error & { status?: number; retryAfterSeconds?: number } = new Error(body || `Login failed (${res.status})`);
      err.status = res.status;
      if (res.status === 429) {
        try {
          err.retryAfterSeconds = JSON.parse(body).retryAfterSeconds;
        } catch {
          /* ignore */
        }
      }
      throw err;
    }
    const data: { userId: string; token: string; expiresIn: number; refreshToken: string; refreshTokenExpiresIn: number; username: string; displayName: string; permissions: string[]; isOidcUser: boolean; requirePasswordChange?: boolean } = await res.json();
    saveTokens({ token: data.token, expiresIn: data.expiresIn, refreshToken: data.refreshToken, refreshTokenExpiresIn: data.refreshTokenExpiresIn });

    const user: UserInfo = { userId: data.userId, username: data.username, displayName: data.displayName, isOidcUser: data.isOidcUser, requirePasswordChange: data.requirePasswordChange ?? false };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setUserInfo(user);
    setIsAuthenticated(true);
  }, []);

  const loginWithOIDC = useCallback(async () => {
    saveRedirectUrl(window.location.href);
    const state = generateAndSaveOIDCState();
    const res = await fetch(`${oidcAuthorizeApiUrl()}?state=${encodeURIComponent(state)}`);
    if (!res.ok) {
      const body = await res.text();
      const err: Error & { status?: number } = new Error(body || `SSO login failed (${res.status})`);
      err.status = res.status;
      throw err;
    }
    const data: { authorizationUrl: string } = await res.json();
    window.location.href = data.authorizationUrl;
  }, []);

  const handleOIDCCallback = useCallback(async (code: string, state: string | null) => {
    const res = await fetch(oidcCallbackApiUrl(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, state }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `Token exchange failed (${res.status})`);
    }
    const data: { userId: string; token: string; expiresIn: number; refreshToken: string; refreshTokenExpiresIn: number; username: string; displayName: string; permissions: string[]; isOidcUser: boolean } = await res.json();
    saveTokens({ token: data.token, expiresIn: data.expiresIn, refreshToken: data.refreshToken, refreshTokenExpiresIn: data.refreshTokenExpiresIn });
    const user: UserInfo = { userId: data.userId, username: data.username, displayName: data.displayName, isOidcUser: data.isOidcUser, requirePasswordChange: false };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setUserInfo(user);
    setIsAuthenticated(true);
  }, []);

  const clearRequirePasswordChange = useCallback(() => {
    setUserInfo((prev) => {
      if (!prev) return prev;
      const updated = { ...prev, requirePasswordChange: false };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const logout = useCallback(async () => {
    await revokeToken();
    clearTokens();
    localStorage.removeItem(USER_KEY);
    setUserInfo(null);
    setIsAuthenticated(false);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated,
      userId: userInfo?.userId ?? '',
      username: userInfo?.username ?? '',
      displayName: userInfo?.displayName ?? '',
      isOidcUser: userInfo?.isOidcUser ?? false,
      requirePasswordChange: userInfo?.requirePasswordChange ?? false,
      clearRequirePasswordChange,
      login,
      loginWithOIDC,
      handleOIDCCallback,
      logout,
    }),
    [isAuthenticated, userInfo, clearRequirePasswordChange, login, loginWithOIDC, handleOIDCCallback, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
