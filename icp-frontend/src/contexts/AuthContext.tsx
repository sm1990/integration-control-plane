import React, { createContext, useContext, useState, useEffect } from 'react';
import { AuthUser } from '../types';
import { icpApiClient } from '../services/ICPApiClient';

interface AuthContextType {
  user: AuthUser | null;
  login: (user: AuthUser) => void;
  logout: () => void;
  refreshAuth: () => Promise<void>;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const AUTH_STORAGE_KEY = 'icp_auth_user';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [user, setUser] = useState<AuthUser | null>(() => {
    // Try to load user from localStorage on initialization
    const storedUser = localStorage.getItem(AUTH_STORAGE_KEY);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        // Check if token is expired
        if (parsedUser.expiresAt && parsedUser.expiresAt > Date.now()) {
          return parsedUser;
        } else {
          localStorage.removeItem(AUTH_STORAGE_KEY);
        }
      } catch (error) {
        console.error('Error parsing stored user:', error);
        localStorage.removeItem(AUTH_STORAGE_KEY);
      }
    }
    return null;
  });

  useEffect(() => {
    // Check token expiration periodically
    const interval = setInterval(() => {
      if (user && user.expiresAt <= Date.now()) {
        logout();
      }
    }, 60000); // Check every minute

    return () => clearInterval(interval);
  }, [user]);

  const login = (authUser: AuthUser) => {
    setUser(authUser);
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(authUser));
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem(AUTH_STORAGE_KEY);
  };

  const refreshAuth = async () => {
    try {
      const response = await icpApiClient.refreshToken();
      
      // Calculate token expiration time
      const expiresAt = Date.now() + (response.expiresIn * 1000);
      
      const updatedUser: AuthUser = {
        username: response.username,
        token: response.token,
        roles: response.roles,
        expiresAt,
        isSuperAdmin: response.isSuperAdmin,
        isProjectAuthor: response.isProjectAuthor,
      };
      
      // Update user state and localStorage
      setUser(updatedUser);
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updatedUser));
      
      console.log('Auth token refreshed successfully');
    } catch (error) {
      console.error('Failed to refresh auth token:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, login, logout, refreshAuth, isAuthenticated: !!user }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
