import { buildOccurrenceFromWebhook } from "./classifier";
import { getVozGuardStorage } from "./storage";
import type { CallTranscriptWebhookPayload, EmergencyOccurrence } from "./types";

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

export function validateWebhookPayload(payload: unknown): payload is CallTranscriptWebhookPayload {
  if (!payload || typeof payload !== "object") return false;

  const input = payload as Partial<CallTranscriptWebhookPayload>;

  return (
    isNonEmptyString(input.callId) &&
    isNonEmptyString(input.timestamp) &&
    isNonEmptyString(input.transcript) &&
    typeof input.partial === "boolean" &&
    isNonEmptyString(input.source)
  );
}

export async function ingestWebhook(payload: CallTranscriptWebhookPayload): Promise<EmergencyOccurrence> {
  const storage = getVozGuardStorage();
  storage.saveWebhookEvent(payload);

  const previous = storage.getOccurrence(payload.callId) ?? undefined;
  const occurrence = await buildOccurrenceFromWebhook(payload, previous);

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
