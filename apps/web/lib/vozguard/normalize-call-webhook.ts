import { maskPhone, sanitizeTranscript } from "./privacy";
import type { NormalizedCallInput, RawCallWebhookPayload } from "./types";

function toSafeString(value: unknown) {
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return "";
}

function isClientTurn(turn: NormalizedCallInput["rawTranscriptTurns"][number]) {
  return turn.speaker === "client" || turn.channel === "mic";
}

function isAgentTurn(turn: NormalizedCallInput["rawTranscriptTurns"][number]) {
  return turn.speaker === "agent" || turn.channel === "system";
}

function normalizeTimestamp(value: unknown) {
  if (typeof value === "number") return new Date(value).toISOString();
  if (typeof value === "string" && value.trim()) return value;
  return new Date().toISOString();
}

export function normalizeCallWebhook(payload: RawCallWebhookPayload): NormalizedCallInput {
  const warnings: string[] = [];
  const turns = Array.isArray(payload.transcript) ? payload.transcript : [];
  if (!Array.isArray(payload.transcript)) {
    warnings.push("Campo transcript ausente ou inválido. Usando lista vazia.");
  }

  const rawTranscriptTurns = turns.map((turn, index) => {
    const id = toSafeString(turn.id) || `turn-${index + 1}`;
    if (!toSafeString(turn.id)) warnings.push(`Turn ${index + 1}: id ausente. Gerado ${id}.`);

    const speaker = toSafeString(turn.speaker).toLowerCase() || "unknown";
    const channel = toSafeString(turn.channel).toLowerCase() || "unknown";
    if (speaker === "unknown") warnings.push(`Turn ${id}: speaker ausente.`);
    if (channel === "unknown") warnings.push(`Turn ${id}: channel ausente.`);

    const text = sanitizeTranscript(toSafeString(turn.text));
    if (!text.trim()) warnings.push(`Turn ${id}: texto vazio.`);

    const timestamp = normalizeTimestamp(turn.timestamp);
    if (!toSafeString(turn.timestamp)) warnings.push(`Turn ${id}: timestamp ausente, fallback aplicado.`);

    return { id, speaker, channel, text, timestamp };
  });

  const fullTranscript = rawTranscriptTurns
    .map((turn) => {
      const label = turn.speaker === "client" || turn.channel === "mic" ? "Cliente" : "Atendente";
      return `${label}: ${turn.text}`;
    })
    .join("\n");

  const clientOnlyTranscript = rawTranscriptTurns
    .filter((turn) => isClientTurn(turn))
    .map((turn) => turn.text)
    .join("\n");

  const agentOnlyTranscript = rawTranscriptTurns
    .filter((turn) => isAgentTurn(turn))
    .map((turn) => turn.text)
    .join("\n");

  const lastClientMessage = [...rawTranscriptTurns]
    .reverse()
    .find((turn) => isClientTurn(turn))?.text;

  const callId = toSafeString(payload.call?.id).trim();
  if (!callId) {
    warnings.push("call.id ausente. Usando fallback CALL-UNKNOWN.");
  }

  return {
    callId: callId || "CALL-UNKNOWN",
    conversationId: toSafeString(payload.call?.conversation_id) || undefined,
    agentId: toSafeString(payload.call?.agent_id) || undefined,
    callStatus: toSafeString(payload.call?.status) || undefined,
    startedAt: toSafeString(payload.call?.started_at) || undefined,
    endedAt: toSafeString(payload.call?.ended_at) || undefined,
    durationSeconds: typeof payload.call?.duration_seconds === "number" ? payload.call.duration_seconds : undefined,
    fromNumberMasked: maskPhone(toSafeString(payload.call?.from_number) || undefined),
    toNumberMasked: maskPhone(toSafeString(payload.call?.to_number) || undefined),
    rawTranscriptTurns,
    fullTranscript,
    clientOnlyTranscript,
    agentOnlyTranscript,
    lastClientMessage,
    externalAgents: {
      sentiment: payload.agents?.sentiment?.data,
      classification: payload.agents?.classification?.data,
      routing: payload.agents?.routing?.data,
      supervisor: payload.agents?.supervisor?.data
    },
    geoHint: {
      city: payload.geo?.from_city,
      state: payload.geo?.from_state,
      country: payload.geo?.from_country,
      zip: payload.geo?.from_zip
    },
    counts: {
      segments: typeof payload.counts?.segments === "number" ? payload.counts?.segments : undefined,
      clientTurns: typeof payload.counts?.client_turns === "number" ? payload.counts?.client_turns : undefined,
      agentTurns: typeof payload.counts?.agent_turns === "number" ? payload.counts?.agent_turns : undefined
    },
    source: toSafeString(payload.source) || "external-transcriber",
    summary: {
      summaryMd: payload.summary?.summary_md,
      summaryJson: payload.summary?.summary_json
    },
    normalizationWarnings: Array.from(new Set(warnings))
  };
}
