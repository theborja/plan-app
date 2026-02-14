"use client";

import { useEffect, useRef, useState } from "react";
import { parseArrayBufferToPlanV1 } from "@/lib/parsers/parseWorkbookPlan";
import {
  loadPlanV1,
  loadSelectionsV1,
  loadSettingsV1,
  savePlanV1,
} from "@/lib/storage";

export default function PlanBootstrap() {
  const [message, setMessage] = useState<string | null>(null);
  const didRunRef = useRef(false);

  useEffect(() => {
    if (didRunRef.current) return;
    didRunRef.current = true;

    const run = async () => {
      try {
        loadSettingsV1();
        loadSelectionsV1();

        const currentPlan = loadPlanV1();
        if (currentPlan) {
          return;
        }

        const response = await fetch("/default-plan.xlsx", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("No se pudo descargar /default-plan.xlsx");
        }

        const buffer = await response.arrayBuffer();
        const parsed = parseArrayBufferToPlanV1(buffer, "default-plan.xlsx");
        savePlanV1(parsed);
        setMessage("Plan base cargado");
      } catch (error) {
        const text = error instanceof Error ? error.message : "Error desconocido";
        setMessage(`Error cargando plan base: ${text}`);
      }
    };

    void run();
  }, []);

  if (!message) {
    return null;
  }

  return (
    <div className="mx-4 mt-3 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
      {message}
    </div>
  );
}
