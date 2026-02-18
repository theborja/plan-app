import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiRoute";
import { getProgressBlocks } from "@/lib/services/progressService";

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.user) return auth.response;

  const blocks = await getProgressBlocks(auth.user.id);
  return NextResponse.json({ ok: true, blocks });
}

