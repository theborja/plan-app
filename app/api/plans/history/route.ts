import { NextRequest, NextResponse } from "next/server";
import { getPlanHistory } from "@/lib/services/planService";
import { requireAuth } from "@/lib/serverApi";

export async function GET(request: NextRequest) {
  const auth = await requireAuth(request);
  if (auth.response) return auth.response;

  const history = await getPlanHistory(auth.user!.id);
  return NextResponse.json({ ok: true, history });
}