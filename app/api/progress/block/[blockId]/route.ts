import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiRoute";
import { getProgressBlock } from "@/lib/services/progressService";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ blockId: string }> },
) {
  const auth = await requireAuthUser(request);
  if (!auth.user) return auth.response;

  const { blockId } = await context.params;
  const block = await getProgressBlock(auth.user.id, blockId);
  if (!block) {
    return NextResponse.json({ ok: false, message: "Bloque no encontrado." }, { status: 404 });
  }

  return NextResponse.json({ ok: true, block });
}

