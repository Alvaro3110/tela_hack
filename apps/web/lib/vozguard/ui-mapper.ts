import type { EmergencyOccurrence } from "./types";

type ChecklistItem = {
  key: keyof EmergencyOccurrence["immediateRiskChecklist"];
  label: string;
  value: string;
};

type TimelineItem = {
  time: string;
  event: string;
  level: EmergencyOccurrence["timeline"][number]["severity"];
};

const KNOWN_CODES = [
  { phrase: "relatorio azul", meaning: "possivel perigo" },
  { phrase: "pizza chegou", meaning: "chamar ajuda" },
  { phrase: "cuidar do cachorro", meaning: "emergencia" },
  { phrase: "bolsa vermelha", meaning: "risco domestico" },
  { phrase: "a luz acabou", meaning: "pedido silencioso" }
];

function normalizeText(value?: string) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function confidence(value?: number) {
  if (typeof value !== "number" || Number.isNaN(value)) return 0;
  return Math.max(0, Math.min(100, Math.round(value)));
}

function severityLabel(riskLevel?: EmergencyOccurrence["riskLevel"]) {
  const labels: Record<string, string> = {
    baixo: "baixo",
    atencao: "atencao",
    alto: "alto",
    critico: "critica",
    indeterminado: "indeterminado"
  };

  return riskLevel ? labels[riskLevel] ?? riskLevel : "indeterminado";
}

function categoryLabel(category?: EmergencyOccurrence["category"]) {
  const labels: Record<string, string> = {
    violencia_domestica: "POSSÍVEL VIOLÊNCIA DOMÉSTICA",
    emergencia_medica: "EMERGENCIA MEDICA",
    queda_acidente: "QUEDA OU ACIDENTE",
    pessoa_perdida: "PESSOA VULNERAVEL PERDIDA",
    assalto_violencia: "ASSALTO OU VIOLENCIA",
    incendio: "INCENDIO",
    possivel_trote: "POSSIVEL TROTE",
    relato_inconsistente: "RELATO INCONSISTENTE",
    fora_escopo: "FORA DO ESCOPO EMERGENCIAL",
    indefinida: "CLASSIFICACAO INDEFINIDA"
  };

  return category ? labels[category] ?? category : "AGUARDANDO CLASSIFICACAO";
}

function statusLabel(status?: EmergencyOccurrence["status"]) {
  const labels: Record<string, string> = {
    recebida: "Recebida",
    em_triagem: "Em triagem",
    aguardando_validacao: "Aguardando validacao",
    confirmada: "Confirmada",
    inconsistente: "Inconsistente",
    sem_risco_emergencial: "Sem risco emergencial",
    encerrada: "Encerrada"
  };

  return status ? labels[status] ?? status : "Aguardando webhook";
}

function detectKnownCode(occurrence: EmergencyOccurrence) {
  const text = normalizeText(`${occurrence.discreetCode ?? ""} ${occurrence.clientTranscript} ${occurrence.transcript}`);
  const found = KNOWN_CODES.find((code) => text.includes(normalizeText(code.phrase)));

  if (occurrence.discreetCodeDetected || found) {
    return {
      detected: true,
      phrase: occurrence.discreetCode ?? found?.phrase ?? "codigo discreto",
      meaning: found?.meaning ?? "possivel pedido silencioso"
    };
  }

  return {
    detected: false,
    phrase: "Nenhum codigo discreto detectado",
    meaning: "Sem correspondencia nos codigos mockados"
  };
}

function checklist(occurrence: EmergencyOccurrence): ChecklistItem[] {
  const source = occurrence.immediateRiskChecklist ?? {};
  return [
    { key: "aggressorOnSite", label: "Agressor no local?", value: source.aggressorOnSite ?? "desconhecido" },
    { key: "canSpeakSafely", label: "Pode falar com seguranca?", value: source.canSpeakSafely ?? "desconhecido" },
    { key: "childrenOrElderly", label: "Ha criancas ou idosos?", value: source.childrenOrElderly ?? "desconhecido" },
    { key: "weaponMentioned", label: "Ha arma?", value: source.weaponMentioned ?? "desconhecido" },
    { key: "victimCanLeave", label: "Vitima consegue sair?", value: source.victimCanLeave ?? "desconhecido" },
    { key: "locationConfirmed", label: "Localizacao confirmada?", value: source.locationConfirmed ?? "nao" }
  ];
}

