import { geocodeFromTranscript, getNearbySupportPoints, validateLocation } from "./location-mcp";
import type { CallTranscriptWebhookPayload, EmergencyOccurrence, OccurrenceCategory, RiskLevel } from "./types";

type Classification = {
  category: OccurrenceCategory;
  riskLevel: RiskLevel;
  riskScore: number;
  aiConfidence: number;
  detectedSignals: string[];
  discreetCodeDetected: boolean;
  discreetCode?: string;
  uncertainties: string[];
  recommendations: string[];
  suggestedAction: EmergencyOccurrence["suggestedAction"];
  silentModeRecommended: boolean;
  analysisSummary: string;
};

const DISCREET_CODES: Record<string, string> = {
  "relatório azul": "Possível perigo imediato com agressor próximo.",
  "relatorio azul": "Possível perigo imediato com agressor próximo.",
  "pizza chegou": "Pedido silencioso de ajuda com comunicação limitada.",
  "cuidar do cachorro": "Pedido silencioso de emergência com restrição de fala.",
  "bolsa vermelha": "Sinal de risco doméstico percebido pela vítima.",
  "a luz acabou": "Possível código de ameaça no ambiente."
};

const normalize = (text: string) =>
  text
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function containsAny(text: string, options: string[]) {
  const normalized = normalize(text);
  return options.some((entry) => normalized.includes(normalize(entry)));
}

function pickSignals(text: string): string[] {
  const normalized = normalize(text);
  const signals: string[] = [];

  const signalTable: Array<[string, string[]]> = [
    ["não posso falar", ["não posso falar", "nao posso falar"]],
    ["ele está aqui", ["ele está aqui", "ele esta aqui", "ele chegou"]],
    ["pedido de ajuda", ["me ajuda", "socorro", "preciso de ajuda"]],
    ["dor no peito", ["dor no peito", "aperto no peito"]],
    ["falta de ar", ["falta de ar", "respiração curta", "nao esta respirando", "não está respirando"]],
    ["queda", ["caiu", "queda", "bateu a cabeça", "bateu a cabeca"]],
    ["desorientação", ["confuso", "desorientado", "não sabe o endereço", "nao sabe o endereco"]],
    ["assalto/ameaça", ["roubado", "assalto", "ameaça", "ameaçado", "ameacado"]],
    ["possível trote", ["era brincadeira", "só queria testar", "deixa pra lá", "deixa pra la", "já saí", "ja sai"]]
  ];

  for (const [label, tokens] of signalTable) {
    if (tokens.some((token) => normalized.includes(normalize(token)))) {
      signals.push(label);
    }
  }

  return signals;
}

