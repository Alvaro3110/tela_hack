import { classifyTranscript } from "./classifier";
import type { EmergencyOccurrence } from "./types";

export function analyzeOccurrence(transcript: string) {
  return classifyTranscript(transcript);
}

export function refreshOperationalBriefing(current: EmergencyOccurrence) {
  return `${current.analysisSummary} Recurso sugerido: ${current.suggestedAction.resource}.`;
}

export function updateLocationOnly(current: EmergencyOccurrence) {
  return current;
}
