import crypto from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import type { UserRole } from "@prisma/client";
import { prisma } from "@/lib/db";

export const SESSION_COOKIE_NAME = "auth_session";
const SESSION_TTL_DAYS = 30;

export type AuthUser = {
  id: string;
  email: string;
  name: string;
  role: UserRole;
};

function getExpiryDate(): Date {
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);
  return expiresAt;
}

function setSessionCookie(response: NextResponse, token: string, expiresAt: Date): void {
  response.cookies.set(SESSION_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: expiresAt,
  });
}

function clearSessionCookie(response: NextResponse): void {
  response.cookies.set(SESSION_COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
}

export async function createSessionForUser(userId: string): Promise<{ token: string; expiresAt: Date }> {
  const token = crypto.randomBytes(32).toString("hex");
  const expiresAt = getExpiryDate();

  await prisma.session.create({
    data: {
      token,
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function destroySessionByToken(token: string): Promise<void> {
  await prisma.session.deleteMany({ where: { token } });
}

export async function getAuthUserFromRequest(request: NextRequest): Promise<AuthUser | null> {
  const token = request.cookies.get(SESSION_COOKIE_NAME)?.value;
  if (!token) return null;

  const session = await prisma.session.findFirst({
    where: {
      token,
      expiresAt: { gt: new Date() },
    },
    include: { user: true },
  });

  if (!session) {
    return null;
  }

  return {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    role: session.user.role,
  };
}

export function authOkResponse(user: AuthUser): NextResponse {
  return NextResponse.json({
    isAuthenticated: true,
    user,
  });
}

export function authEmptyResponse(): NextResponse {
  return NextResponse.json({
    isAuthenticated: false,
    user: null,
  });
}

export async function withNewSession(userId: string, payload: Record<string, unknown>): Promise<NextResponse> {
  const { token, expiresAt } = await createSessionForUser(userId);
  const response = NextResponse.json(payload);
  setSessionCookie(response, token, expiresAt);
  return response;
}

export function withClearedSession(payload: Record<string, unknown>): NextResponse {
  const response = NextResponse.json(payload);
  clearSessionCookie(response);
  return response;
}