export function classifyTranscript(transcript: string): Classification {
  const normalized = normalize(transcript);
  const detectedSignals = pickSignals(transcript);

  const discreetCodeEntry = Object.entries(DISCREET_CODES).find(([code]) => normalized.includes(normalize(code)));
  const discreetCodeDetected = Boolean(discreetCodeEntry);

  const violenceSilent =
    containsAny(transcript, [
      "não posso falar",
      "nao posso falar",
      "ele está aqui",
      "ele esta aqui",
      "estou presa",
      "ele vai me bater",
      "me ajuda",
      "a luz acabou"
    ]) || discreetCodeDetected;

  const medical = containsAny(transcript, [
    "dor no peito",
    "falta de ar",
    "desmaiou",
    "convulsão",
    "convulsao",
    "não está respirando",
    "nao esta respirando",
    "idoso passando mal"
  ]);

  const lost = containsAny(transcript, [
    "perdido",
    "não sei voltar",
    "nao sei voltar",
    "idoso confuso",
    "não sabe o endereço",
    "nao sabe o endereco",
    "criança sumiu",
    "crianca sumiu"
  ]);

  const hoax = containsAny(transcript, [
    "era brincadeira",
    "só queria testar",
    "so queria testar",
    "coloca qualquer número",
    "coloca qualquer numero",
    "deixa pra lá",
    "deixa pra la",
    "não vi mas deve ter",
    "nao vi mas deve ter",
    "já saí do local",
    "ja sai do local"
  ]);

  let category: OccurrenceCategory = "indefinida";
  let riskLevel: RiskLevel = "indeterminado";
  let riskScore = 40;
  let aiConfidence = 66;
  let uncertainties: string[] = [];
  let recommendations: string[] = [];
  let suggestedAction: EmergencyOccurrence["suggestedAction"] = {
    resource: "Validação humana do operador",
    priority: "media",
    status: "Aguardando revisão"
  };

  if (violenceSilent) {
    category = "violencia_domestica";
    riskLevel = "critico";
    riskScore = 94;
    aiConfidence = discreetCodeDetected ? 94 : 89;
    uncertainties = ["Presença de arma não confirmada.", "Número de pessoas no local desconhecido."];
    recommendations = [
      "Ativar protocolo de comunicação silenciosa.",
      "Evitar perguntas que exponham a vítima.",
      "Escalar para operador humano com prioridade máxima."
    ];
    suggestedAction = {
      resource: "Operador humano + Polícia Militar",
      priority: "critica",
      status: "Revisão humana obrigatória"
    };
  } else if (medical) {
    category = "emergencia_medica";
    riskLevel = "critico";
    riskScore = 92;
    aiConfidence = 90;
    uncertainties = ["Condição clínica detalhada ainda não confirmada.", "Tempo exato de evolução dos sintomas desconhecido."];
    recommendations = [
      "Manter vítima monitorada e em posição segura.",
      "Coletar sintomas críticos (consciência, respiração, dor).",
      "Priorizar encaminhamento médico com validação humana."
    ];
    suggestedAction = {
      resource: "SAMU / Ambulância",
      priority: "critica",
      status: "Aguardando validação do operador"
    };
  } else if (lost) {
    category = "pessoa_perdida";
    riskLevel = "alto";
    riskScore = 78;
    aiConfidence = 84;
    uncertainties = ["Identidade completa da pessoa não confirmada.", "Condição clínica geral pode evoluir sem aviso."];
    recommendations = [
      "Manter pessoa em local seguro e acompanhado.",
      "Buscar documento/contato de familiar sem expor a vítima.",
      "Acionar apoio local com validação humana."
    ];
    suggestedAction = {
      resource: "Guarda Municipal / PM / Apoio local",
      priority: "alta",
      status: "Aguardando validação do operador"
    };
  } else if (hoax) {
    category = "possivel_trote";
    riskLevel = "indeterminado";
    riskScore = 48;
    aiConfidence = 70;
    uncertainties = ["Relato com baixa consistência de contexto e permanência no local."];
    recommendations = [
      "Solicitar confirmação de presença no local.",
      "Revalidar ponto de referência e vítima observada.",
      "Manter caso em validação humana antes de qualquer encaminhamento."
    ];
    suggestedAction = {
      resource: "Validação humana",
      priority: "media",
      status: "Aguardando confirmação"
    };
  } else {
    category = "indefinida";
    riskLevel = "atencao";
    riskScore = 58;
    aiConfidence = 62;
    uncertainties = ["Categoria final não conclusiva com os dados atuais."];
    recommendations = ["Solicitar mais contexto objetivo (local, vítima, risco imediato).", "Manter operador humano na revisão."];
    suggestedAction = {
      resource: "Triagem adicional",
      priority: "media",
      status: "Coleta complementar necessária"
    };
  }

  const analysisSummary = `Classificação: ${category}. Nível de risco: ${riskLevel}. Confiança da IA: ${aiConfidence}%.`;

  return {
    category,
    riskLevel,
    riskScore,
    aiConfidence,
    detectedSignals,
    discreetCodeDetected,
    discreetCode: discreetCodeEntry?.[0],
    uncertainties,
    recommendations,
    suggestedAction,
    silentModeRecommended: category === "violencia_domestica" || containsAny(transcript, ["não posso falar", "nao posso falar"]),
    analysisSummary
  };
}

function mergeTranscript(previous: string | undefined, incoming: string, partial: boolean) {
  if (!previous) return incoming;
  if (!partial) return incoming;

  const cleanedPrev = previous.trim();
  const cleanedIncoming = incoming.trim();

  if (cleanedIncoming.startsWith(cleanedPrev)) return cleanedIncoming;
  if (cleanedPrev.includes(cleanedIncoming)) return cleanedPrev;

  return `${cleanedPrev}\n${cleanedIncoming}`;
}

function nowToIso() {
  return new Date().toISOString();
}

function buildChecklistFromTranscript(transcript: string, locationConfidence: EmergencyOccurrence["location"]["confidence"]) {
  const normalized = normalize(transcript);

  return {
    aggressorOnSite: normalized.includes("ele está aqui") || normalized.includes("ele esta aqui") ? "sim" : "desconhecido",
    canSpeakSafely: normalized.includes("não posso falar") || normalized.includes("nao posso falar") ? "nao" : "desconhecido",
    childrenOrElderly: normalized.includes("idoso") || normalized.includes("criança") || normalized.includes("crianca") ? "sim" : "desconhecido",
    weaponMentioned:
      normalized.includes("arma") || normalized.includes("faca") || normalized.includes("faca") || normalized.includes("revólver") || normalized.includes("revolver")
        ? "sim"
        : "desconhecido",
    victimCanLeave: normalized.includes("presa") || normalized.includes("trancada") ? "nao" : "desconhecido",
    locationConfirmed: locationConfidence === "alta" ? "sim" : locationConfidence === "media" || locationConfidence === "baixa" ? "parcial" : "nao"
  } as EmergencyOccurrence["immediateRiskChecklist"];
}

