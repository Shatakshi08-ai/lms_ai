import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import api, { setAccessToken, getAccessToken } from '../services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const failSafe = setTimeout(() => {
      if (!cancelled) setReady(true);
    }, 8000);

    async function boot() {
      try {
        if (!getAccessToken()) {
          const { data } = await api.post('/auth/refresh');
          if (cancelled) return;
          setAccessToken(data.accessToken);
          setUser(data.user);
        } else {
          const { data } = await api.get('/auth/me');
          if (cancelled) return;
          setUser(data.user);
        }
      } catch {
        if (!cancelled) {
          setAccessToken('');
          setUser(null);
        }
      } finally {
        clearTimeout(failSafe);
        if (!cancelled) setReady(true);
      }
    }
    boot();
    return () => {
      cancelled = true;
      clearTimeout(failSafe);
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      ready,
      isAuthed: Boolean(user),
      login: async (email, password, { remember = true } = {}) => {
        const { data } = await api.post('/auth/login', { email, password, remember });
        setAccessToken(data.accessToken);
        setUser(data.user);
        return data.user;
      },
      register: async (payload) => {
        const { data } = await api.post('/auth/register', payload);
        if (data.accessToken) setAccessToken(data.accessToken);
        if (data.user) setUser(data.user);
        return data.user;
      },
      logout: async () => {
        try {
          await api.post('/auth/logout');
        } finally {
          setAccessToken('');
          setUser(null);
        }
      },
      setUser,
    }),
    [user, ready],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

export function can(user, roles) {
  return user && roles.includes(user.role);
}
