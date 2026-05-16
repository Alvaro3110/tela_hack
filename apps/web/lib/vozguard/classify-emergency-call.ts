import type { EmergencyOccurrence, NormalizedCallInput } from "./types";

const DISCREET_CODES = ["relatório azul", "relatorio azul", "pizza chegou", "cuidar do cachorro", "bolsa vermelha", "a luz acabou"];

const normalize = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

function containsAny(text: string, terms: string[]) {
  const n = normalize(text);
  return terms.some((t) => n.includes(normalize(t)));
}

function detectSignals(text: string) {
  const table: Array<[string, string[]]> = [
    ["não posso falar", ["não posso falar", "nao posso falar", "não posso falar agora"]],
    ["agressor próximo", ["ele está aqui", "ele chegou", "ele vai me bater"]],
    ["dor no peito", ["dor no peito", "aperto no peito"]],
    ["falta de ar", ["falta de ar", "nao esta respirando", "não está respirando"]],
    ["queda", ["caiu", "bateu a cabeça", "não consegue levantar", "dor no quadril", "tonto"]],
    ["pessoa perdida", ["perdido", "idoso confuso", "não sabe o endereço", "não sabe voltar"]],
    ["assalto/ameaça", ["roubaram", "assaltado", "ameaçou", "arma", "faca"]],
    ["sinal de trote", ["era brincadeira", "só queria testar", "deixa pra lá", "já saí do local", "acho que levantou"]]
  ];

  return table.filter(([, terms]) => containsAny(text, terms)).map(([name]) => name);
}

