import { NextRequest, NextResponse } from "next/server";
import { badRequest, isISODate, requireAuthUser } from "@/lib/apiRoute";
import { saveNutritionSelection } from "@/lib/services/nutritionService";

type SelectionBody = {
  dateISO?: string;
  selectedDayOptionIndex?: number | null;
  done?: boolean;
  note?: string;
};

export async function POST(request: NextRequest) {
  const auth = await requireAuthUser(request);
  if (!auth.user) return auth.response;

  const body = (await request.json().catch(() => ({}))) as SelectionBody;
  const dateISO = body.dateISO ?? "";
  if (!isISODate(dateISO)) {
    return badRequest("dateISO invalido. Usa YYYY-MM-DD.");
  }

  const selection = await saveNutritionSelection({
    userId: auth.user.id,
    dateISO,
    selectedDayOptionIndex:
      typeof body.selectedDayOptionIndex === "number" && Number.isFinite(body.selectedDayOptionIndex)
        ? Math.max(1, Math.floor(body.selectedDayOptionIndex))
        : null,
    done: Boolean(body.done),
    note: typeof body.note === "string" ? body.note : "",
  });

  return NextResponse.json({ ok: true, selection });
}

