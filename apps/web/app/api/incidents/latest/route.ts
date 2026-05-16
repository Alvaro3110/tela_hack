import { NextResponse } from "next/server";
import { getLatestOccurrence } from "../../../../lib/vozguard/service";

export const runtime = "nodejs";

export async function GET() {
  try {
    const occurrence = getLatestOccurrence();
    return NextResponse.json({ ok: true, occurrence });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Falha ao buscar ocorrência mais recente.",
        details: error instanceof Error ? error.message : "erro desconhecido"
      },
      { status: 500 }
    );
  }
}
