import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiRoute";
import { getPlanHistoryForUser } from "@/lib/services/planService";

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.user) return auth.response;

  const history = await getPlanHistoryForUser(auth.user.id);
  return NextResponse.json({ ok: true, history });
}

