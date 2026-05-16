import { NextResponse } from "next/server";
import { getOccurrenceByCallId, patchOccurrence } from "../../../../lib/vozguard/service";
import type { EmergencyOccurrence } from "../../../../lib/vozguard/types";

export const runtime = "nodejs";

type RouteCtx = {
  params: Promise<{ callId: string }>;
};

export async function GET(_: Request, ctx: RouteCtx) {
  try {
    const { callId } = await ctx.params;
    const occurrence = getOccurrenceByCallId(callId);

    if (!occurrence) {
      return NextResponse.json({ ok: false, error: "Ocorrência não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, occurrence });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Falha ao buscar ocorrência.",
        details: error instanceof Error ? error.message : "erro desconhecido"
      },
      { status: 500 }
    );
  }
}

export async function PATCH(req: Request, ctx: RouteCtx) {
  try {
    const { callId } = await ctx.params;
    const payload = (await req.json()) as {
      checklist?: EmergencyOccurrence["immediateRiskChecklist"];
      status?: EmergencyOccurrence["status"];
      suggestedActionStatus?: string;
      timelineLabel?: string;
      timelineSeverity?: EmergencyOccurrence["timeline"][number]["severity"];
    };

    const occurrence = patchOccurrence(callId, payload);

    if (!occurrence) {
      return NextResponse.json({ ok: false, error: "Ocorrência não encontrada." }, { status: 404 });
    }

    return NextResponse.json({ ok: true, occurrence });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Falha ao atualizar ocorrência.",
        details: error instanceof Error ? error.message : "erro desconhecido"
      },
      { status: 500 }
    );
  }
}
