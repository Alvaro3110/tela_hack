export type EmergencyCategory =
  | "violencia_domestica"
  | "emergencia_medica"
  | "queda_acidente"
  | "pessoa_perdida"
  | "assalto_violencia"
  | "incendio"
  | "possivel_trote"
  | "relato_inconsistente"
  | "fora_escopo"
  | "indefinida";

export type OccurrenceStatus =
  | "recebida"
  | "em_triagem"
  | "aguardando_validacao"
  | "confirmada"
  | "inconsistente"
  | "sem_risco_emergencial"
  | "encerrada";

export type RiskLevel = "baixo" | "atencao" | "alto" | "critico" | "indeterminado";
export type ReliabilityLevel = "alta" | "media" | "baixa" | "inconsistente";
export type LocationConfidence = "baixa" | "media" | "alta" | "desconhecida";
export type LocationSource = "transcript" | "metadata" | "mcp" | "simulado" | "none";
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

export type RawCallWebhookPayload = {
  call: {
    id: string | number;
    conversation_id?: string;
    agent_id?: string;
    from_number?: string;
    to_number?: string;
    status?: string;
    started_at?: string;
    ended_at?: string;
    duration_seconds?: number;
    created_at?: string;
    updated_at?: string;
    title?: string | null;
    recipient_email?: string | null;
    email_sent_at?: string | null;
    share_token?: string | null;
    share_enabled?: boolean;
  };
  geo?: {
    from_city?: string | null;
    from_state?: string | null;
    from_country?: string | null;
    from_zip?: string | null;
  };
  counts?: {
    segments?: number;
    client_turns?: number;
    agent_turns?: number;
  };
  agents?: {
    sentiment?: {
      status?: string;
      data?: {
        label?: string;
        score?: number;
        rationale?: string;
      };
      updatedAt?: number;
      error?: string | null;
    };
    classification?: {
      status?: string;
      data?: {
        category?: string;
        tags?: string[];
      };
      updatedAt?: number;
      error?: string | null;
    };
    routing?: {
      status?: string;
      data?: {
        rationale?: string;
        teams?: string[];
      };
      updatedAt?: number;
      error?: string | null;
    };
    supervisor?: {
      status?: string;
      data?: {
        score?: number;
        strengths?: string[];
        improvements?: string[];
      };
      updatedAt?: number;
      error?: string | null;
    };
  };
  summary?: {
    summary_md?: string | null;
    summary_json?: unknown | null;
  };
  transcript: Array<{
    id: string | number;
    channel?: "system" | "mic" | string;
    speaker?: "agent" | "client" | string;
    text?: string | null;
    timestamp?: string | number | null;
  }>;
  source?: string;
};

export type NormalizedCallInput = {
  callId: string;
  conversationId?: string;
  agentId?: string;
  callStatus?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  fromNumberMasked?: string;
  toNumberMasked?: string;
  rawTranscriptTurns: Array<{
    id: string;
    speaker: string;
    channel: string;
    text: string;
    timestamp: string;
  }>;
  fullTranscript: string;
  clientOnlyTranscript: string;
  agentOnlyTranscript: string;
  lastClientMessage?: string;
  externalAgents: {
    sentiment?: {
      label?: string;
      score?: number;
      rationale?: string;
    };
    classification?: {
      category?: string;
      tags?: string[];
    };
    routing?: {
      rationale?: string;
      teams?: string[];
    };
    supervisor?: {
      score?: number;
      strengths?: string[];
      improvements?: string[];
    };
  };
  geoHint?: {
    city?: string | null;
    state?: string | null;
    country?: string | null;
    zip?: string | null;
  };
  counts?: {
    segments?: number;
    clientTurns?: number;
    agentTurns?: number;
  };
  source: string;
  summary?: {
    summaryMd?: string | null;
    summaryJson?: unknown | null;
  };
  normalizationWarnings: string[];
};

export type EmergencyOccurrence = {
  id: string;
  callId: string;
  conversationId?: string;
  agentId?: string;
  status: OccurrenceStatus;
  callStatus?: string;
  startedAt?: string;
  endedAt?: string;
  durationSeconds?: number;
  fromNumberMasked?: string;
  toNumberMasked?: string;
  transcript: string;
  clientTranscript: string;
  agentTranscript: string;
  lastMessage?: string;
  category: EmergencyCategory;
  subcategory?: string;
  riskLevel: RiskLevel;
  riskScore: number;
  aiConfidence: number;
  reliability: ReliabilityLevel;
  possibleHoax: boolean;
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
  externalAgents?: NormalizedCallInput["externalAgents"];
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
  source: string;
  normalizationWarnings: string[];
  simulationMode: boolean;
  receivedAt: string;
  updatedAt: string;
};

export const DEMO_WARNING = "SIMULAÇÃO APENAS. NÃO ACIONA SERVIÇOS REAIS DE EMERGÊNCIA.";
