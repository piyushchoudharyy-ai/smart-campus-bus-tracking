import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../services/api.js';
import { refreshSocketAuth, disconnectSocket } from '../services/socket.js';
import type { User, UserRole } from '../types.js';

interface AuthContextType {
  user: User | null;
  token: string | null;
  role: UserRole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: any) => Promise<void>;
  logout: () => void;
  quickLoginAs: (role: 'admin' | 'driver' | 'student') => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('campus_bus_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadUser() {
      const storedToken = localStorage.getItem('campus_bus_token');
      if (!storedToken) {
        setIsLoading(false);
        return;
      }

      try {
        const res = await api.get('/auth/me');
        if (res.success && res.user) {
          setUser(res.user);
          refreshSocketAuth();
        } else {
          logout();
        }
      } catch (err) {
        logout();
      } finally {
        setIsLoading(false);
      }
    }

    loadUser();
  }, []);

  const login = async (email: string, password: string) => {
    const res = await api.post('/auth/login', { email, password });
    if (res.success && res.token && res.user) {
      localStorage.setItem('campus_bus_token', res.token);
      localStorage.setItem('campus_bus_user', JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      refreshSocketAuth();
    }
  };

  const register = async (data: any) => {
    const res = await api.post('/auth/register', data);
    if (res.success && res.token && res.user) {
      localStorage.setItem('campus_bus_token', res.token);
      localStorage.setItem('campus_bus_user', JSON.stringify(res.user));
      setToken(res.token);
      setUser(res.user);
      refreshSocketAuth();
    }
  };

  const logout = () => {
    localStorage.removeItem('campus_bus_token');
    localStorage.removeItem('campus_bus_user');
    setToken(null);
    setUser(null);
    disconnectSocket();
  };

  // Demo shortcut login helper
  const quickLoginAs = async (targetRole: 'admin' | 'driver' | 'student') => {
    const credentials = {
      admin: { email: 'admin@campus.edu', password: 'admin123' },
      driver: { email: 'driver1@campus.edu', password: 'driver123' },
      student: { email: 'student@campus.edu', password: 'student123' }
    };
    await login(credentials[targetRole].email, credentials[targetRole].password);
  };

  const value: AuthContextType = {
    user,
    token,
    role: user?.role || null,
    isAuthenticated: Boolean(token && user),
    isLoading,
    login,
    register,
    logout,
    quickLoginAs
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
