import { NextRequest, NextResponse } from "next/server";
import { buildProgressBlocksForUser } from "@/lib/services/progressService";
import { requireAuth } from "@/lib/serverApi";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const data = await buildProgressBlocksForUser(auth.user!.id);
  return NextResponse.json({
    ok: true,
    blocks: data.blocks,
    preferredBlockId: data.preferredBlockId,
    noPlan: data.noPlan,
  });
}
