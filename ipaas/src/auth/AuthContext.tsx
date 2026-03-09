/**
 * Copyright (c) 2026, WSO2 LLC. (https://www.wso2.com).
 *
 * WSO2 LLC. licenses this file to you under the Apache License,
 * Version 2.0 (the "License"); you may not use this file except
 * in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied. See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */

import { createContext, useContext, useMemo, useEffect } from 'react';
import type { JSX, ReactNode } from 'react';
import { useNavigate } from 'react-router';
import { useAuthContext } from '@asgardeo/auth-react';
import { useQueryClient } from '@tanstack/react-query';
import { setTokenProvider, setOnAuthFailure } from './tokenManager';
import { loginUrl } from '../paths';

interface AuthContextValue {
  isAuthenticated: boolean;
  isLoading: boolean;
  userId: string;
  username: string;
  displayName: string;
  isOidcUser: true;
  /** Always false for Asgardeo users — password is managed externally. */
  requirePasswordChange: false;
  clearRequirePasswordChange: () => void;
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { state, signIn, signOut, getAccessToken } = useAuthContext();

  // Wire up the token provider so authenticatedFetch can get a valid token.
  useEffect(() => {
    setTokenProvider(getAccessToken);
  }, [getAccessToken]);

  // Wire up the auth failure handler so 401 responses redirect to login.
  useEffect(() => {
    setOnAuthFailure(() => {
      queryClient.clear();
      navigate(loginUrl());
    });
  }, [navigate, queryClient]);

  const loginWithGoogle = async () => {
    await signIn({ fidp: 'google' });
  };

  const logout = async () => {
    queryClient.clear();
    await signOut();
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      isAuthenticated: state.isAuthenticated,
      isLoading: state.isLoading,
      userId: state.sub ?? '',
      username: state.email ?? state.username ?? '',
      displayName: state.displayName ?? '',
      isOidcUser: true,
      requirePasswordChange: false,
      clearRequirePasswordChange: () => {},
      loginWithGoogle,
      logout,
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [state],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
