export type OccurrenceStatus =
  | "recebida"
  | "em_triagem"
  | "aguardando_validacao"
  | "confirmada"
  | "inconsistente"
  | "encerrada";

export type OccurrenceCategory =
  | "violencia_domestica"
  | "emergencia_medica"
  | "queda_acidente"
  | "pessoa_perdida"
  | "assalto_violencia"
  | "incendio"
  | "possivel_trote"
  | "relato_inconsistente"
  | "indefinida";

export type RiskLevel = "baixo" | "atencao" | "alto" | "critico" | "indeterminado";

export type LocationConfidence = "baixa" | "media" | "alta" | "desconhecida";

export type LocationSource = "transcript" | "metadata" | "mcp" | "simulado";

export type BinaryOrUnknown = "sim" | "nao" | "desconhecido";

export type LocationConfirmed = "sim" | "parcial" | "nao";

export type TimelineSeverity = "info" | "warning" | "danger" | "success";

export type SupportPoint = {
  name: string;
  kind: "hospital" | "base_policial" | "estacao" | "terminal" | "farmacia" | "ponto_publico";
  city: string;
  state: string;
  distanceKm: number;
  priority: "baixa" | "media" | "alta" | "critica";
};

export type EmergencyOccurrence = {
  id: string;
  callId: string;
  status: OccurrenceStatus;

  transcript: string;
  lastMessage: string;
  receivedAt: string;
  updatedAt: string;

  category: OccurrenceCategory;

  riskLevel: RiskLevel;
  riskScore: number;
  aiConfidence: number;

  location: {
    rawText?: string;
    estimatedAddress?: string;
    city?: string;
    state?: string;
    lat?: number;
    lng?: number;
    confidence: LocationConfidence;
    source: LocationSource;
    referencePoints: string[];
  };

  detectedSignals: string[];
  discreetCodeDetected: boolean;
  discreetCode?: string;

  immediateRiskChecklist: {
    aggressorOnSite?: BinaryOrUnknown;
    canSpeakSafely?: BinaryOrUnknown;
    childrenOrElderly?: BinaryOrUnknown;
    weaponMentioned?: BinaryOrUnknown;
    victimCanLeave?: BinaryOrUnknown;
    locationConfirmed?: LocationConfirmed;
  };

  uncertainties: string[];
  recommendations: string[];
  timeline: Array<{
    time: string;
    label: string;
    severity: TimelineSeverity;
  }>;

  suggestedAction: {
    resource: string;
    priority: "baixa" | "media" | "alta" | "critica";
    status: string;
  };

  analysisSummary: string;
  supportPoints: SupportPoint[];

  partial: boolean;
  source: string;
  callerPhone?: string;
  simulationMode: boolean;
};

export type CallTranscriptWebhookPayload = {
  callId: string;
  timestamp: string;
  callerPhone?: string;
  transcript: string;
  partial: boolean;
  source: string;
  metadata?: {
    cityHint?: string;
    channel?: string;
    language?: string;
    [key: string]: string | number | boolean | undefined;
  };
};

export const DEMO_WARNING = "SIMULAÇÃO APENAS. NÃO ACIONA SERVIÇOS REAIS DE EMERGÊNCIA.";