function nextStatus(partial: boolean, classification: Classification): EmergencyOccurrence["status"] {
  if (partial) return "em_triagem";
  if (classification.category === "possivel_trote" || classification.category === "relato_inconsistente") return "inconsistente";
  if (classification.riskLevel === "alto" || classification.riskLevel === "critico") return "aguardando_validacao";
  return "recebida";
}

function nextTimeline(
  previousTimeline: EmergencyOccurrence["timeline"] | undefined,
  payload: CallTranscriptWebhookPayload,
  classification: Classification,
  locationAddress: string | undefined
) {
  const timeline = previousTimeline ? [...previousTimeline] : [];

  timeline.push({
    time: payload.timestamp,
    label: payload.partial ? "Transcrição parcial recebida via webhook" : "Transcrição final recebida via webhook",
    severity: payload.partial ? "info" : "success"
  });

  timeline.push({
    time: nowToIso(),
    label: `Classificação atual: ${classification.category} (${classification.riskLevel})`,
    severity: classification.riskLevel === "critico" ? "danger" : classification.riskLevel === "alto" ? "warning" : "info"
  });

  if (locationAddress && locationAddress !== "Localização não confirmada") {
    timeline.push({
      time: nowToIso(),
      label: `Localização estimada: ${locationAddress}`,
      severity: "info"
    });
  }

  if (classification.silentModeRecommended) {
    timeline.push({
      time: nowToIso(),
      label: "Modo silencioso recomendado pela IA",
      severity: "warning"
    });
  }

  if (classification.category === "possivel_trote") {
    timeline.push({
      time: nowToIso(),
      label: "Caso marcado para validação humana por possível trote",
      severity: "warning"
    });
  }

  return timeline.slice(-30);
}

function formatOccurrenceId(callId: string) {
  const suffix = callId.replace(/[^a-zA-Z0-9]/g, "").slice(-6).toUpperCase();
  return `SG-${suffix || Math.random().toString(36).slice(2, 8).toUpperCase()}`;
}

export async function buildOccurrenceFromWebhook(
  payload: CallTranscriptWebhookPayload,
  previous?: EmergencyOccurrence
): Promise<EmergencyOccurrence> {
  const mergedTranscript = mergeTranscript(previous?.transcript, payload.transcript, payload.partial);
  const classification = classifyTranscript(mergedTranscript);
  const location = await geocodeFromTranscript(mergedTranscript, payload.metadata);

  const draftOccurrence: EmergencyOccurrence = {
    id: previous?.id ?? formatOccurrenceId(payload.callId),
    callId: payload.callId,
    status: nextStatus(payload.partial, classification),
    transcript: mergedTranscript,
    lastMessage: payload.transcript,
    receivedAt: previous?.receivedAt ?? payload.timestamp,
    updatedAt: payload.timestamp,
    category: classification.category,
    riskLevel: classification.riskLevel,
    riskScore: classification.riskScore,
    aiConfidence: classification.aiConfidence,
    location: {
      rawText: mergedTranscript,
      estimatedAddress: location.estimatedAddress,
      city: location.city,
      state: location.state,
      lat: location.lat,
      lng: location.lng,
      confidence: location.confidence,
      source: location.source,
      referencePoints: location.referencePoints
    },
    detectedSignals: classification.detectedSignals,
    discreetCodeDetected: classification.discreetCodeDetected,
    discreetCode: classification.discreetCode,
    immediateRiskChecklist: {
      ...buildChecklistFromTranscript(mergedTranscript, location.confidence),
      ...previous?.immediateRiskChecklist
    },
    uncertainties: [...classification.uncertainties],
    recommendations: [...classification.recommendations],
    timeline: nextTimeline(previous?.timeline, payload, classification, location.estimatedAddress),
    suggestedAction: classification.suggestedAction,
    analysisSummary: classification.analysisSummary,
    supportPoints: [],
    partial: payload.partial,
    source: payload.source,
    callerPhone: payload.callerPhone,
    simulationMode: true
  };

  const consistency = await validateLocation(draftOccurrence);
  if (!consistency.consistent) {
    draftOccurrence.uncertainties = [...new Set([...draftOccurrence.uncertainties, ...consistency.divergences])];
    if (draftOccurrence.status !== "inconsistente") {
      draftOccurrence.status = "aguardando_validacao";
    }
  }

  draftOccurrence.supportPoints = await getNearbySupportPoints(draftOccurrence.location, draftOccurrence.category);

  if (!payload.partial) {
    draftOccurrence.timeline.push({
      time: nowToIso(),
      label: "Triagem automática concluída. Aguardando confirmação do operador.",
      severity: draftOccurrence.status === "inconsistente" ? "warning" : "success"
    });
  }

  return draftOccurrence;
}
