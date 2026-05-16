"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { cloneScenarioPayload, WEBHOOK_SCENARIOS } from "../../lib/vozguard/scenarios";
import { DEMO_WARNING, type EmergencyOccurrence } from "../../lib/vozguard/types";
import { MapMock } from "./map-mock";
import styles from "./vozguard.module.css";

type IncidentApiResponse = {
  ok: boolean;
  occurrence?: EmergencyOccurrence | null;
  error?: string;
};

const QUICK_RESPONSES = [
  "Sim",
  "Não",
  "Não posso falar",
  "Ele está perto",
  "Estou em perigo",
  "Enviar localização",
  "Tudo bem",
  "Mais tarde"
];

const CHECKLIST_FIELDS: Array<{
  key: keyof EmergencyOccurrence["immediateRiskChecklist"];
  label: string;
  options: Array<{ value: string; text: string }>;
}> = [
  {
    key: "aggressorOnSite",
    label: "Agressor no local?",
    options: [
      { value: "desconhecido", text: "Desconhecido" },
      { value: "sim", text: "Sim" },
      { value: "nao", text: "Não" }
    ]
  },
  {
    key: "canSpeakSafely",
    label: "Pode falar com segurança?",
    options: [
      { value: "desconhecido", text: "Desconhecido" },
      { value: "sim", text: "Sim" },
      { value: "nao", text: "Não" }
    ]
  },
  {
    key: "childrenOrElderly",
    label: "Há crianças ou idosos?",
    options: [
      { value: "desconhecido", text: "Desconhecido" },
      { value: "sim", text: "Sim" },
      { value: "nao", text: "Não" }
    ]
  },
  {
    key: "weaponMentioned",
    label: "Há menção de arma?",
    options: [
      { value: "desconhecido", text: "Desconhecido" },
      { value: "sim", text: "Sim" },
      { value: "nao", text: "Não" }
    ]
  },
  {
    key: "victimCanLeave",
    label: "A vítima consegue sair?",
    options: [
      { value: "desconhecido", text: "Desconhecido" },
      { value: "sim", text: "Sim" },
      { value: "nao", text: "Não" }
    ]
  },
  {
    key: "locationConfirmed",
    label: "Localização confirmada?",
    options: [
      { value: "nao", text: "Não" },
      { value: "parcial", text: "Parcial" },
      { value: "sim", text: "Sim" }
    ]
  }
];

function riskClass(level: EmergencyOccurrence["riskLevel"]) {
  if (level === "baixo") return styles.riskLow;
  if (level === "atencao") return styles.riskAttention;
  if (level === "alto") return styles.riskHigh;
  if (level === "critico") return styles.riskCritical;
  return styles.riskUndetermined;
}

function formatDateTime(value?: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      hour12: false,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return value;
  }
}

function categoryLabel(category?: EmergencyOccurrence["category"]) {
  const labels: Record<string, string> = {
    violencia_domestica: "Possível Violência Doméstica",
    emergencia_medica: "Emergência Médica",
    queda_acidente: "Queda/Acidente",
    pessoa_perdida: "Pessoa Vulnerável Perdida",
    assalto_violencia: "Assalto/Violência Urbana",
    incendio: "Incêndio",
    possivel_trote: "Possível Trote",
    relato_inconsistente: "Relato Inconsistente",
    indefinida: "Ocorrência Indefinida"
  };

  if (!category) return "Sem classificação";
  return labels[category] ?? category;
}

function statusLabel(status?: EmergencyOccurrence["status"]) {
  const labels: Record<string, string> = {
    recebida: "Recebida",
    em_triagem: "Em triagem",
    aguardando_validacao: "Aguardando validação",
    confirmada: "Confirmada",
    inconsistente: "Inconsistente",
    encerrada: "Encerrada"
  };

  if (!status) return "Aguardando webhook";
  return labels[status] ?? status;
}

function reliabilityLabel(aiConfidence = 0) {
  if (aiConfidence >= 85) return "Alta";
  if (aiConfidence >= 70) return "Média";
  return "Baixa";
}

