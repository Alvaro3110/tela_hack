import { classifyEmergencyCall } from "./classify-emergency-call";
import type { EmergencyOccurrence } from "./types";

export async function classifyTranscript(transcript: string): Promise<Partial<EmergencyOccurrence>> {
  return classifyEmergencyCall({
    transcript,
    fullTranscript: transcript,
    callMetadata: {
      callId: "manual",
      rawTranscriptTurns: [],
      fullTranscript: transcript,
      clientOnlyTranscript: transcript,
      agentOnlyTranscript: "",
      externalAgents: {},
      source: "manual",
      normalizationWarnings: []
    }
  });
}
