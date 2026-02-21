import { NextRequest, NextResponse } from "next/server";
import { buildProgressBlocksForUser } from "@/lib/services/progressService";
import { requireAuth } from "@/lib/serverApi";

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ blockId: string }> },
) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const { blockId } = await context.params;
  const data = await buildProgressBlocksForUser(auth.user!.id);
  const block = data.blocks.find((item) => item.blockId === blockId) ?? null;

  return NextResponse.json({
    ok: true,
    block,
    blocks: data.blocks,
    preferredBlockId: data.preferredBlockId,
    noPlan: data.noPlan,
  });
}
