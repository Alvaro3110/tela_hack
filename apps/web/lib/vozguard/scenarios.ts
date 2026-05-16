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
    id: "silent-domestic",
    title: "Demo principal — pedido silencioso",
    payload: {
      call: baseCall("CALL-VD-001"),
      geo: { from_city: "São Paulo", from_state: "SP", from_country: "BR" },
      counts: { segments: 4, client_turns: 2, agent_turns: 2 },
      agents: {
        sentiment: { data: { label: "medo", score: 0.93, rationale: "Tonalidade de urgência e medo." } },
        classification: { data: { category: "violencia_domestica", tags: ["pedido_silencioso", "risco_domestico"] } },
        routing: { data: { rationale: "Triagem humana silenciosa recomendada.", teams: ["operacao", "validacao_humana"] } }
      },
      summary: { summary_md: "Cliente não pode falar livremente, relata agressor próximo e usa código discreto." },
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
    id: "logistica-out-of-scope",
    title: "Logistica (fora de escopo)",
    payload: {
      call: baseCall("CALL-LOG-001"),
      geo: { from_city: "Sao Paulo", from_state: "SP", from_country: "BR" },
      counts: { segments: 4, client_turns: 2, agent_turns: 2 },
      agents: {
        classification: { data: { category: "Logistica e Entrega", tags: ["entrega", "pedido"] } },
        sentiment: { data: { label: "neutro", score: 0.52, rationale: "Cliente sem sinais de urgencia." } }
      },
      summary: { summary_md: "Cliente relata atraso na entrega e pede protocolo." },
      transcript: [
        { id: "1", channel: "system", speaker: "agent", text: "Central de atendimento, como posso ajudar?", timestamp: now() },
        { id: "2", channel: "mic", speaker: "client", text: "Meu pedido esta com atraso na entrega e o rastreio indisponivel.", timestamp: now() },
        { id: "3", channel: "system", speaker: "agent", text: "Entendi, vou localizar o protocolo.", timestamp: now() },
        { id: "4", channel: "mic", speaker: "client", text: "Obrigado, so preciso do status do produto.", timestamp: now() }
      ]
    }
  },
  {
    id: "medical-emergency",
    title: "Emergencia medica",
    payload: {
      call: baseCall("CALL-MED-001"),
      geo: { from_city: "Sao Paulo", from_state: "SP", from_country: "BR" },
      counts: { segments: 4, client_turns: 2, agent_turns: 2 },
      transcript: [
        { id: "1", channel: "system", speaker: "agent", text: "Qual e a situacao?", timestamp: now() },
        {
          id: "2",
          channel: "mic",
          speaker: "client",
          text: "Meu avo esta com dor no peito, falta de ar, esta suando muito e palido perto da Estacao Se.",
          timestamp: now()
        },
        { id: "3", channel: "system", speaker: "agent", text: "Ele esta consciente?", timestamp: now() },
        { id: "4", channel: "mic", speaker: "client", text: "Sim, mas esta fraco.", timestamp: now() }
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
        { id: "1", channel: "system", speaker: "agent", text: "Pode descrever a ocorrencia?", timestamp: now() },
        {
          id: "2",
          channel: "mic",
          speaker: "client",
          text: "Tem um idoso confuso e perdido perto do Mercado Modelo, na Praca Visconde de Cayru.",
          timestamp: now()
        },
        { id: "3", channel: "system", speaker: "agent", text: "Ele esta sozinho?", timestamp: now() },
        { id: "4", channel: "mic", speaker: "client", text: "Sim, sem documento e muito desorientado.", timestamp: now() }
      ]
    }
  },
  {
    id: "possible-hoax",
    title: "Possivel trote",
    payload: {
      call: baseCall("CALL-TRT-001"),
      geo: { from_city: "Sao Paulo", from_state: "SP", from_country: "BR" },
      counts: { segments: 4, client_turns: 2, agent_turns: 2 },
      transcript: [
        { id: "1", channel: "system", speaker: "agent", text: "Qual e a emergencia?", timestamp: now() },
        {
          id: "2",
          channel: "mic",
          speaker: "client",
          text: "Tem um senhor caido na Praca da Se, mas ja sai do local. Acho que levantou. Deixa pra la.",
          timestamp: now()
        },
        { id: "3", channel: "system", speaker: "agent", text: "Voce consegue confirmar a vitima?", timestamp: now() },
        { id: "4", channel: "mic", speaker: "client", text: "Era brincadeira, so queria testar.", timestamp: now() }
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
