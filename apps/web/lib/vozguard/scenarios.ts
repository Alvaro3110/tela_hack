import type { RawCallWebhookPayload } from "./types";

type ScenarioPayload = {
  id: string;
  title: string;
  payload: RawCallWebhookPayload;
};

const now = () => new Date().toISOString();

function baseCall(id: string) {
  return {
    id,
    conversation_id: `conv-${id}`,
    agent_id: "agt-001",
    from_number: "+55 11 99999-9999",
    to_number: "+55 11 4000-0000",
    status: "completed",
    started_at: now(),
    duration_seconds: 180,
    created_at: now(),
    updated_at: now()
  };
}

export const WEBHOOK_SCENARIOS: ScenarioPayload[] = [
  {
    id: "logistica-out-of-scope",
    title: "Logística (fora de escopo)",
    payload: {
      call: baseCall("CALL-LOG-001"),
      geo: { from_city: "São Paulo", from_state: "SP", from_country: "BR" },
      counts: { segments: 4, client_turns: 2, agent_turns: 2 },
      agents: {
        classification: { data: { category: "Logística e Entrega", tags: ["entrega", "pedido"] } },
        sentiment: { data: { label: "neutro", score: 0.52, rationale: "Cliente sem sinais de urgência." } }
      },
      summary: { summary_md: "Cliente relata atraso na entrega e pede protocolo." },
      transcript: [
        { id: "1", channel: "system", speaker: "agent", text: "Central de atendimento, como posso ajudar?", timestamp: now() },
        { id: "2", channel: "mic", speaker: "client", text: "Meu pedido está com atraso na entrega e o rastreio indisponível.", timestamp: now() },
        { id: "3", channel: "system", speaker: "agent", text: "Entendi, vou localizar o protocolo.", timestamp: now() },
        { id: "4", channel: "mic", speaker: "client", text: "Obrigado, só preciso do status do produto.", timestamp: now() }
      ]
    }
  },
  {
    id: "silent-domestic",
    title: "Violência doméstica silenciosa",
    payload: {
      call: baseCall("CALL-VD-001"),
      geo: { from_city: "São Paulo", from_state: "SP", from_country: "BR" },
      counts: { segments: 4, client_turns: 2, agent_turns: 2 },
      agents: { sentiment: { data: { label: "medo", score: 0.93, rationale: "Tonalidade de urgência e medo." } } },
      summary: { summary_md: "Cliente não pode falar livremente e relata agressor próximo." },
      transcript: [
        { id: "1", channel: "system", speaker: "agent", text: "Pode me dizer o que está acontecendo?", timestamp: now() },
        {
          id: "2",
          channel: "mic",
          speaker: "client",
          text: "Não posso falar agora. Ele está aqui. Estou na Rua das Flores, Centro, São Paulo.",
          timestamp: now()
        },
        { id: "3", channel: "system", speaker: "agent", text: "Você está em local seguro?", timestamp: now() },
        { id: "4", channel: "mic", speaker: "client", text: "Preciso do relatório azul.", timestamp: now() }
      ]
    }
  },
  {
    id: "medical-emergency",
    title: "Emergência médica",
    payload: {
      call: baseCall("CALL-MED-001"),
      geo: { from_city: "São Paulo", from_state: "SP", from_country: "BR" },
      counts: { segments: 4, client_turns: 2, agent_turns: 2 },
      transcript: [
        { id: "1", channel: "system", speaker: "agent", text: "Qual é a situação?", timestamp: now() },
        {
          id: "2",
          channel: "mic",
          speaker: "client",
          text: "Meu avô está com dor no peito, falta de ar, está suando muito e pálido perto da Estação Sé.",
          timestamp: now()
        },
        { id: "3", channel: "system", speaker: "agent", text: "Ele está consciente?", timestamp: now() },
        { id: "4", channel: "mic", speaker: "client", text: "Sim, mas está fraco.", timestamp: now() }
      ]
    }
  },
  {
    id: "lost-elderly",
    title: "Idoso perdido",
    payload: {
      call: baseCall("CALL-LOST-001"),
      geo: { from_city: "Salvador", from_state: "BA", from_country: "BR" },
      counts: { segments: 4, client_turns: 2, agent_turns: 2 },
      transcript: [
        { id: "1", channel: "system", speaker: "agent", text: "Pode descrever a ocorrência?", timestamp: now() },
        {
          id: "2",
          channel: "mic",
          speaker: "client",
          text: "Tem um idoso confuso e perdido perto do Mercado Modelo, na Praça Visconde de Cayru.",
          timestamp: now()
        },
        { id: "3", channel: "system", speaker: "agent", text: "Ele está sozinho?", timestamp: now() },
        { id: "4", channel: "mic", speaker: "client", text: "Sim, sem documento e muito desorientado.", timestamp: now() }
      ]
    }
  },
  {
    id: "possible-hoax",
    title: "Possível trote",
    payload: {
      call: baseCall("CALL-TRT-001"),
      geo: { from_city: "São Paulo", from_state: "SP", from_country: "BR" },
      counts: { segments: 4, client_turns: 2, agent_turns: 2 },
      transcript: [
        { id: "1", channel: "system", speaker: "agent", text: "Qual é a emergência?", timestamp: now() },
        {
          id: "2",
          channel: "mic",
          speaker: "client",
          text: "Tem um senhor caído na Praça da Sé, mas já saí do local. Acho que levantou. Deixa pra lá.",
          timestamp: now()
        },
        { id: "3", channel: "system", speaker: "agent", text: "Você consegue confirmar a vítima?", timestamp: now() },
        { id: "4", channel: "mic", speaker: "client", text: "Era brincadeira, só queria testar.", timestamp: now() }
      ]
    }
  }
];

export function cloneScenarioPayload(scenario: ScenarioPayload): RawCallWebhookPayload {
  const next = structuredClone(scenario.payload);
  next.call.started_at = now();
  next.call.updated_at = now();
  next.transcript = next.transcript.map((turn) => ({ ...turn, timestamp: now() }));
  return next;
}
