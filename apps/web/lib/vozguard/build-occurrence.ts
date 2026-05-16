import { getNearbySupportPoints, validateLocation } from "./location-mcp";
import type { EmergencyOccurrence, LocationConfidence, NormalizedCallInput } from "./types";

function nowIso() {
  return new Date().toISOString();
}

function riskSeverity(risk: EmergencyOccurrence["riskLevel"]): EmergencyOccurrence["timeline"][number]["severity"] {
  if (risk === "critico") return "danger";
  if (risk === "alto") return "warning";
  if (risk === "baixo") return "success";
  return "info";
}

function checklistFromTranscript(transcript: string, confidence: LocationConfidence): EmergencyOccurrence["immediateRiskChecklist"] {
  const n = transcript
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  return {
    aggressorOnSite: n.includes("ele esta aqui") ? "sim" : "desconhecido",
    canSpeakSafely: n.includes("nao posso falar") ? "nao" : "desconhecido",
    childrenOrElderly: n.includes("idoso") || n.includes("crianca") ? "sim" : "desconhecido",
    weaponMentioned: n.includes("arma") || n.includes("faca") ? "sim" : "desconhecido",
    victimCanLeave: n.includes("presa") || n.includes("trancada") ? "nao" : "desconhecido",
    locationConfirmed: confidence === "alta" ? "sim" : confidence === "desconhecida" ? "nao" : "parcial"
  };
}

function makeId(callId: string) {
  const suffix = callId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `SG-${suffix || Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function buildOccurrence(input: {
  normalized: NormalizedCallInput;
  classification: Partial<EmergencyOccurrence>;
  location: EmergencyOccurrence["location"];
  previous?: EmergencyOccurrence;
}): Promise<EmergencyOccurrence> {
  const { normalized, classification, location, previous } = input;
  const time = normalized.startedAt ?? nowIso();

  const timeline: EmergencyOccurrence["timeline"] = [...(previous?.timeline ?? [])];
  timeline.push(
    {
      time,
      label: "Webhook completo recebido e normalizado.",
      severity: "info"
    },
    {
      time: nowIso(),
      label: `Classificação VozGuard: ${classification.category ?? "indefinida"} (${classification.riskLevel ?? "indeterminado"}).`,
      severity: riskSeverity(classification.riskLevel ?? "indeterminado")
    }
  );
  if (normalized.normalizationWarnings.length) {
    timeline.push({
      time: nowIso(),
      label: `Normalização tolerante aplicou ${normalized.normalizationWarnings.length} ajuste(s).`,
      severity: "warning"
    });
  }

  const occurrence: EmergencyOccurrence = {
    id: previous?.id ?? makeId(normalized.callId),
    callId: normalized.callId,
    conversationId: normalized.conversationId,
    agentId: normalized.agentId,
    status: classification.status ?? "em_triagem",
    callStatus: normalized.callStatus,
    startedAt: normalized.startedAt,
    endedAt: normalized.endedAt,
    durationSeconds: normalized.durationSeconds,
    fromNumberMasked: normalized.fromNumberMasked,
    toNumberMasked: normalized.toNumberMasked,
    transcript: normalized.fullTranscript,
    clientTranscript: normalized.clientOnlyTranscript,
    agentTranscript: normalized.agentOnlyTranscript,
    lastMessage: normalized.lastClientMessage,
    category: classification.category ?? "indefinida",
    subcategory: classification.subcategory,
    riskLevel: classification.riskLevel ?? "indeterminado",
    riskScore: classification.riskScore ?? 45,
    aiConfidence: classification.aiConfidence ?? 60,
    reliability: classification.reliability ?? "media",
    possibleHoax: classification.possibleHoax ?? false,
    location: {
      ...location,
      rawText: normalized.clientOnlyTranscript || normalized.fullTranscript
    },
    detectedSignals: classification.detectedSignals ?? [],
    discreetCodeDetected: classification.discreetCodeDetected ?? false,
    discreetCode: classification.discreetCode,
    immediateRiskChecklist: {
      ...checklistFromTranscript(normalized.clientOnlyTranscript || normalized.fullTranscript, location.confidence),
      ...previous?.immediateRiskChecklist
    },
    externalAgents: normalized.externalAgents,
    uncertainties: classification.uncertainties ?? [],
    recommendations: classification.recommendations ?? [],
    timeline: timeline.slice(-40),
    suggestedAction: classification.suggestedAction ?? {
      resource: "Triagem adicional",
      priority: "media",
      status: "Aguardando revisão"
    },
    analysisSummary:
      classification.analysisSummary ?? "Chamada recebida e em triagem. Aguardando dados adicionais para decisão operacional.",
    supportPoints: [],
    source: normalized.source,
    normalizationWarnings: normalized.normalizationWarnings,
    simulationMode: true,
    receivedAt: previous?.receivedAt ?? time,
    updatedAt: nowIso()
  };

  const consistency = await validateLocation(occurrence);
  if (!consistency.consistent) {
    occurrence.uncertainties = Array.from(new Set([...occurrence.uncertainties, ...consistency.divergences]));
    if (occurrence.status === "recebida") {
      occurrence.status = "aguardando_validacao";
    }
  }

  occurrence.supportPoints = await getNearbySupportPoints(occurrence.location, occurrence.category);
  return occurrence;
}
