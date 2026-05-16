import { NextResponse } from "next/server";
import { ingestWebhook, validateWebhookPayload } from "../../../../lib/vozguard/service";

export const runtime = "nodejs";

export async function POST(req: Request) {
  try {
    const payload = await req.json();

    if (!validateWebhookPayload(payload)) {
      return NextResponse.json(
        {
          ok: false,
          error: "Payload inválido. Campos obrigatórios: callId, timestamp, transcript, partial, source."
        },
        { status: 400 }
      );
    }

    const occurrence = await ingestWebhook(payload);
    return NextResponse.json({ ok: true, occurrence });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: "Falha ao processar webhook.",
        details: error instanceof Error ? error.message : "erro desconhecido"
      },
      { status: 500 }
    );
  }
}
