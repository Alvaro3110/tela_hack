"use client";

import Link from "next/link";
import type { CSSProperties } from "react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { DEMO_WARNING, type EmergencyOccurrence } from "../../lib/vozguard/types";
import { cloneScenarioPayload, WEBHOOK_SCENARIOS } from "../../lib/vozguard/scenarios";
import { mapOccurrenceToSilentGuardUi } from "../../lib/vozguard/ui-mapper";
import { MapMock } from "./map-mock";
import styles from "./vozguard.module.css";

type ApiResponse = {
  ok: boolean;
  occurrence?: EmergencyOccurrence | null;
  error?: string;
};

type ChecklistKey = keyof EmergencyOccurrence["immediateRiskChecklist"];

const SIMULATION_WARNING = "SIMULAÇÃO APENAS. NÃO ACIONA SERVIÇOS REAIS DE EMERGÊNCIA.";

const QUICK_REPLIES = [
  { label: "Nao posso falar", event: "Resposta rapida: Nao posso falar" },
  { label: "Ele esta perto", event: "Resposta rapida: Ele esta perto" },
  { label: "Enviar localizacao", event: "Resposta rapida: Enviar localizacao" }
];

function categoryLabel(category?: EmergencyOccurrence["category"]) {
  const labels: Record<string, string> = {
    violencia_domestica: "Possível Violência Doméstica",
    emergencia_medica: "Emergencia Medica",
    queda_acidente: "Queda/Acidente",
    pessoa_perdida: "Pessoa Vulneravel Perdida",
    assalto_violencia: "Assalto/Violencia",
    incendio: "Incendio",
    possivel_trote: "Possivel Trote",
    relato_inconsistente: "Relato Inconsistente",
    fora_escopo: "Fora do Escopo Emergencial",
    indefinida: "Indefinida"
  };

  return category ? labels[category] ?? category : "Sem classificacao";
}

function formatTime(value?: string) {
  if (!value) return "-";
  try {
    return new Date(value).toLocaleString("pt-BR", {
      hour12: false,
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit"
    });
  } catch {
    return value;
  }
}

function prettyExternalAgents(occurrence?: EmergencyOccurrence | null) {
  const ext = occurrence?.externalAgents;
  if (!ext) return [] as string[];

  const lines: string[] = [];
  if (ext.sentiment?.label) lines.push(`Sentimento: ${ext.sentiment.label} (${Math.round((ext.sentiment.score ?? 0) * 100)}%)`);
  if (ext.sentiment?.rationale) lines.push(`Racional sentimento: ${ext.sentiment.rationale}`);
  if (ext.classification?.category) lines.push(`Classificacao externa: ${ext.classification.category}`);
  if (ext.classification?.tags?.length) lines.push(`Tags externas: ${ext.classification.tags.join(", ")}`);
  if (ext.routing?.teams?.length) lines.push(`Times sugeridos: ${ext.routing.teams.join(", ")}`);
  if (typeof ext.supervisor?.score === "number") lines.push(`Supervisor score: ${ext.supervisor.score}`);

  return lines;
}

function checklistNextValue(key: ChecklistKey, value: string) {
  if (key === "locationConfirmed") {
    if (value === "sim") return "parcial";
    if (value === "parcial") return "nao";
    return "sim";
  }

  if (value === "sim") return "nao";
  if (value === "nao") return "desconhecido";
  return "sim";
}

function badgeTone(value: string) {
  if (["critica", "critico", "danger", "alta"].includes(value)) return styles.badgeDanger;
  if (["alto", "warning", "media", "atencao"].includes(value)) return styles.badgeWarn;
  if (["success", "baixo", "baixa", "confirmada"].includes(value)) return styles.badgeGood;
  return styles.badgeInfo;
}

