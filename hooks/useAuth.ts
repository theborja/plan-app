"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AUTH_CHANGED_EVENT,
  AUTH_STORAGE_KEY,
  getCurrentUser,
  getSession,
  loginLocal,
  logoutLocal,
} from "@/lib/auth";

type LoginResult = { ok: true } | { ok: false; message: string };

export function useAuth() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState(() => getCurrentUser());

  const refresh = useCallback(() => {
    const session = getSession();
    setIsAuthenticated(!!session);
    setUser(getCurrentUser());
    setIsReady(true);
  }, []);

  useEffect(() => {
    refresh();
    if (typeof window === "undefined") return;

    const onAuthChanged = () => refresh();
    const onStorage = (event: StorageEvent) => {
      if (event.key && event.key !== AUTH_STORAGE_KEY) return;
      refresh();
    };

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    window.addEventListener("storage", onStorage);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      window.removeEventListener("storage", onStorage);
    };
  }, [refresh]);

  const login = useCallback((email: string, password: string): LoginResult => {
    if (!email.trim() || !password.trim()) {
      return { ok: false, message: "Email y password son obligatorios." };
    }

    const result = loginLocal(email.trim(), password);
    if (!result.ok) {
      return { ok: false, message: "Invalid email or password" };
    }

    refresh();
    return { ok: true };
  }, [refresh]);

  const logout = useCallback(() => {
    logoutLocal();
    refresh();
  }, [refresh]);

  return {
    user,
    isReady,
    isAuthenticated,
    login,
    logout,
    refresh,
  };
}
