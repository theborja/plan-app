export type AuthRole = "ADMIN" | "USER";

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: AuthRole;
};

export const AUTH_CHANGED_EVENT = "auth:changed";

type AuthMeResponse = {
  isAuthenticated: boolean;
  user: AuthUser | null;
};

function notifyAuthChanged(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
}

async function postJson<T>(url: string, body: Record<string, unknown>): Promise<T> {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    credentials: "include",
  });

  const payload = (await response.json().catch(() => ({}))) as T;
  if (!response.ok) {
    throw payload;
  }

  return payload;
}

export function isAdminUser(input: string | AuthUser | null | undefined): boolean {
  if (!input) return false;
  if (typeof input === "string") {
    return input.toUpperCase() === "ADMIN";
  }
  return input.role === "ADMIN";
}

export async function fetchAuthMe(): Promise<AuthMeResponse> {
  const response = await fetch("/api/auth/me", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
  });

  if (!response.ok) {
    return { isAuthenticated: false, user: null };
  }

  const payload = (await response.json()) as AuthMeResponse;
  return payload;
}

export async function loginLocal(email: string, password: string): Promise<{ ok: true }> {
  await postJson("/api/auth/login", { email, password });
  notifyAuthChanged();
  return { ok: true };
}

export async function registerLocal(
  email: string,
  password: string,
  name?: string,
): Promise<{ ok: true }> {
  await postJson("/api/auth/register", { email, password, name });
  notifyAuthChanged();
  return { ok: true };
}

export async function logoutLocal(): Promise<void> {
  await fetch("/api/auth/logout", {
    method: "POST",
    credentials: "include",
  });
  notifyAuthChanged();
}