export function VozGuardCockpit() {
  const [occurrence, setOccurrence] = useState<EmergencyOccurrence | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualPayload, setManualPayload] = useState("");

  const ui = useMemo(() => mapOccurrenceToSilentGuardUi(occurrence), [occurrence]);

  const loadLatest = useCallback(async () => {
    const res = await fetch("/api/incidents/latest", { cache: "no-store" });
    const data = (await res.json()) as ApiResponse;
    if (!data.ok) throw new Error(data.error ?? "Falha ao buscar ocorrencia");
    setOccurrence(data.occurrence ?? null);
  }, []);

  useEffect(() => {
    let active = true;

    const boot = async () => {
      try {
        await loadLatest();
      } catch (e) {
        if (active) setError(e instanceof Error ? e.message : "Falha ao carregar dados iniciais");
      } finally {
        if (active) setLoading(false);
      }
    };

    boot();

    const timer = setInterval(() => {
      loadLatest().catch(() => undefined);
    }, 2500);

    return () => {
      active = false;
      clearInterval(timer);
    };
  }, [loadLatest]);

  const sendScenario = useCallback(
    async (scenarioId: string) => {
      const scenario = WEBHOOK_SCENARIOS.find((s) => s.id === scenarioId);
      if (!scenario) return;

      setPosting(true);
      setError(null);

      try {
        const payload = cloneScenarioPayload(scenario);
        const res = await fetch("/api/webhook/call-transcript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });
        const data = (await res.json()) as ApiResponse;
        if (!res.ok || !data.ok) throw new Error(data.error ?? "Falha ao enviar cenario");
        setOccurrence(data.occurrence ?? null);
        setManualPayload(JSON.stringify(payload, null, 2));
        await loadLatest();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao simular webhook");
      } finally {
        setPosting(false);
      }
    },
    [loadLatest]
  );

  const sendManualPayload = useCallback(async () => {
    setPosting(true);
    setError(null);

    try {
      const parsed = JSON.parse(manualPayload);
      const res = await fetch("/api/webhook/call-transcript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed)
      });
      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Falha no payload manual");
      setOccurrence(data.occurrence ?? null);
      await loadLatest();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar payload manual");
    } finally {
      setPosting(false);
    }
  }, [loadLatest, manualPayload]);

  const patchOccurrence = useCallback(
    async (patch: {
      checklist?: EmergencyOccurrence["immediateRiskChecklist"];
      status?: EmergencyOccurrence["status"];
      suggestedActionStatus?: string;
      timelineLabel?: string;
      timelineSeverity?: EmergencyOccurrence["timeline"][number]["severity"];
    }) => {
      if (!occurrence) return;

      const res = await fetch(`/api/incidents/${encodeURIComponent(occurrence.callId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });

      const data = (await res.json()) as ApiResponse;
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Falha ao atualizar ocorrencia");
      setOccurrence(data.occurrence ?? null);
    },
    [occurrence]
  );

  const handleQuickReply = useCallback(
    async (event: string) => {
      await patchOccurrence({
        timelineLabel: event,
        timelineSeverity: "info"
      });
    },
    [patchOccurrence]
  );

  const updateChecklist = useCallback(
    async (key: ChecklistKey, label: string, value: string) => {
      const nextValue = checklistNextValue(key, value);
      const checklistPatch: EmergencyOccurrence["immediateRiskChecklist"] = { [key]: nextValue };
      await patchOccurrence({
        checklist: checklistPatch,
        timelineLabel: `Checklist atualizado: ${label} = ${nextValue}`,
        timelineSeverity: nextValue === "sim" ? "warning" : "info"
      });
    },
    [patchOccurrence]
  );

  useCopilotReadable(
    {
      description: "Ocorrencia atual normalizada a partir de webhook real de chamada telefonica",
      value: occurrence
    },
    [occurrence]
  );

  useCopilotReadable(
    {
      description: "Estado visual SilentGuard AI usado pela dashboard de triagem silenciosa",
      value: ui
    },
    [ui]
  );

  useCopilotAction({
    name: "explainEmergencyClassification",
    description: "Explica por que a chamada foi ou nao classificada como emergencia",
    handler: async () => {
      if (!occurrence) return "Ainda nao ha ocorrencia recebida.";
      return `${categoryLabel(occurrence.category)}. Risco ${occurrence.riskLevel}. Sinais: ${occurrence.detectedSignals.join(", ") || "nenhum"}.`;
    }
  });

  useCopilotAction({
    name: "explainExternalAgents",
    description: "Explica o contexto vindo de sentiment/classification/routing/supervisor externos",
    handler: async () => {
      if (!occurrence?.externalAgents) return "Nao ha analises externas no payload atual.";
      return prettyExternalAgents(occurrence).join(" | ") || "Analises externas recebidas, sem detalhes adicionais.";
    }
  });

  useCopilotAction({
    name: "generateCallSummary",
    description: "Gera um resumo da chamada com foco em operacao",
    handler: async () => {
      if (!occurrence) return "Sem chamada para resumir.";
      return `${occurrence.analysisSummary} Ultima fala do cliente: ${occurrence.lastMessage ?? "nao disponivel"}.`;
    }
  });

  useCopilotAction({
    name: "validateLocationWithMCP",
    description: "Resume a localizacao estimada pelo MCP simulado",
    handler: async () => {
      if (!occurrence) return "Sem ocorrencia para validar localizacao.";
      return `Local: ${occurrence.location.estimatedAddress ?? "nao confirmado"}. Confianca: ${occurrence.location.confidence}.`;
    }
  });

  useCopilotAction({
    name: "markAsOutOfScope",
    description: "Marca ocorrencia atual como fora de escopo emergencial",
    handler: async () => {
      if (!occurrence) return "Sem ocorrencia ativa.";
      await patchOccurrence({
        status: "sem_risco_emergencial",
        suggestedActionStatus: "Sem acao emergencial sugerida",
        timelineLabel: "Copilot marcou ocorrencia como fora de escopo.",
        timelineSeverity: "info"
      });
      return "Ocorrencia marcada como fora de escopo emergencial.";
    }
  });

  useCopilotAction({
    name: "requestHumanValidation",
    description: "Solicita validacao humana explicita",
    handler: async () => {
      if (!occurrence) return "Sem ocorrencia ativa.";
      await patchOccurrence({
        status: "aguardando_validacao",
        suggestedActionStatus: "Validacao humana obrigatoria",
        timelineLabel: "Copilot solicitou validacao humana.",
        timelineSeverity: "warning"
      });
      return "Validacao humana solicitada.";
    }
  });

  useCopilotAction({
    name: "generateOperatorBriefing",
    description: "Gera briefing operacional final para o operador",
    handler: async () => {
      if (!occurrence) return "Sem ocorrencia ativa.";
      return `Briefing: ${occurrence.analysisSummary} Recomendacao: ${occurrence.suggestedAction.resource}. Incertezas: ${
        occurrence.uncertainties.join(" | ") || "nenhuma"
      }.`;
    }
  });

  return (
    <CopilotSidebar
      defaultOpen={false}
      clickOutsideToClose={false}
      labels={{
        title: "Copilot Operacional",
        initial:
          "Entrada principal via webhook completo. Posso explicar classificacao, agentes externos, localizacao simulada e briefing."
      }}
      instructions="Use sempre decisao humana final. Nunca acione servicos reais."
    >
      <main className={styles.page}>
        <div className={styles.simulationBar}>{SIMULATION_WARNING}</div>
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <section className={styles.brandPanel}>
              <div className={styles.logoMark}>SG</div>
              <div>
                <h1 className={styles.logo}>SilentGuard AI</h1>
                <p className={styles.sub}>Triagem silenciosa generativa</p>
              </div>
              <p className={styles.disclaimer}>{DEMO_WARNING}</p>
            </section>

            <section className={styles.sidePanel}>
              <h2 className={styles.sideTitle}>Cenarios oficiais</h2>
              <div className={styles.scenarios}>
                {WEBHOOK_SCENARIOS.map((scenario, index) => (
                  <button
                    key={scenario.id}
                    className={`${styles.scenarioButton} ${index === 0 ? styles.scenarioPrimary : ""}`}
                    onClick={() => sendScenario(scenario.id)}
                    disabled={posting}
                  >
                    <span>{scenario.title}</span>
                    <small>{index === 0 ? "Demo hackathon" : "Payload oficial"}</small>
                  </button>
                ))}
              </div>
            </section>

            <section className={styles.sidePanel}>
              <h2 className={styles.sideTitle}>Chamada atual</h2>
              <div className={styles.kvLine}>
                <span>ID</span>
                <strong>{occurrence?.callId ?? "-"}</strong>
              </div>
              <div className={styles.kvLine}>
                <span>Status</span>
                <strong>{occurrence?.callStatus ?? "-"}</strong>
              </div>
              <div className={styles.kvLine}>
                <span>Duracao</span>
                <strong>{occurrence?.durationSeconds ?? 0}s</strong>
              </div>
              <div className={styles.kvLine}>
                <span>Webhook</span>
                <strong>{occurrence ? "Recebido" : "Aguardando"}</strong>
              </div>
              <div className={styles.kvLine}>
                <span>Warnings normalizacao</span>
                <strong>{occurrence?.normalizationWarnings?.length ?? 0}</strong>
              </div>
            </section>

            <section className={styles.sidePanel}>
              <details>
                <summary className={styles.detailsSummary}>Payload oficial manual</summary>
                <textarea
                  className={styles.payload}
                  value={manualPayload}
                  onChange={(e) => setManualPayload(e.target.value)}
                  placeholder='Cole JSON completo: { "call": ..., "transcript": [...] }'
                />
                <button className={styles.secondaryButton} onClick={sendManualPayload} disabled={posting || !manualPayload.trim()}>
                  Enviar payload
                </button>
              </details>
            </section>

            <Link href="/" className={styles.homeLink}>
              Voltar para home
            </Link>
          </aside>

          <section className={styles.main}>
            {error ? <div className={styles.error}>{error}</div> : null}
            {loading ? <div className={styles.loading}>Carregando cockpit...</div> : null}

            {!ui ? (
              <section className={styles.emptyState}>
                <span className={styles.emptyKicker}>SilentGuard AI</span>
                <h2>Selecione um cenario para iniciar a triagem simulada.</h2>
                <p>Simulação apenas. Não aciona serviços reais.</p>
              </section>
            ) : (
              <>
                <header className={styles.heroHeader}>
                  <div className={styles.headerCopy}>
                    <span className={styles.kicker}>EmergencyHeader</span>
                    <h2>{ui.emergencyHeader.title}</h2>
                    <p>{ui.emergencyHeader.subtitle}</p>
                    <div className={styles.metaRow}>
                      <span className={`${styles.badge} ${badgeTone(ui.emergencyHeader.severityLabel)}`}>
                        Severidade {ui.emergencyHeader.severityLabel}
                      </span>
                      <span className={`${styles.badge} ${badgeTone(ui.emergencyHeader.status)}`}>{ui.emergencyHeader.status}</span>
                      <span className={styles.badge}>Incidente {ui.emergencyHeader.incidentId}</span>
                      <span className={styles.badge}>Atualizado {formatTime(ui.emergencyHeader.updatedAt)}</span>
                    </div>
                  </div>
                  <div className={styles.confidenceDial} style={{ "--confidence": `${ui.emergencyHeader.confidence}%` } as CSSProperties}>
                    <strong>{ui.emergencyHeader.confidence}%</strong>
                    <span>Confianca IA</span>
                  </div>
                </header>

                <div className={styles.dashboardGrid}>
                  <article className={`${styles.card} ${styles.alertCard}`}>
                    <div className={styles.cardHeader}>
                      <span className={styles.kicker}>DomesticViolenceAlertCard</span>
                      <span className={`${styles.badge} ${badgeTone(ui.domesticViolenceAlertCard.priority)}`}>
                        Prioridade {ui.domesticViolenceAlertCard.priority}
                      </span>
                    </div>
                    <h3>{ui.domesticViolenceAlertCard.categoryLabel}</h3>
                    <p>{ui.domesticViolenceAlertCard.summary}</p>
                    <div className={styles.tags}>
                      {ui.domesticViolenceAlertCard.detectedSignals.map((signal) => (
                        <span key={signal} className={styles.tagDanger}>
                          {signal}
                        </span>
                      ))}
                    </div>
                  </article>

                  <article className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.kicker}>MessagePanel</span>
                      <span className={styles.muted}>{formatTime(ui.messagePanel.receivedAt)}</span>
                    </div>
                    <blockquote className={styles.messageQuote}>{ui.messagePanel.originalMessage}</blockquote>
                    <div className={styles.transcript}>
                      {occurrence?.transcript.split("\n").map((line, index) => (
                        <div key={`${line}-${index}`} className={line.startsWith("Cliente:") ? styles.clientLine : styles.agentLine}>
                          {line}
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.kicker}>DiscreetCodeDetector</span>
                      <span className={`${styles.badge} ${ui.discreetCodeDetector.detected ? styles.badgeDanger : styles.badgeInfo}`}>
                        {ui.discreetCodeDetector.detected ? "Detectado" : "Nao detectado"}
                      </span>
                    </div>
                    <h3>{ui.discreetCodeDetector.phrase}</h3>
                    <p>{ui.discreetCodeDetector.meaning}</p>
                    <div className={styles.codeList}>
                      {ui.discreetCodeDetector.knownCodes.map((code) => (
                        <span key={code.phrase}>{code.phrase}</span>
                      ))}
                    </div>
                  </article>

                  <article className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.kicker}>SilentModePanel</span>
                      <span className={`${styles.badge} ${ui.silentModePanel.active ? styles.badgeGood : styles.badgeInfo}`}>
                        {ui.silentModePanel.active ? "Ativo" : "Standby"}
                      </span>
                    </div>
                    <h3>{ui.silentModePanel.recommended ? "Modo silencioso recomendado" : "Modo silencioso opcional"}</h3>
                    <ul className={styles.cleanList}>
                      {ui.silentModePanel.options.map((option) => (
                        <li key={option}>{option}</li>
                      ))}
                    </ul>
                  </article>

                  <article className={`${styles.card} ${styles.mapCard}`}>
                    <div className={styles.cardHeader}>
                      <span className={styles.kicker}>GeoLocationPanel</span>
                      <span className={styles.badge}>Fonte {ui.geoLocationPanel.source}</span>
                    </div>
                    <h3>{ui.geoLocationPanel.address}</h3>
                    <p>
                      {ui.geoLocationPanel.city} / {ui.geoLocationPanel.state} · confianca {ui.geoLocationPanel.confidence} · localizacao simulada
                    </p>
                    <MapMock location={occurrence.location} />
                  </article>

                  <article className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.kicker}>ThreatProximityChecklist</span>
                      <span className={styles.muted}>clique para alternar</span>
                    </div>
                    <div className={styles.checklist}>
                      {ui.threatProximityChecklist.map((item) => (
                        <button
                          key={item.key}
                          className={styles.checkItem}
                          onClick={() => updateChecklist(item.key, item.label, item.value).catch(() => undefined)}
                        >
                          <span>{item.label}</span>
                          <strong className={badgeTone(item.value)}>{item.value}</strong>
                        </button>
                      ))}
                    </div>
                  </article>

                  <article className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.kicker}>SilentReplyButtons</span>
                      <span className={styles.muted}>timeline simulada</span>
                    </div>
                    <div className={styles.quickReplies}>
                      {QUICK_REPLIES.map((reply) => (
                        <button key={reply.event} onClick={() => handleQuickReply(reply.event).catch(() => undefined)} disabled={!occurrence}>
                          {reply.label}
                        </button>
                      ))}
                    </div>
                  </article>

                  <article className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.kicker}>ConfidenceAndUncertaintyPanel</span>
                      <span className={styles.badge}>{ui.confidenceAndUncertaintyPanel.confidence}% IA</span>
                    </div>
                    <h3>Analise do caso</h3>
                    <ul className={styles.cleanList}>
                      {ui.confidenceAndUncertaintyPanel.reasons.slice(0, 4).map((reason) => (
                        <li key={reason}>{reason}</li>
                      ))}
                    </ul>
                    <h4>Incertezas</h4>
                    <ul className={styles.cleanList}>
                      {ui.confidenceAndUncertaintyPanel.uncertainties.map((uncertainty) => (
                        <li key={uncertainty}>{uncertainty}</li>
                      ))}
                    </ul>
                  </article>

                  <article className={styles.card}>
                    <div className={styles.cardHeader}>
                      <span className={styles.kicker}>IncidentTimeline</span>
                      <span className={styles.muted}>{ui.incidentTimeline.length} eventos</span>
                    </div>
                    <div className={styles.timeline}>
                      {ui.incidentTimeline.map((item, index) => (
                        <div key={`${item.time}-${index}`} className={styles.timelineItem}>
                          <span className={`${styles.timelineDot} ${badgeTone(item.level)}`} />
                          <time>{formatTime(item.time)}</time>
                          <p>{item.event}</p>
                        </div>
                      ))}
                    </div>
                  </article>

                  <article className={`${styles.card} ${styles.dispatchCard}`}>
                    <div className={styles.cardHeader}>
                      <span className={styles.kicker}>DispatchSimulationPanel</span>
                      <span className={`${styles.badge} ${badgeTone(ui.dispatchSimulationPanel.priority)}`}>
                        {ui.dispatchSimulationPanel.priority}
                      </span>
                    </div>
                    <h3>{ui.dispatchSimulationPanel.recommendedResource}</h3>
                    <p>{ui.dispatchSimulationPanel.status}</p>
                    <div className={styles.actionRow}>
                      <button
                        className={styles.primaryButton}
                        onClick={() =>
                          patchOccurrence({
                            status: "confirmada",
                            suggestedActionStatus: "Simulação confirmada pelo operador",
                            timelineLabel: "Simulação confirmada pelo operador",
                            timelineSeverity: "success"
                          }).catch(() => undefined)
                        }
                        disabled={!occurrence}
                      >
                        Confirmar simulação
                      </button>
                      <button
                        className={styles.secondaryButton}
                        onClick={() =>
                          patchOccurrence({
                            status: "aguardando_validacao",
                            suggestedActionStatus: "Aguardando mais informações do operador",
                            timelineLabel: "Operador solicitou mais informações",
                            timelineSeverity: "warning"
                          }).catch(() => undefined)
                        }
                        disabled={!occurrence}
                      >
                        Pedir mais informações
                      </button>
                    </div>
                    <p className={styles.simulatedOnly}>SIMULAÇÃO APENAS. Nenhum serviço real é acionado.</p>
                  </article>
                </div>
              </>
            )}
          </section>
        </div>
      </main>
    </CopilotSidebar>
  );
}
