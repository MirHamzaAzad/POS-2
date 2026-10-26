import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { authApi, User } from '../lib/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (username: string, password: string) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  hasRole: (...roles: string[]) => boolean;
  hasPermission: (...permissions: string[]) => boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
  const [isLoading, setIsLoading] = useState(true);

  const logout = useCallback(() => {
    setUser(null);
    setToken(null);
    localStorage.removeItem('token');
  }, []);

  useEffect(() => {
    const savedToken = localStorage.getItem('token');
    if (savedToken) {
      authApi.me()
        .then((userData) => setUser(userData))
        .catch(() => logout())
        .finally(() => setIsLoading(false));
    } else {
      setIsLoading(false);
    }
  }, [logout]);

  const login = async (username: string, password: string) => {
    const response = await authApi.login(username, password);
    localStorage.setItem('token', response.token);
    setToken(response.token);
    setUser(response.user);
  };

  const hasRole = (...roles: string[]) => {
    if (!user) return false;
    return roles.some((r) => user.roles.includes(r));
  };

  const hasPermission = (...permissions: string[]) => {
    if (!user) return false;
    return permissions.some((p) => user.permissions.includes(p));
  };

  return (
    <AuthContext.Provider value={{ user, token, login, logout, isLoading, hasRole, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
