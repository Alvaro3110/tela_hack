import { buildOccurrence } from "./build-occurrence";
import { classifyEmergencyCall } from "./classify-emergency-call";
import { geocodeFromTranscript } from "./location-mcp";
import { normalizeCallWebhook } from "./normalize-call-webhook";
import { getVozGuardStorage } from "./storage";
import type { EmergencyOccurrence, RawCallWebhookPayload } from "./types";

function isObj(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object";
}

export function validateWebhookPayload(payload: unknown): payload is RawCallWebhookPayload {
  if (!isObj(payload) || !isObj(payload.call) || !Array.isArray(payload.transcript)) return false;
  if (!("id" in payload.call)) return false;
  const id = payload.call.id;
  if (!(typeof id === "string" || typeof id === "number")) return false;
  if (!String(id).trim()) return false;
  if (payload.transcript.length === 0) return false;

  return payload.transcript.every((turn) => isObj(turn) && "id" in turn);
}

export async function ingestWebhook(payload: RawCallWebhookPayload): Promise<EmergencyOccurrence> {
  const storage = getVozGuardStorage();
  storage.saveWebhookEvent(payload);

  const normalized = normalizeCallWebhook(payload);

  const classification = await classifyEmergencyCall({
    transcript: normalized.clientOnlyTranscript,
    fullTranscript: normalized.fullTranscript,
    callMetadata: normalized
  });

  const location = await geocodeFromTranscript(normalized.clientOnlyTranscript || normalized.fullTranscript, {
    cityHint: normalized.geoHint?.city,
    stateHint: normalized.geoHint?.state,
    countryHint: normalized.geoHint?.country,
    zipHint: normalized.geoHint?.zip
  });

  const previous = storage.getOccurrence(normalized.callId) ?? undefined;

  const occurrence = await buildOccurrence({
    normalized,
    classification,
    location,
    previous
  });

  storage.upsertOccurrence(occurrence);
  return occurrence;
}

export function getLatestOccurrence() {
  return getVozGuardStorage().getLatestOccurrence();
}

export function getOccurrenceByCallId(callId: string) {
  return getVozGuardStorage().getOccurrence(callId);
}

export function patchOccurrence(
  callId: string,
  patch: {
    checklist?: EmergencyOccurrence["immediateRiskChecklist"];
    status?: EmergencyOccurrence["status"];
    suggestedActionStatus?: string;
    timelineLabel?: string;
    timelineSeverity?: EmergencyOccurrence["timeline"][number]["severity"];
  }
) {
  return getVozGuardStorage().patchOccurrence(callId, patch);
}
