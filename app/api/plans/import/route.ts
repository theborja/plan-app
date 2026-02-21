import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseArrayBufferToPlanV1 } from "@/lib/parsers/parseWorkbookPlan";
import { importPlanForUser } from "@/lib/services/planService";
import { jsonError, requireAdmin } from "@/lib/serverApi";

export async function POST(request: NextRequest) {
  const auth = await requireAdmin(request);
  if (auth.response) return auth.response;

  const form = await request.formData();
  const targetUserId = String(form.get("targetUserId") ?? "").trim();
  const file = form.get("file");

  if (!targetUserId) {
    return jsonError("targetUserId es obligatorio.", 400);
  }

  if (!(file instanceof File)) {
    return jsonError("file es obligatorio.", 400);
  }

  const target = await prisma.user.findUnique({ where: { id: targetUserId }, select: { id: true } });
  if (!target) {
    return jsonError("Usuario destino no encontrado.", 404);
  }

  try {
    const buffer = await file.arrayBuffer();
    const parsed = parseArrayBufferToPlanV1(buffer, file.name);
    const created = await importPlanForUser({
      targetUserId,
      importedByUserId: auth.user!.id,
      parsedPlan: parsed,
    });

    return NextResponse.json({ ok: true, planId: created.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "No se pudo importar el plan.";
    return jsonError(message, 400);
  }
}