export type SilentGuardUiState = {
  emergencyHeader: {
    title: string;
    subtitle: string;
    severityLabel: string;
    confidence: number;
    status: string;
    incidentId: string;
    startedAt: string;
    updatedAt: string;
    silentModeRecommended: boolean;
  };
  messagePanel: {
    originalMessage: string;
    receivedAt: string;
  };
  domesticViolenceAlertCard: {
    summary: string;
    categoryLabel: string;
    detectedSignals: string[];
    priority: string;
  };
  discreetCodeDetector: {
    detected: boolean;
    phrase: string;
    meaning: string;
    knownCodes: typeof KNOWN_CODES;
  };
  silentModePanel: {
    recommended: boolean;
    active: boolean;
    options: string[];
  };
  geoLocationPanel: {
    address: string;
    city: string;
    state: string;
    source: string;
    confidence: string;
    simulated: boolean;
  };
  threatProximityChecklist: ChecklistItem[];
  confidenceAndUncertaintyPanel: {
    confidence: number;
    reasons: string[];
    uncertainties: string[];
  };
  incidentTimeline: TimelineItem[];
  dispatchSimulationPanel: {
    recommendedResource: string;
    priority: string;
    status: string;
    simulatedOnly: boolean;
  };
};

export function mapOccurrenceToSilentGuardUi(occurrence: EmergencyOccurrence | null): SilentGuardUiState | null {
  if (!occurrence) return null;

  const code = detectKnownCode(occurrence);
  const isDomestic = occurrence.category === "violencia_domestica";
  const silentModeRecommended =
    isDomestic || occurrence.discreetCodeDetected || occurrence.detectedSignals.some((signal) => normalizeText(signal).includes("agressor"));

  const detectedSignals = occurrence.detectedSignals.length
    ? occurrence.detectedSignals
    : isDomestic
      ? ["pedido silencioso", "risco domestico"]
      : ["sem sinais especificos"];

  const reasons = [
    occurrence.analysisSummary,
    ...detectedSignals.map((signal) => `Sinal detectado: ${signal}`),
    code.detected ? `Codigo discreto: ${code.phrase}` : ""
  ].filter(Boolean);

  return {
    emergencyHeader: {
      title: isDomestic ? "POSSÍVEL VIOLÊNCIA DOMÉSTICA" : categoryLabel(occurrence.category),
      subtitle: occurrence.analysisSummary || "Chamada recebida e aguardando triagem.",
      severityLabel: severityLabel(occurrence.riskLevel),
      confidence: confidence(occurrence.aiConfidence),
      status: statusLabel(occurrence.status),
      incidentId: occurrence.id || occurrence.callId,
      startedAt: occurrence.startedAt ?? occurrence.receivedAt,
      updatedAt: occurrence.updatedAt,
      silentModeRecommended
    },
    messagePanel: {
      originalMessage: occurrence.lastMessage || occurrence.clientTranscript || occurrence.transcript || "Sem mensagem recebida.",
      receivedAt: occurrence.receivedAt
    },
    domesticViolenceAlertCard: {
      summary: occurrence.analysisSummary || "Analise indisponivel.",
      categoryLabel: categoryLabel(occurrence.category),
      detectedSignals,
      priority: occurrence.suggestedAction.priority ?? "media"
    },
    discreetCodeDetector: {
      ...code,
      knownCodes: KNOWN_CODES
    },
    silentModePanel: {
      recommended: silentModeRecommended,
      active: silentModeRecommended,
      options: ["Respostas neutras ativadas", "Ocultar linguagem de emergencia", "Reduzir notificacoes visiveis"]
    },
    geoLocationPanel: {
      address:
        occurrence.location.estimatedAddress ||
        occurrence.location.rawText ||
        [occurrence.location.city, occurrence.location.state].filter(Boolean).join(", ") ||
        "Localizacao nao confirmada",
      city: occurrence.location.city ?? "Cidade nao confirmada",
      state: occurrence.location.state ?? "UF nao confirmada",
      source: occurrence.location.source ?? "none",
      confidence: occurrence.location.confidence ?? "desconhecida",
      simulated: occurrence.simulationMode
    },
    threatProximityChecklist: checklist(occurrence),
    confidenceAndUncertaintyPanel: {
      confidence: confidence(occurrence.aiConfidence),
      reasons,
      uncertainties: occurrence.uncertainties.length
        ? occurrence.uncertainties
        : ["Validacao humana final obrigatoria antes de qualquer decisao operacional."]
    },
    incidentTimeline: occurrence.timeline.map((item) => ({
      time: item.time,
      event: item.label,
      level: item.severity
    })),
    dispatchSimulationPanel: {
      recommendedResource: occurrence.suggestedAction.resource ?? "Triagem humana",
      priority: occurrence.suggestedAction.priority ?? "media",
      status: occurrence.suggestedAction.status ?? "Aguardando validacao",
      simulatedOnly: true
    }
  };
}
