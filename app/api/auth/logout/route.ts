import { NextRequest } from "next/server";
import { SESSION_COOKIE_NAME, destroySessionByToken, withClearedSession } from "@/lib/serverAuth";

export async function POST(request: NextRequest) {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (token) {
    await destroySessionByToken(token);
  }

  return withClearedSession({ ok: true });
}
