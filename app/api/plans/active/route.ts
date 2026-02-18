import { NextRequest, NextResponse } from "next/server";
import { requireAuthUser } from "@/lib/apiRoute";
import { getActivePlanForUser } from "@/lib/services/planService";

export async function GET(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.user) return auth.response;

  const plan = await getActivePlanForUser(auth.user.id);
  return NextResponse.json({
    ok: true,
    activePlan: plan
      ? {
          id: plan.id,
          sourceFileName: plan.sourceFileName,
          importedAtISO: plan.importedAt.toISOString(),
          planV1: plan.planV1,
        }
      : null,
  });
}

