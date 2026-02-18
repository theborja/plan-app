import { NextRequest, NextResponse } from "next/server";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/db";
import { withNewSession } from "@/lib/serverAuth";

type RegisterBody = {
  email?: string;
  password?: string;
  name?: string;
};

function normalizeIdentity(input: string): string {
  return input.trim().toLowerCase();
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as RegisterBody;
  const email = normalizeIdentity(body.email ?? "");
  const password = body.password ?? "";
  const name = (body.name ?? "").trim() || email;

  if (!email || !password) {
    return NextResponse.json(
      { ok: false, message: "Email y password son obligatorios." },
      { status: 400 },
    );
  }

  if (password.length < 4) {
    return NextResponse.json(
      { ok: false, message: "La password debe tener al menos 4 caracteres." },
      { status: 400 },
    );
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json(
      { ok: false, message: "Ese usuario ya existe." },
      { status: 409 },
    );
  }

  const totalUsers = await prisma.user.count();
  const role = totalUsers === 0 ? "ADMIN" : "USER";
  const passwordHash = await bcrypt.hash(password, 10);

  const user = await prisma.user.create({
    data: {
      email,
      passwordHash,
      name,
      role,
    },
  });

  return withNewSession(user.id, {
    ok: true,
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
  });
}
