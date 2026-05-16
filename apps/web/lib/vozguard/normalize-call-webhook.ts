import { maskPhone, sanitizeTranscript } from "./privacy";
import type { NormalizedCallInput, RawCallWebhookPayload } from "./types";

function isClientTurn(turn: RawCallWebhookPayload["transcript"][number]) {
  return turn.speaker === "client" || turn.channel === "mic";
}

function isAgentTurn(turn: RawCallWebhookPayload["transcript"][number]) {
  return turn.speaker === "agent" || turn.channel === "system";
}

export function normalizeCallWebhook(payload: RawCallWebhookPayload): NormalizedCallInput {
  const turns = Array.isArray(payload.transcript) ? payload.transcript : [];

  const rawTranscriptTurns = turns.map((turn) => ({
    id: turn.id,
    speaker: turn.speaker,
    channel: turn.channel,
    text: sanitizeTranscript(turn.text ?? ""),
    timestamp: turn.timestamp
  }));

  const fullTranscript = rawTranscriptTurns
    .map((turn) => {
      const label = turn.speaker === "client" || turn.channel === "mic" ? "Cliente" : "Atendente";
      return `${label}: ${turn.text}`;
    })
    .join("\n");

  const clientOnlyTranscript = rawTranscriptTurns
    .filter((turn) => isClientTurn(turn as RawCallWebhookPayload["transcript"][number]))
    .map((turn) => turn.text)
    .join("\n");

  const agentOnlyTranscript = rawTranscriptTurns
    .filter((turn) => isAgentTurn(turn as RawCallWebhookPayload["transcript"][number]))
    .map((turn) => turn.text)
    .join("\n");

  const lastClientMessage = [...rawTranscriptTurns]
    .reverse()
    .find((turn) => isClientTurn(turn as RawCallWebhookPayload["transcript"][number]))?.text;

  return {
    callId: payload.call.id,
    conversationId: payload.call.conversation_id,
    agentId: payload.call.agent_id,
    callStatus: payload.call.status,
    startedAt: payload.call.started_at,
    endedAt: payload.call.ended_at,
    durationSeconds: payload.call.duration_seconds,
    fromNumberMasked: maskPhone(payload.call.from_number),
    toNumberMasked: maskPhone(payload.call.to_number),
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
      segments: payload.counts?.segments,
      clientTurns: payload.counts?.client_turns,
      agentTurns: payload.counts?.agent_turns
    },
    source: "external-transcriber",
    summary: {
      summaryMd: payload.summary?.summary_md,
      summaryJson: payload.summary?.summary_json
    }
  };
}
