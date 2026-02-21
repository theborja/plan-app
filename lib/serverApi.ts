import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest, type AuthUser } from "@/lib/serverAuth";

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ ok: false, message }, { status });
}

export function isIsoDate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function requireAuth(request: NextRequest): Promise<{ user: AuthUser | null; response: NextResponse | null }> {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return { user: null, response: jsonError("Unauthorized", 401) };
  }
  return { user, response: null };
}

export async function requireAdmin(request: NextRequest): Promise<{ user: AuthUser | null; response: NextResponse | null }> {
  const auth = await requireAuth(request);
  if (auth.response) return auth;
  if (auth.user?.role !== "ADMIN") {
    return { user: null, response: jsonError("Forbidden", 403) };
  }
  return { user: auth.user, response: null };
}