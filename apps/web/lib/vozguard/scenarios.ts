import type { CallTranscriptWebhookPayload } from "./types";

type ScenarioPayload = {
  id: string;
  title: string;
  payload: CallTranscriptWebhookPayload;
};

const now = () => new Date().toISOString();

export const WEBHOOK_SCENARIOS: ScenarioPayload[] = [
  {
    id: "silent-domestic",
    title: "Violência doméstica silenciosa",
    payload: {
      callId: "CALL-VD-001",
      timestamp: now(),
      callerPhone: "+55 11 99999-9999",
      transcript: "Não posso falar agora. Ele está aqui. Estou na Rua das Flores, Centro, São Paulo.",
      partial: false,
      source: "external-phone-transcriber",
      metadata: {
        cityHint: "São Paulo",
        channel: "phone",
        language: "pt-BR"
      }
    }
  },
  {
    id: "discreet-code",
    title: "Código discreto",
    payload: {
      callId: "CALL-VD-002",
      timestamp: now(),
      callerPhone: "+55 11 98888-8888",
      transcript: "Preciso do relatório azul. Pode vir aqui agora? Estou perto da Praça da Sé.",
      partial: false,
      source: "external-phone-transcriber",
      metadata: {
        cityHint: "São Paulo",
        channel: "phone",
        language: "pt-BR"
      }
    }
  },
  {
    id: "medical-emergency",
    title: "Emergência médica",
    payload: {
      callId: "CALL-MED-001",
      timestamp: now(),
      callerPhone: "+55 11 97777-7777",
      transcript: "Meu avô está com dor no peito, falta de ar e está suando muito. Estamos perto da Estação Sé.",
      partial: false,
      source: "external-phone-transcriber",
      metadata: {
        cityHint: "São Paulo",
        channel: "phone",
        language: "pt-BR"
      }
    }
  },
  {
    id: "possible-hoax",
    title: "Possível trote",
    payload: {
      callId: "CALL-TRT-001",
      timestamp: now(),
      callerPhone: "+55 11 96666-6666",
      transcript: "Tem um senhor caído na Praça da Sé. Acho que caiu, mas já saí do local. Deve ter levantado. Deixa pra lá.",
      partial: false,
      source: "external-phone-transcriber",
      metadata: {
        cityHint: "São Paulo",
        channel: "phone",
        language: "pt-BR"
      }
    }
  },
  {
    id: "unknown-location",
    title: "Localização desconhecida",
    payload: {
      callId: "CALL-UNK-001",
      timestamp: now(),
      callerPhone: "+55 11 95555-5555",
      transcript: "Tem alguém em perigo aqui, não sei o endereço e não conheço essa região.",
      partial: false,
      source: "external-phone-transcriber",
      metadata: {
        cityHint: "São Paulo",
        channel: "phone",
        language: "pt-BR"
      }
    }
  },
  {
    id: "partial-update",
    title: "Transcrição parcial",
    payload: {
      callId: "CALL-VD-001",
      timestamp: now(),
      callerPhone: "+55 11 99999-9999",
      transcript: "Não posso falar agora. Ele está aqui. Estou na Rua das Flores, Centro.",
      partial: true,
      source: "external-phone-transcriber",
      metadata: {
        cityHint: "São Paulo",
        channel: "phone",
        language: "pt-BR"
      }
    }
  }
];

export function cloneScenarioPayload(scenario: ScenarioPayload): CallTranscriptWebhookPayload {
  return {
    ...scenario.payload,
    timestamp: now()
  };
}