export async function classifyEmergencyCall(input: {
  transcript: string;
  fullTranscript: string;
  callMetadata: NormalizedCallInput;
}): Promise<Partial<EmergencyOccurrence>> {
  const transcript = input.transcript || input.fullTranscript;
  const detectedSignals = detectSignals(transcript);

  const hasDiscreetCode = DISCREET_CODES.find((term) => containsAny(transcript, [term]));

  const violence =
    containsAny(transcript, [
      "não posso falar",
      "nao posso falar",
      "ele está aqui",
      "ele chegou",
      "estou presa",
      "me ajuda",
      "ele vai me bater",
      "preciso do relatório azul",
      "pode vir aqui agora",
      "a luz acabou",
      "não posso falar agora"
    ]) || Boolean(hasDiscreetCode);

  const medical = containsAny(transcript, [
    "dor no peito",
    "falta de ar",
    "desmaiou",
    "convulsão",
    "convulsao",
    "não está respirando",
    "nao esta respirando",
    "idoso passando mal",
    "suando muito",
    "pálido",
    "palido"
  ]);

  const lost = containsAny(transcript, [
    "perdido",
    "não sei voltar",
    "nao sei voltar",
    "idoso confuso",
    "não sabe o endereço",
    "nao sabe o endereco",
    "criança sumiu",
    "crianca sumiu",
    "não sabe voltar",
    "nao sabe voltar"
  ]);

  const fall = containsAny(transcript, ["caiu", "bateu a cabeça", "não consegue levantar", "dor no quadril", "tonto"]);

  const robbery = containsAny(transcript, [
    "roubaram",
    "assaltado",
    "levaram a carteira",
    "levaram o celular",
    "ameaçou",
    "ameacou",
    "arma",
    "faca"
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
    "ja sai do local",
    "acho que levantou",
    "nem estou mais aí",
    "nem estou mais ai"
  ]);

  const externalCategory = input.callMetadata.externalAgents.classification?.category ?? "";
  const logisticHints = [
    "logística e entrega",
    "logistica e entrega",
    "atraso na entrega",
    "rastreio indisponível",
    "cancelamento de pedido",
    "produto",
    "pedido",
    "protocolo",
    "headset",
    "entrega"
  ];

  const transcriptEmergencyHints = ["socorro", "arma", "fogo", "não consigo respirar", "nao consigo respirar", "ele vai me bater"];
  const mayBeOutOfScope =
    !violence && !medical && !lost && !fall && !robbery && !hoax &&
    (containsAny(externalCategory, ["logística", "logistica", "entrega"]) || containsAny(`${transcript} ${input.fullTranscript}`, logisticHints));

  if (violence) {
    return {
      category: "violencia_domestica",
      riskLevel: "critico",
      riskScore: 90,
      aiConfidence: 90,
      reliability: "alta",
      possibleHoax: false,
      detectedSignals,
      discreetCodeDetected: Boolean(hasDiscreetCode),
      discreetCode: hasDiscreetCode,
      uncertainties: ["Presença de arma não confirmada.", "Número de envolvidos pode variar durante a ligação."],
      recommendations: ["Ativar protocolo de comunicação silenciosa.", "Priorizar validação humana imediata."],
      status: "aguardando_validacao",
      suggestedAction: {
        resource: "Operador humano + Polícia Militar",
        priority: "critica",
        status: "Validação humana obrigatória"
      },
      analysisSummary: "Sinais de violência doméstica com risco crítico detectados a partir das falas do cliente."
    };
  }

  if (medical) {
    return {
      category: "emergencia_medica",
      riskLevel: "critico",
      riskScore: 92,
      aiConfidence: 90,
      reliability: "alta",
      possibleHoax: false,
      detectedSignals,
      discreetCodeDetected: false,
      uncertainties: ["Condição clínica detalhada ainda não confirmada."],
      recommendations: ["Monitorar consciência e respiração.", "Acionar validação humana para encaminhamento médico."],
      status: "aguardando_validacao",
      suggestedAction: {
        resource: "SAMU / Ambulância",
        priority: "critica",
        status: "Aguardando validação do operador"
      },
      analysisSummary: "Sintomas compatíveis com emergência médica grave relatados pelo cliente."
    };
  }

  if (fall) {
    return {
      category: "queda_acidente",
      riskLevel: "alto",
      riskScore: 79,
      aiConfidence: 84,
      reliability: "media",
      possibleHoax: false,
      detectedSignals,
      discreetCodeDetected: false,
      uncertainties: ["Possível trauma sem avaliação presencial completa."],
      recommendations: ["Evitar movimentação da vítima.", "Validar acesso de equipe de resgate."],
      status: "aguardando_validacao",
      suggestedAction: {
        resource: "SAMU / Resgate",
        priority: "alta",
        status: "Aguardando validação do operador"
      },
      analysisSummary: "Relato compatível com queda/acidente e potencial trauma físico."
    };
  }

  if (lost) {
    return {
      category: "pessoa_perdida",
      riskLevel: "alto",
      riskScore: 77,
      aiConfidence: 83,
      reliability: "media",
      possibleHoax: false,
      detectedSignals,
      discreetCodeDetected: false,
      uncertainties: ["Identidade e contato familiar ainda não confirmados."],
      recommendations: ["Manter a pessoa em local seguro.", "Acionar apoio local após validação humana."],
      status: "aguardando_validacao",
      suggestedAction: {
        resource: "Guarda Municipal / PM / Apoio local",
        priority: "alta",
        status: "Aguardando validação do operador"
      },
      analysisSummary: "Relato indica pessoa vulnerável perdida, com risco elevado por desorientação."
    };
  }

  if (robbery) {
    return {
      category: "assalto_violencia",
      riskLevel: "alto",
      riskScore: 80,
      aiConfidence: 86,
      reliability: "media",
      possibleHoax: false,
      detectedSignals,
      discreetCodeDetected: false,
      uncertainties: ["Ferimentos e presença do suspeito não confirmados."],
      recommendations: ["Priorizar segurança imediata da vítima.", "Solicitar validação humana operacional."],
      status: "aguardando_validacao",
      suggestedAction: {
        resource: "PM / Guarda Municipal",
        priority: "alta",
        status: "Aguardando validação do operador"
      },
      analysisSummary: "Sinais de assalto/ameaça identificados com necessidade de resposta prioritária."
    };
  }

  if (hoax) {
    return {
      category: "possivel_trote",
      riskLevel: "indeterminado",
      riskScore: 45,
      aiConfidence: 72,
      reliability: "baixa",
      possibleHoax: true,
      detectedSignals,
      discreetCodeDetected: false,
      uncertainties: ["Relato inconsistente e baixa confirmação de presença no local."],
      recommendations: ["Solicitar reconfirmação de local e vítima.", "Manter decisão final sob validação humana."],
      status: "aguardando_validacao",
      suggestedAction: {
        resource: "Validação humana",
        priority: "media",
        status: "Aguardando confirmação"
      },
      analysisSummary: "Indícios de possível trote detectados pelo padrão de inconsistência do relato."
    };
  }

  if (mayBeOutOfScope && !containsAny(transcript, transcriptEmergencyHints)) {
    return {
      category: "fora_escopo",
      riskLevel: "baixo",
      riskScore: 5,
      aiConfidence: 85,
      reliability: "alta",
      possibleHoax: false,
      detectedSignals,
      discreetCodeDetected: false,
      uncertainties: [],
      recommendations: ["Nenhuma ação emergencial sugerida. Manter registro para auditoria/demo."],
      status: "sem_risco_emergencial",
      suggestedAction: {
        resource: "Nenhum recurso emergencial sugerido",
        priority: "baixa",
        status: "Registro encerrado sem risco emergencial"
      },
      analysisSummary: "Chamada recebida e processada, mas sem indícios de emergência pública ou socorro."
    };
  }

  return {
    category: "indefinida",
    riskLevel: "atencao",
    riskScore: 55,
    aiConfidence: 62,
    reliability: "media",
    possibleHoax: false,
    detectedSignals,
    discreetCodeDetected: false,
    uncertainties: ["Dados insuficientes para classificação conclusiva."],
    recommendations: ["Coletar mais contexto com foco em risco imediato e localização."],
    status: "em_triagem",
    suggestedAction: {
      resource: "Triagem adicional",
      priority: "media",
      status: "Coleta complementar necessária"
    },
    analysisSummary: "Classificação preliminar inconclusiva; manter triagem ativa com validação humana."
  };
}
