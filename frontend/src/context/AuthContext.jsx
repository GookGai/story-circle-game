import { createContext, useState, useEffect, useCallback } from 'react';
import { api } from '../utils/api';

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(() => localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await api.get('/api/auth/me');
        setUser(data.user);
      } catch (err) {
        console.warn('Token validation failed:', err);
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);

  const login = useCallback(async (username, password) => {
    const data = await api.post('/api/auth/login', { username, password });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (username, password, avatar) => {
    const data = await api.post('/api/auth/register', { username, password, avatar });
    localStorage.setItem('token', data.token);
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    loading,
    login,
    register,
    logout,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
