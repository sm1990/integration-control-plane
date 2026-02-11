import { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import type { JSX, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { loginApiUrl, loginUrl } from '../paths';
import { saveTokens, clearTokens, getAccessToken, revokeToken, setOnAuthFailure } from './tokenManager';

const USER_KEY = 'icp_user';

interface UserInfo {
  username: string;
  displayName: string;
  permissions: string[];
}

interface AuthContextValue {
  isAuthenticated: boolean;
  username: string;
  displayName: string;
  permissions: string[];
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function loadUserInfo(): UserInfo | null {
  const stored = localStorage.getItem(USER_KEY);
  if (!stored) return null;
  return JSON.parse(stored);
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
    const res = await fetch(loginApiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const body = await res.text();
      throw new Error(body || `Login failed (${res.status})`);
    }
    const data: { userId: string; token: string; expiresIn: number; refreshToken: string; refreshTokenExpiresIn: number; username: string; displayName: string; permissions: string[]; isOidcUser: boolean } = await res.json();
    saveTokens({ token: data.token, expiresIn: data.expiresIn, refreshToken: data.refreshToken, refreshTokenExpiresIn: data.refreshTokenExpiresIn });

    const user: UserInfo = { username: data.username, displayName: data.displayName, permissions: data.permissions };
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    setUserInfo(user);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    await revokeToken();
    clearTokens();
    localStorage.removeItem(USER_KEY);
    setUserInfo(null);
    setIsAuthenticated(false);
    queryClient.clear();
  }, [queryClient]);

  const value = useMemo<AuthContextValue>(() => ({
    isAuthenticated,
    username: userInfo?.username ?? '',
    displayName: userInfo?.displayName ?? '',
    permissions: userInfo?.permissions ?? [],
    login,
    logout,
  }), [isAuthenticated, userInfo, login, logout]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
