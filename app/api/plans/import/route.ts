import { NextRequest, NextResponse } from "next/server";
import { badRequest, forbidden, requireAuthUser } from "@/lib/apiRoute";
import { importPlanForUser } from "@/lib/services/planService";
import { isPlanV1 } from "@/lib/validate";

type ImportBody = {
  sourceFileName?: string;
  plan?: unknown;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.user) return auth.response;
  if (auth.user.role !== "ADMIN") return forbidden();

  const body = (await request.json().catch(() => ({}))) as ImportBody;
  const sourceFileName = (body.sourceFileName ?? "").trim();

  if (!sourceFileName) {
    return badRequest("sourceFileName es obligatorio.");
  }

  if (!isPlanV1(body.plan)) {
    return badRequest("plan invalido.");
  }

  const created = await importPlanForUser({
    userId: auth.user.id,
    sourceFileName,
    plan: body.plan,
  });

  return NextResponse.json({
    ok: true,
    plan: {
      id: created.id,
      sourceFileName: created.sourceFileName,
      importedAtISO: created.importedAt.toISOString(),
    },
  });
}

