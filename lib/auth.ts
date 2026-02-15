import users from "@/data/users.json";

export type LocalUser = {
  id: string;
  email: string;
  password: string;
  name: string;
};

export type AuthSessionV1 = {
  version: 1;
  isAuthenticated: true;
  userId: string;
  email: string;
  loginAt: string;
};

export const AUTH_STORAGE_KEY = "auth_v1";
export const AUTH_CHANGED_EVENT = "auth:changed";

function notifyAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function getLocalUsers(): LocalUser[] {
  return users as LocalUser[];
}

export function getDefaultUser(): LocalUser {
  const adminUser = getLocalUsers().find((user) => user.email === "admin");
  return adminUser ?? getLocalUsers()[0];
}

export function getSession(): AuthSessionV1 | null {
  if (typeof window === "undefined") return null;

  const raw = window.localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isObject(parsed)) return null;
    if (parsed.version !== 1 || parsed.isAuthenticated !== true) return null;
    if (typeof parsed.userId !== "string") return null;
    if (typeof parsed.email !== "string") return null;
    if (typeof parsed.loginAt !== "string") return null;

    return parsed as AuthSessionV1;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getSession() !== null;
}

export function getCurrentUser(): LocalUser | null {
  const session = getSession();
  if (!session) return null;
  return getLocalUsers().find((user) => user.id === session.userId) ?? null;
}

export function isAdminUser(email: string): boolean {
  return email === "admin";
}

export function isCurrentUserAdmin(): boolean {
  const user = getCurrentUser();
  return user ? isAdminUser(user.email) : false;
}

export function loginLocal(email: string, password: string): { ok: true } | { ok: false } {
  const normalizedEmail = email.trim().toLowerCase();
  const matched = getLocalUsers().find(
    (user) => user.email.trim().toLowerCase() === normalizedEmail && user.password === password,
  );
  if (!matched || typeof window === "undefined") {
    return { ok: false };
  }

  const session: AuthSessionV1 = {
    version: 1,
    isAuthenticated: true,
    userId: matched.id,
    email: matched.email,
    loginAt: new Date().toISOString(),
  };

  window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
  notifyAuthChanged();
  return { ok: true };
}

export function logoutLocal(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(AUTH_STORAGE_KEY);
  notifyAuthChanged();
}

export function initializeLocalSession(): AuthSessionV1 {
  const existing = getSession();
  if (existing) return existing;

  const fallback = getDefaultUser();
  const session: AuthSessionV1 = {
    version: 1,
    isAuthenticated: true,
    userId: fallback.id,
    email: fallback.email,
    loginAt: new Date().toISOString(),
  };

  if (typeof window !== "undefined") {
    window.localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    notifyAuthChanged();
  }

  return session;
}
