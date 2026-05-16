import { classifyTranscript } from "./classifier";

export async function analyzeOccurrence(transcript: string) {
  return classifyTranscript(transcript);
}
