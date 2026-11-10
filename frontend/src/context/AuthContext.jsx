import { useState, useEffect, useCallback } from "react";
import { api } from "../utils/api";

import { AuthContext } from "./contexts";

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      return localStorage.getItem("token")
        ? JSON.parse(localStorage.getItem("party-user"))
        : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [loading, setLoading] = useState(true);

  // Validate token on mount
  useEffect(() => {
    async function validateToken() {
      if (!token) {
        setLoading(false);
        return;
      }

      try {
        const data = await api.get("/api/auth/me");
        setUser(data.user);
        localStorage.setItem("party-user", JSON.stringify(data.user));
      } catch (err) {
        console.warn("Token validation failed:", err);
        if (err.status === 401 || err.status === 404) {
          localStorage.removeItem("token");
          localStorage.removeItem("party-user");
          setToken(null);
          setUser(null);
        }
      } finally {
        setLoading(false);
      }
    }

    validateToken();
  }, [token]);

  const login = useCallback(async (username, password) => {
    const data = await api.post("/api/auth/login", { username, password });
    localStorage.setItem("token", data.token);
    localStorage.setItem("party-user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const register = useCallback(async (username, password, avatar) => {
    const data = await api.post("/api/auth/register", {
      username,
      password,
      avatar,
    });
    localStorage.setItem("token", data.token);
    localStorage.setItem("party-user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const joinAsGuest = useCallback(async (username, avatar) => {
    const data = await api.post("/api/auth/guest", { username, avatar });
    localStorage.setItem("token", data.token);
    localStorage.setItem("party-user", JSON.stringify(data.user));
    setToken(data.token);
    setUser(data.user);
    return data;
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem("token");
    localStorage.removeItem("party-user");
    setToken(null);
    setUser(null);
  }, []);

  const value = {
    user,
    token,
    loading,
    login,
    register,
    joinAsGuest,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
