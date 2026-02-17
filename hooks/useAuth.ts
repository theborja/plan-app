"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AUTH_CHANGED_EVENT,
  type AuthUser,
  fetchAuthMe,
  loginLocal,
  registerLocal,
  logoutLocal,
} from "@/lib/auth";

type LoginResult = { ok: true } | { ok: false; message: string };
type RegisterResult = { ok: true } | { ok: false; message: string };

export function useAuth() {
  const [isReady, setIsReady] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [user, setUser] = useState<AuthUser | null>(null);

  const refresh = useCallback(async () => {
    const auth = await fetchAuthMe();
    setIsAuthenticated(auth.isAuthenticated);
    setUser(auth.user);
    setIsReady(true);
  }, []);

  useEffect(() => {
    void refresh();
    if (typeof window === "undefined") return;

    const onAuthChanged = () => {
      void refresh();
    };
    const onVisibility = () => {
      if (document.visibilityState === "visible") {
        void refresh();
      }
    };

    window.addEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      window.removeEventListener(AUTH_CHANGED_EVENT, onAuthChanged);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [refresh]);

  const login = useCallback(async (email: string, password: string): Promise<LoginResult> => {
    if (!email.trim() || !password.trim()) {
      return { ok: false, message: "Email y password son obligatorios." };
    }

    try {
      await loginLocal(email.trim(), password);
      await refresh();
      return { ok: true };
    } catch (error) {
      const message =
        typeof error === "object" &&
        error !== null &&
        "message" in error &&
        typeof (error as { message?: unknown }).message === "string"
          ? (error as { message: string }).message
          : "Invalid email or password";
      return { ok: false, message };
    }
  }, [refresh]);

  const register = useCallback(
    async (email: string, password: string, name?: string): Promise<RegisterResult> => {
      if (!email.trim() || !password.trim()) {
        return { ok: false, message: "Email y password son obligatorios." };
      }

      try {
        await registerLocal(email.trim(), password, name?.trim());
        await refresh();
        return { ok: true };
      } catch (error) {
        const message =
          typeof error === "object" &&
          error !== null &&
          "message" in error &&
          typeof (error as { message?: unknown }).message === "string"
            ? (error as { message: string }).message
            : "No se pudo registrar el usuario.";
        return { ok: false, message };
      }
    },
    [refresh],
  );

  const logout = useCallback(async () => {
    await logoutLocal();
    await refresh();
  }, [refresh]);

  return {
    user,
    isReady,
    isAuthenticated,
    login,
    register,
    logout,
    refresh,
  };
}
