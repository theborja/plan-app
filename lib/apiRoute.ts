import { NextRequest, NextResponse } from "next/server";
import { getAuthUserFromRequest } from "@/lib/serverAuth";

export function isISODate(value: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export async function requireAuthUser(request: NextRequest) {
  const user = await getAuthUserFromRequest(request);
  if (!user) {
    return {
      user: null,
      response: NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 }),
    };
  }

  return { user, response: null as NextResponse | null };
}

export function badRequest(message: string) {
  return NextResponse.json({ ok: false, message }, { status: 400 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ ok: false, message }, { status: 403 });
}