function shouldShowSilentMode(occurrence?: EmergencyOccurrence | null) {
  if (!occurrence) return false;
  const text = occurrence.transcript.toLowerCase();
  return occurrence.category === "violencia_domestica" || text.includes("não posso falar") || text.includes("nao posso falar");
}

function pendingQuestionsFor(occurrence?: EmergencyOccurrence | null) {
  if (!occurrence) return [];

  if (occurrence.category === "pessoa_perdida") {
    return [
      "Ele sabe o próprio nome?",
      "Tem documento ou contato de familiar?",
      "Está machucado ou passando mal?",
      "A testemunha mantém contato visual com a pessoa?"
    ];
  }

  if (occurrence.category === "emergencia_medica") {
    return [
      "A vítima está consciente?",
      "A respiração está regular ou ofegante?",
      "Há dor no peito ou desmaio recente?",
      "Existe histórico médico conhecido?"
    ];
  }

  if (occurrence.category === "violencia_domestica") {
    return [
      "A vítima pode responder com segurança?",
      "O agressor está no mesmo ambiente?",
      "Há crianças ou idosos no local?",
      "A vítima consegue sair para local seguro?"
    ];
  }

  if (occurrence.category === "possivel_trote") {
    return [
      "O ligante ainda está no local?",
      "Consegue confirmar vítima e referência exata?",
      "Há outra testemunha que confirme o relato?"
    ];
  }

  return ["Qual é o ponto de referência mais próximo?", "Existe risco imediato no local?"];
}

