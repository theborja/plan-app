import { AUTH_CHANGED_EVENT } from "@/lib/auth";

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    credentials: "include",
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  const payload = (await response.json().catch(() => ({}))) as T & { message?: string };
  if (!response.ok) {
    if (response.status === 401 && typeof window !== "undefined") {
      window.dispatchEvent(new Event(AUTH_CHANGED_EVENT));
      window.location.replace("/login");
      return new Promise<T>(() => {
        // Keep pending while navigating to avoid unhandled runtime errors.
      });
    }

    const message = typeof payload === "object" && payload && "message" in payload
      ? String(payload.message)
      : "Error de red";
    throw new Error(message);
  }

  return payload;
}

export async function postJson<T>(url: string, body: unknown): Promise<T> {
  return fetchJson<T>(url, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