export function VozGuardCockpit() {
  const [occurrence, setOccurrence] = useState<EmergencyOccurrence | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [operatorConfirmed, setOperatorConfirmed] = useState(false);
  const [copilotQuestions, setCopilotQuestions] = useState<string[]>([]);

  const requiresHumanValidation =
    Boolean(occurrence) &&
    (occurrence.riskLevel === "alto" ||
      occurrence.riskLevel === "critico" ||
      occurrence.status === "aguardando_validacao" ||
      occurrence.status === "inconsistente" ||
      occurrence.category === "possivel_trote");

  const pendingQuestions = copilotQuestions.length ? copilotQuestions : pendingQuestionsFor(occurrence);

  const loadLatest = useCallback(async () => {
    const response = await fetch("/api/incidents/latest", { cache: "no-store" });
    const data = (await response.json()) as IncidentApiResponse;
    if (data.ok) {
      setOccurrence(data.occurrence ?? null);
      return;
    }

    setError(data.error ?? "Falha ao carregar a ocorrência mais recente.");
  }, []);

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      try {
        await loadLatest();
      } catch {
        if (mounted) {
          setError("Não foi possível carregar os dados iniciais.");
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    boot();

    const timer = setInterval(() => {
      loadLatest().catch(() => undefined);
    }, 2500);

    return () => {
      mounted = false;
      clearInterval(timer);
    };
  }, [loadLatest]);

  useEffect(() => {
    setOperatorConfirmed(false);
  }, [occurrence?.callId, occurrence?.updatedAt]);

  const simulateWebhook = useCallback(async (scenarioId: string) => {
    const scenario = WEBHOOK_SCENARIOS.find((item) => item.id === scenarioId);
    if (!scenario) return;

    setPosting(true);
    setError(null);

    try {
      const payload = cloneScenarioPayload(scenario);
      const response = await fetch("/api/webhook/call-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = (await response.json()) as IncidentApiResponse;
      if (!response.ok || !data.ok || !data.occurrence) {
        setError(data.error ?? "Falha ao simular webhook.");
        return;
      }

      setOccurrence(data.occurrence);
      setCopilotQuestions([]);
    } catch {
      setError("Erro de rede ao simular webhook.");
    } finally {
      setPosting(false);
    }
  }, []);

  const patchOccurrence = useCallback(
    async (patch: {
      checklist?: EmergencyOccurrence["immediateRiskChecklist"];
      status?: EmergencyOccurrence["status"];
      suggestedActionStatus?: string;
      timelineLabel?: string;
      timelineSeverity?: EmergencyOccurrence["timeline"][number]["severity"];
    }) => {
      if (!occurrence) return;

      const response = await fetch(`/api/incidents/${encodeURIComponent(occurrence.callId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });

      const data = (await response.json()) as IncidentApiResponse;
      if (!response.ok || !data.ok || !data.occurrence) {
        setError(data.error ?? "Falha ao atualizar ocorrência.");
        return;
      }

      setOccurrence(data.occurrence);
    },
    [occurrence]
  );

  const updateChecklistField = useCallback(
    async (field: keyof EmergencyOccurrence["immediateRiskChecklist"], value: string) => {
      await patchOccurrence({
        checklist: { [field]: value } as EmergencyOccurrence["immediateRiskChecklist"],
        timelineLabel: `Checklist atualizado: ${field} = ${value}.`,
        timelineSeverity: "info"
      });
    },
    [patchOccurrence]
  );

  useCopilotReadable(
    {
      description: "Estado operacional mais recente do VozGuard recebido via webhook.",
      value: occurrence ?? { status: "sem_ocorrencia", warning: DEMO_WARNING }
    },
    [occurrence]
  );

  useCopilotAction(
    {
      name: "classificarOcorrencia",
      description: "Explica a classificação atual da ocorrência recebida via webhook e o motivo do risco.",
      parameters: [],
      handler: async () => {
        if (!occurrence) return "Ainda não há ocorrência recebida por webhook.";
        return `${categoryLabel(occurrence.category)} com risco ${occurrence.riskLevel}. Sinais detectados: ${
          occurrence.detectedSignals.join(", ") || "nenhum"
        }.`;
      }
    },
    [occurrence]
  );

  useCopilotAction(
    {
      name: "detectarLocalizacao",
      description: "Mostra a localização estimada e confiança da análise de localização MCP simulada.",
      parameters: [],
      handler: async () => {
        if (!occurrence) return "Sem ocorrência para análise de localização.";
        const location = occurrence.location;
        return `Local estimado: ${location.estimatedAddress ?? "não confirmado"}. Confiança: ${location.confidence}. Referências: ${
          location.referencePoints.join(", ") || "nenhuma"
        }.`;
      }
    },
    [occurrence]
  );

  useCopilotAction(
    {
      name: "atualizarMapa",
      description: "Atualiza o mapa mock registrando revisão humana de localização no timeline.",
      parameters: [],
      handler: async () => {
        if (!occurrence) return "Sem ocorrência para atualizar mapa.";
        await patchOccurrence({
          timelineLabel: "Mapa mock revisado por ação do Copilot.",
          timelineSeverity: "info"
        });
        return "Mapa mock atualizado e evento registrado no timeline.";
      }
    },
    [occurrence, patchOccurrence]
  );

  useCopilotAction(
    {
      name: "gerarPerguntasPendentes",
      description: "Gera perguntas de triagem para o operador com base na categoria atual.",
      parameters: [],
      handler: async () => {
        const questions = pendingQuestionsFor(occurrence);
        if (!questions.length) return "Sem ocorrência ativa para gerar perguntas.";

        setCopilotQuestions(questions);
        await patchOccurrence({ timelineLabel: "Copilot gerou perguntas pendentes para triagem.", timelineSeverity: "warning" });

        return `Perguntas sugeridas: ${questions.join(" | ")}`;
      }
    },
    [occurrence, patchOccurrence]
  );

  useCopilotAction(
    {
      name: "gerarBriefingOperacional",
      description: "Gera resumo operacional com recomendação e incertezas da ocorrência atual.",
      parameters: [],
      handler: async () => {
        if (!occurrence) return "Sem ocorrência para briefing operacional.";
        return `${occurrence.analysisSummary} Recomendação: ${occurrence.suggestedAction.resource}. Incertezas: ${
          occurrence.uncertainties.join(" | ") || "nenhuma registrada"
        }.`;
      }
    },
    [occurrence]
  );

  useCopilotAction(
    {
      name: "avaliarPossivelTrote",
      description: "Avalia sinais de trote ou inconsistência e reforça validação humana.",
      parameters: [],
      handler: async () => {
        if (!occurrence) return "Sem ocorrência para avaliar trote.";

        if (occurrence.category === "possivel_trote" || occurrence.status === "inconsistente") {
          await patchOccurrence({
            status: "aguardando_validacao",
            suggestedActionStatus: "Validação humana obrigatória",
            timelineLabel: "Copilot reforçou risco de trote/inconsistência.",
            timelineSeverity: "warning"
          });
          return "Sinais de possível trote detectados. Validação humana obrigatória antes de qualquer encaminhamento.";
        }

        return "Não há sinais fortes de trote no estado atual da ocorrência.";
      }
    },
    [occurrence, patchOccurrence]
  );

  const headerTitle = useMemo(() => categoryLabel(occurrence?.category), [occurrence?.category]);

  return (
    <CopilotSidebar
      defaultOpen={false}
      clickOutsideToClose={false}
      labels={{
        title: "Copilot Operacional",
        initial:
          "Entrada principal via webhook. Posso explicar classificação, localização detectada, incertezas e próximos passos para validação humana."
      }}
      instructions="Você é um copiloto operacional de triagem. Sempre priorize segurança e validação humana. Nunca proponha acionamento automático de serviços reais."
    >
      <main className={styles.page}>
        <div className={styles.shell}>
          <aside className={styles.sidebar}>
            <div className={styles.sidebarCard}>
              <h1 className={styles.brand}>SilentGuard AI</h1>
              <p className={styles.brandSub}>Triagem Inteligente de Chamadas de Emergência</p>
              <span className={styles.modeBadge}>Modo demonstração</span>
              <p className={styles.warningText}>{DEMO_WARNING}</p>
            </div>

            <div className={styles.sidebarCard}>
              <h2 className={styles.cardTitle}>Mensagem recebida</h2>
              <p className={styles.messagePreview}>{occurrence?.lastMessage ?? "Aguardando payload via webhook..."}</p>
              <button className={styles.primaryButton} onClick={() => simulateWebhook("silent-domestic")} disabled={posting}>
                {posting ? "Simulando..." : "Simular webhook"}
              </button>
            </div>

            <div className={styles.sidebarCard}>
              <h2 className={styles.cardTitle}>Cenários de exemplo</h2>
              <div className={styles.scenarioList}>
                {WEBHOOK_SCENARIOS.map((scenario) => (
                  <button
                    key={scenario.id}
                    className={styles.scenarioButton}
                    onClick={() => simulateWebhook(scenario.id)}
                    disabled={posting}
                  >
                    {scenario.title}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.sidebarCard}>
              <Link href="/" className={styles.homeLink}>
                Voltar para home
              </Link>
            </div>
          </aside>

          <section className={styles.mainPane}>
            <header className={styles.headerCard}>
              <div className={styles.headerTop}>
                <div>
                  <div className={styles.occurrenceTag}>{headerTitle.toUpperCase()}</div>
                  <h2 className={styles.headerTitle}>Risco operacional detectado pela triagem webhook-first</h2>
                  <p className={styles.headerSubtitle}>{occurrence?.analysisSummary ?? "Aguardando dados para classificação."}</p>
                </div>
                <div className={`${styles.riskBadge} ${riskClass(occurrence?.riskLevel ?? "indeterminado")}`}>
                  {occurrence?.riskLevel?.toUpperCase() ?? "SEM DADOS"}
                </div>
              </div>

              <div className={styles.headerMeta}>
                <span>Ocorrência: {occurrence?.id ?? "-"}</span>
                <span>Call: {occurrence?.callId ?? "-"}</span>
                <span>Início: {formatDateTime(occurrence?.receivedAt)}</span>
                <span>Atualizado: {formatDateTime(occurrence?.updatedAt)}</span>
                <span>Status: {statusLabel(occurrence?.status)}</span>
              </div>

              <div className={styles.headerBottom}>
                <div className={styles.confidenceCircle}>
                  <strong>{occurrence?.aiConfidence ?? 0}%</strong>
                  <span>Confiança IA</span>
                </div>
                <div className={styles.statusSummary}>
                  <div>Confiabilidade estimada: {reliabilityLabel(occurrence?.aiConfidence)}</div>
                  <div>Fonte: {occurrence?.source ?? "-"}</div>
                  <div>Transcrição: {occurrence?.partial ? "Parcial" : occurrence ? "Final" : "-"}</div>
                </div>
                <button
                  className={styles.secondaryButton}
                  disabled={!occurrence}
                  onClick={() => {
                    if (!occurrence) return;
                    patchOccurrence({
                      timelineLabel: "Operador solicitou revisão manual da classificação.",
                      timelineSeverity: "warning",
                      status: "aguardando_validacao"
                    }).catch(() => undefined);
                  }}
                >
                  Revisar classificação
                </button>
              </div>
            </header>

            {error ? <div className={styles.errorBanner}>{error}</div> : null}

            {loading ? <div className={styles.loadingCard}>Carregando cockpit...</div> : null}

            <div className={styles.grid}>
              <article className={styles.card}>
                <h3 className={styles.cardTitle}>Localização estimada</h3>
                <p className={styles.cardText}>
                  {occurrence?.location.estimatedAddress ?? "Localização não confirmada"} ({occurrence?.location.confidence ?? "desconhecida"})
                </p>
                <MapMock location={occurrence?.location ?? { confidence: "desconhecida", source: "simulado", referencePoints: [] }} />
                <div className={styles.inlineActions}>
                  <button
                    className={styles.smallButton}
                    onClick={() =>
                      patchOccurrence({
                        checklist: { locationConfirmed: "sim" },
                        timelineLabel: "Operador confirmou localização estimada.",
                        timelineSeverity: "success"
                      })
                    }
                    disabled={!occurrence}
                  >
                    Confirmar localização
                  </button>
                  <button
                    className={styles.smallButtonGhost}
                    onClick={() =>
                      patchOccurrence({
                        checklist: { locationConfirmed: "nao" },
                        timelineLabel: "Operador marcou localização como desconhecida.",
                        timelineSeverity: "warning"
                      })
                    }
                    disabled={!occurrence}
                  >
                    Marcar desconhecida
                  </button>
                </div>
              </article>

              <article className={styles.card}>
                <h3 className={styles.cardTitle}>Análise do caso</h3>
                <p className={styles.cardText}>Categoria: {headerTitle}</p>
                <div className={styles.tagList}>
                  {(occurrence?.detectedSignals ?? []).length ? (
                    (occurrence?.detectedSignals ?? []).map((signal) => (
                      <span key={signal} className={styles.tag}>
                        {signal}
                      </span>
                    ))
                  ) : (
                    <span className={styles.tagMuted}>Nenhum sinal detectado até o momento.</span>
                  )}
                </div>
                <ul className={styles.list}>
                  {(occurrence?.recommendations ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className={styles.card}>
                <h3 className={styles.cardTitle}>Código discreto detectado</h3>
                {occurrence?.discreetCodeDetected ? (
                  <div className={styles.alertDanger}>Código detectado: {occurrence.discreetCode}</div>
                ) : (
                  <div className={styles.alertNeutral}>Nenhum código discreto identificado nesta mensagem.</div>
                )}
                <p className={styles.cardText}>Canal: {occurrence?.source ?? "-"}</p>
              </article>

              <article className={styles.card}>
                <h3 className={styles.cardTitle}>Confiança e incertezas</h3>
                <div className={styles.progressWrap}>
                  <div className={styles.progressBar} style={{ width: `${occurrence?.aiConfidence ?? 0}%` }} />
                </div>
                <p className={styles.cardText}>Confiabilidade: {reliabilityLabel(occurrence?.aiConfidence)}</p>
                <ul className={styles.list}>
                  {(occurrence?.uncertainties ?? []).map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              </article>

              <article className={styles.card}>
                <h3 className={styles.cardTitle}>Linha do tempo</h3>
                <div className={styles.timeline}>
                  {(occurrence?.timeline ?? []).slice(-8).reverse().map((event, index) => (
                    <div key={`${event.time}-${index}`} className={styles.timelineItem}>
                      <span className={`${styles.timelineDot} ${styles[`severity_${event.severity}` as keyof typeof styles]}`} />
                      <div>
                        <div className={styles.timelineLabel}>{event.label}</div>
                        <div className={styles.timelineTime}>{formatDateTime(event.time)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </article>

              <article className={styles.card}>
                <h3 className={styles.cardTitle}>Checklist de risco imediato</h3>
                <div className={styles.checklistGrid}>
                  {CHECKLIST_FIELDS.map((field) => (
                    <label key={field.key} className={styles.fieldLabel}>
                      <span>{field.label}</span>
                      <select
                        className={styles.select}
                        value={(occurrence?.immediateRiskChecklist[field.key] as string) ?? field.options[0].value}
                        onChange={(event) => updateChecklistField(field.key, event.target.value)}
                        disabled={!occurrence}
                      >
                        {field.options.map((option) => (
                          <option key={option.value} value={option.value}>
                            {option.text}
                          </option>
                        ))}
                      </select>
                    </label>
                  ))}
                </div>
              </article>

              <article className={styles.card}>
                <h3 className={styles.cardTitle}>Modo silencioso recomendado</h3>
                {shouldShowSilentMode(occurrence) ? (
                  <ul className={styles.list}>
                    <li>Respostas neutras ativadas para reduzir exposição da vítima.</li>
                    <li>Ocultar termos explícitos de emergência em mensagens visíveis.</li>
                    <li>Priorizar perguntas curtas de sim/não quando possível.</li>
                  </ul>
                ) : (
                  <p className={styles.cardText}>Sem recomendação ativa de modo silencioso neste momento.</p>
                )}
              </article>

              <article className={styles.card}>
                <h3 className={styles.cardTitle}>Perguntas pendentes</h3>
                <ul className={styles.list}>
                  {pendingQuestions.map((question) => (
                    <li key={question}>{question}</li>
                  ))}
                </ul>
              </article>

              <article className={styles.card}>
                <h3 className={styles.cardTitle}>Respostas rápidas</h3>
                <div className={styles.quickGrid}>
                  {QUICK_RESPONSES.map((item) => (
                    <button
                      key={item}
                      className={styles.quickButton}
                      onClick={() =>
                        patchOccurrence({
                          timelineLabel: `Resposta rápida simulada selecionada: ${item}`,
                          timelineSeverity: "info"
                        })
                      }
                      disabled={!occurrence}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </article>

              <article className={styles.card}>
                <h3 className={styles.cardTitle}>Ação recomendada</h3>
                <p className={styles.cardText}>Recurso: {occurrence?.suggestedAction.resource ?? "-"}</p>
                <p className={styles.cardText}>Prioridade: {occurrence?.suggestedAction.priority ?? "-"}</p>
                <p className={styles.cardText}>Status: {occurrence?.suggestedAction.status ?? "-"}</p>

                {requiresHumanValidation && !operatorConfirmed ? (
                  <div className={styles.alertWarning}>
                    Validação humana obrigatória antes de confirmar encaminhamento.
                  </div>
                ) : null}

                <div className={styles.inlineActions}>
                  <button
                    className={styles.smallButton}
                    disabled={!occurrence || (requiresHumanValidation && !operatorConfirmed)}
                    onClick={() =>
                      patchOccurrence({
                        status: "confirmada",
                        suggestedActionStatus: "Simulação confirmada pelo operador",
                        timelineLabel: "Operador confirmou encaminhamento simulado.",
                        timelineSeverity: "success"
                      })
                    }
                  >
                    Confirmar simulação
                  </button>
                  <button
                    className={styles.smallButtonGhost}
                    disabled={!occurrence}
                    onClick={() => {
                      setOperatorConfirmed(true);
                      patchOccurrence({
                        status: "aguardando_validacao",
                        suggestedActionStatus: "Operador pediu mais informações",
                        timelineLabel: "Operador solicitou coleta adicional antes de confirmar.",
                        timelineSeverity: "warning"
                      }).catch(() => undefined);
                    }}
                  >
                    Pedir mais informações
                  </button>
                </div>

                {requiresHumanValidation ? (
                  <label className={styles.confirmRow}>
                    <input
                      type="checkbox"
                      checked={operatorConfirmed}
                      onChange={(event) => setOperatorConfirmed(event.target.checked)}
                    />
                    <span>Confirmo revisão humana para ação crítica</span>
                  </label>
                ) : null}
              </article>
            </div>
          </section>
        </div>
      </main>
    </CopilotSidebar>
  );
}
