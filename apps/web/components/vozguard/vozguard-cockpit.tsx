"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useCopilotAction, useCopilotReadable } from "@copilotkit/react-core";
import { CopilotSidebar } from "@copilotkit/react-ui";
import { DEMO_WARNING, type EmergencyOccurrence } from "../../lib/vozguard/types";
import { cloneScenarioPayload, WEBHOOK_SCENARIOS } from "../../lib/vozguard/scenarios";
import { MapMock } from "./map-mock";
import styles from "./vozguard.module.css";

type ApiResponse = {
  ok: boolean;
  occurrence?: EmergencyOccurrence | null;
  error?: string;
};

function categoryLabel(category?: EmergencyOccurrence["category"]) {
  const labels: Record<string, string> = {
    violencia_domestica: "Possível Violência Doméstica",
    emergencia_medica: "Emergência Médica",
    queda_acidente: "Queda/Acidente",
    pessoa_perdida: "Pessoa Vulnerável Perdida",
    assalto_violencia: "Assalto/Violência",
    incendio: "Incêndio",
    possivel_trote: "Possível Trote",
    relato_inconsistente: "Relato Inconsistente",
    fora_escopo: "Fora do Escopo Emergencial",
    indefinida: "Indefinida"
  };

  return category ? labels[category] ?? category : "Sem classificação";
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
      minute: "2-digit",
      second: "2-digit"
    });
  } catch {
    return value;
  }
}

function statusLabel(status?: EmergencyOccurrence["status"]) {
  const map: Record<string, string> = {
    recebida: "Recebida",
    em_triagem: "Em triagem",
    aguardando_validacao: "Aguardando validação",
    confirmada: "Confirmada",
    inconsistente: "Inconsistente",
    sem_risco_emergencial: "Sem risco emergencial",
    encerrada: "Encerrada"
  };

  return status ? map[status] ?? status : "Aguardando webhook";
}

function headerTitle(occurrence?: EmergencyOccurrence | null) {
  if (!occurrence) return "COCKPIT OPERACIONAL VOZGUARD";
  if (occurrence.category === "violencia_domestica") return "POSSÍVEL VIOLÊNCIA DOMÉSTICA";
  if (occurrence.category === "fora_escopo") return "CHAMADA FORA DO ESCOPO EMERGENCIAL";
  return "POSSÍVEL EMERGÊNCIA DETECTADA";
}

function prettyExternalAgents(occurrence?: EmergencyOccurrence | null) {
  const ext = occurrence?.externalAgents;
  if (!ext) return [] as string[];

  const lines: string[] = [];
  if (ext.sentiment?.label) lines.push(`Sentimento: ${ext.sentiment.label} (${Math.round((ext.sentiment.score ?? 0) * 100)}%)`);
  if (ext.sentiment?.rationale) lines.push(`Racional sentimento: ${ext.sentiment.rationale}`);
  if (ext.classification?.category) lines.push(`Classificação externa: ${ext.classification.category}`);
  if (ext.classification?.tags?.length) lines.push(`Tags externas: ${ext.classification.tags.join(", ")}`);
  if (ext.routing?.teams?.length) lines.push(`Times sugeridos: ${ext.routing.teams.join(", ")}`);
  if (ext.routing?.rationale) lines.push(`Racional roteamento: ${ext.routing.rationale}`);
  if (typeof ext.supervisor?.score === "number") lines.push(`Supervisor score: ${ext.supervisor.score}`);
  if (ext.supervisor?.strengths?.length) lines.push(`Pontos fortes: ${ext.supervisor.strengths.join(", ")}`);
  if (ext.supervisor?.improvements?.length) lines.push(`Melhorias: ${ext.supervisor.improvements.join(", ")}`);

  return lines;
}

export function VozGuardCockpit() {
  const [occurrence, setOccurrence] = useState<EmergencyOccurrence | null>(null);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [manualPayload, setManualPayload] = useState("");

  const outOfScope = occurrence?.category === "fora_escopo";

  const loadLatest = useCallback(async () => {
    const res = await fetch("/api/incidents/latest", { cache: "no-store" });
    const data = (await res.json()) as ApiResponse;
    if (!data.ok) throw new Error(data.error ?? "Falha ao buscar ocorrência");
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

  const sendScenario = useCallback(async (scenarioId: string) => {
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
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Falha ao enviar cenário");
      setOccurrence(data.occurrence ?? null);
      setManualPayload(JSON.stringify(payload, null, 2));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao simular webhook");
    } finally {
      setPosting(false);
    }
  }, []);

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
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao enviar payload manual");
    } finally {
      setPosting(false);
    }
  }, [manualPayload]);

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
      if (!res.ok || !data.ok) throw new Error(data.error ?? "Falha ao atualizar ocorrência");
      setOccurrence(data.occurrence ?? null);
    },
    [occurrence]
  );

  useCopilotReadable(
    {
      description: "Ocorrência atual normalizada a partir de webhook real de chamada telefônica",
      value: occurrence
    },
    [occurrence]
  );

  useCopilotAction({
    name: "explainEmergencyClassification",
    description: "Explica por que a chamada foi ou não classificada como emergência",
    handler: async () => {
      if (!occurrence) return "Ainda não há ocorrência recebida.";
      return `${categoryLabel(occurrence.category)}. Risco ${occurrence.riskLevel}. Sinais: ${occurrence.detectedSignals.join(", ") || "nenhum"}.`;
    }
  });

  useCopilotAction({
    name: "explainExternalAgents",
    description: "Explica o contexto vindo de sentiment/classification/routing/supervisor externos",
    handler: async () => {
      if (!occurrence?.externalAgents) return "Não há análises externas no payload atual.";
      return prettyExternalAgents(occurrence).join(" | ") || "Análises externas recebidas, sem detalhes adicionais.";
    }
  });

  useCopilotAction({
    name: "generateCallSummary",
    description: "Gera um resumo da chamada com foco em operação",
    handler: async () => {
      if (!occurrence) return "Sem chamada para resumir.";
      return `${occurrence.analysisSummary} Última fala do cliente: ${occurrence.lastMessage ?? "não disponível"}.`;
    }
  });

  useCopilotAction({
    name: "validateLocationWithMCP",
    description: "Resume a localização estimada pelo MCP simulado",
    handler: async () => {
      if (!occurrence) return "Sem ocorrência para validar localização.";
      return `Local: ${occurrence.location.estimatedAddress ?? "não confirmado"}. Confiança: ${occurrence.location.confidence}.`;
    }
  });

  useCopilotAction({
    name: "markAsOutOfScope",
    description: "Marca ocorrência atual como fora de escopo emergencial",
    handler: async () => {
      if (!occurrence) return "Sem ocorrência ativa.";
      await patchOccurrence({
        status: "sem_risco_emergencial",
        suggestedActionStatus: "Sem ação emergencial sugerida",
        timelineLabel: "Copilot marcou ocorrência como fora de escopo.",
        timelineSeverity: "info"
      });
      return "Ocorrência marcada como fora de escopo emergencial.";
    }
  });

  useCopilotAction({
    name: "requestHumanValidation",
    description: "Solicita validação humana explícita",
    handler: async () => {
      if (!occurrence) return "Sem ocorrência ativa.";
      await patchOccurrence({
        status: "aguardando_validacao",
        suggestedActionStatus: "Validação humana obrigatória",
        timelineLabel: "Copilot solicitou validação humana.",
        timelineSeverity: "warning"
      });
      return "Validação humana solicitada.";
    }
  });

  useCopilotAction({
    name: "generateOperatorBriefing",
    description: "Gera briefing operacional final para o operador",
    handler: async () => {
      if (!occurrence) return "Sem ocorrência ativa.";
      return `Briefing: ${occurrence.analysisSummary} Recomendação: ${occurrence.suggestedAction.resource}. Incertezas: ${
        occurrence.uncertainties.join(" | ") || "nenhuma"
      }.`;
    }
  });

  const externalLines = useMemo(() => prettyExternalAgents(occurrence), [occurrence]);

  return (
    <CopilotSidebar
      defaultOpen={false}
      clickOutsideToClose={false}
      labels={{
        title: "Copilot Operacional",
        initial:
          "A entrada principal é webhook. A cada evento recebido, eu atualizo explicações de classificação, risco, localização, agentes externos e briefing operacional."
      }}
      instructions="Use sempre decisão humana final. Nunca acione serviços reais."
    >
      <main className={styles.page}>
        <div className={styles.layout}>
          <aside className={styles.sidebar}>
            <div className={styles.panel}>
              <h1 className={styles.logo}>SilentGuard AI</h1>
              <p className={styles.sub}>Triagem Inteligente de Chamadas</p>
              <p className={styles.disclaimer}>{DEMO_WARNING}</p>
            </div>

            <div className={styles.panel}>
              <h3 className={styles.title}>Status da chamada</h3>
              <div className={styles.kv}>ID: {occurrence?.callId ?? "-"}</div>
              <div className={styles.kv}>Status: {occurrence?.callStatus ?? "-"}</div>
              <div className={styles.kv}>Duração: {occurrence?.durationSeconds ?? 0}s</div>
              <div className={styles.kv}>Origem: {occurrence?.fromNumberMasked ?? "-"}</div>
              <div className={styles.kv}>Destino: {occurrence?.toNumberMasked ?? "-"}</div>
              <div className={styles.kv}>Última fala cliente: {occurrence?.lastMessage ?? "-"}</div>
              <div className={styles.kv}>Webhook: {occurrence ? "Recebido" : "Aguardando"}</div>
              <div className={styles.kv}>Warnings normalização: {occurrence?.normalizationWarnings.length ?? 0}</div>
            </div>

            <div className={styles.panel}>
              <h3 className={styles.title}>Simular webhook</h3>
              <div className={styles.scenarios}>
                {WEBHOOK_SCENARIOS.map((scenario) => (
                  <button key={scenario.id} className={styles.button} onClick={() => sendScenario(scenario.id)} disabled={posting}>
                    {scenario.title}
                  </button>
                ))}
              </div>
            </div>

            <div className={styles.panel}>
              <h3 className={styles.title}>Enviar payload exemplo</h3>
              <textarea
                className={styles.payload}
                value={manualPayload}
                onChange={(e) => setManualPayload(e.target.value)}
                placeholder='Cole um JSON completo aqui: { "call": ..., "transcript": [...] }'
              />
              <button className={styles.button} onClick={sendManualPayload} disabled={posting || !manualPayload.trim()}>
                Enviar payload exemplo
              </button>
            </div>

            <div className={styles.panel}>
              <Link href="/" className={styles.homeLink}>
                Voltar para home
              </Link>
            </div>
          </aside>

          <section className={styles.main}>
            <header className={styles.header}>
              <h2 className={styles.headerTitle}>{headerTitle(occurrence)}</h2>
              <p className={styles.headerSub}>{occurrence?.analysisSummary ?? "Aguardando payload de chamada para triagem."}</p>
              <div className={styles.metaRow}>
                <span>{categoryLabel(occurrence?.category)}</span>
                <span>Risco: {occurrence?.riskLevel ?? "-"}</span>
                <span>Status: {statusLabel(occurrence?.status)}</span>
                <span>Confiança IA: {occurrence?.aiConfidence ?? 0}%</span>
                <span>Atualizado: {formatTime(occurrence?.updatedAt)}</span>
              </div>
            </header>

            {error ? <div className={styles.error}>{error}</div> : null}
            {loading ? <div className={styles.loading}>Carregando cockpit...</div> : null}

            <div className={styles.grid}>
              <article className={styles.panel}>
                <h3 className={styles.title}>Transcrição da chamada</h3>
                <div className={styles.transcript}>
                  {occurrence?.transcript ? (
                    occurrence.transcript.split("\n").map((line, index) => (
                      <div key={`${line}-${index}`} className={line.startsWith("Cliente:") ? styles.clientLine : styles.agentLine}>
                        {line}
                      </div>
                    ))
                  ) : (
                    <div className={styles.kv}>Sem transcrição recebida.</div>
                  )}
                </div>
              </article>

              <article className={styles.panel}>
                <h3 className={styles.title}>Análise externa recebida</h3>
                {externalLines.length ? (
                  <ul className={styles.list}>
                    {externalLines.map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.kv}>Sem dados de agents externos neste payload.</p>
                )}
              </article>

              <article className={styles.panel}>
                <h3 className={styles.title}>Observabilidade de ingestão</h3>
                <p className={styles.kv}>Fonte do payload: {occurrence?.source ?? "-"}</p>
                <p className={styles.kv}>Atualização: {formatTime(occurrence?.updatedAt)}</p>
                {(occurrence?.normalizationWarnings?.length ?? 0) > 0 ? (
                  <ul className={styles.list}>
                    {(occurrence?.normalizationWarnings ?? []).map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.kv}>Sem ajustes de normalização.</p>
                )}
              </article>

              <article className={styles.panel}>
                <h3 className={styles.title}>Triagem emergencial VozGuard</h3>
                <p className={styles.kv}>Categoria: {categoryLabel(occurrence?.category)}</p>
                <p className={styles.kv}>Risco: {occurrence?.riskLevel ?? "-"}</p>
                <p className={styles.kv}>Confiabilidade: {occurrence?.reliability ?? "-"}</p>
                <p className={styles.kv}>Possível trote: {occurrence?.possibleHoax ? "sim" : "não"}</p>
                <p className={styles.kv}>Sinais detectados:</p>
                <div className={styles.tags}>
                  {(occurrence?.detectedSignals ?? []).map((signal) => (
                    <span key={signal} className={styles.tag}>
                      {signal}
                    </span>
                  ))}
                </div>
                <p className={styles.kv}>Incertezas:</p>
                <ul className={styles.list}>
                  {(occurrence?.uncertainties ?? []).map((u) => (
                    <li key={u}>{u}</li>
                  ))}
                </ul>
              </article>

              <article className={styles.panel}>
                <h3 className={styles.title}>Localização detectada + mapa mock</h3>
                <p className={styles.kv}>{occurrence?.location.estimatedAddress ?? "Localização não confirmada"}</p>
                <p className={styles.kv}>Fonte: {occurrence?.location.source ?? "none"}</p>
                <p className={styles.kv}>Confiança: {occurrence?.location.confidence ?? "desconhecida"}</p>
                <MapMock location={occurrence?.location ?? { confidence: "desconhecida", source: "none", referencePoints: [] }} />
              </article>

              {!outOfScope ? (
                <>
                  <article className={styles.panel}>
                    <h3 className={styles.title}>Modo silencioso recomendado</h3>
                    <ul className={styles.list}>
                      <li>Respostas neutras e discretas.</li>
                      <li>Evitar linguagem explícita de emergência na tela.</li>
                      <li>Priorizar confirmação humana em casos críticos.</li>
                    </ul>
                  </article>

                  <article className={styles.panel}>
                    <h3 className={styles.title}>Ação recomendada</h3>
                    <p className={styles.kv}>Recurso: {occurrence?.suggestedAction.resource ?? "-"}</p>
                    <p className={styles.kv}>Prioridade: {occurrence?.suggestedAction.priority ?? "-"}</p>
                    <p className={styles.kv}>Status: {occurrence?.suggestedAction.status ?? "-"}</p>
                    <div className={styles.actions}>
                      <button
                        className={styles.button}
                        onClick={() =>
                          patchOccurrence({
                            status: "confirmada",
                            suggestedActionStatus: "Confirmada por operador (simulação)",
                            timelineLabel: "Operador confirmou ação simulada.",
                            timelineSeverity: "success"
                          }).catch(() => undefined)
                        }
                        disabled={!occurrence}
                      >
                        Confirmar simulação
                      </button>
                      <button
                        className={styles.buttonGhost}
                        onClick={() =>
                          patchOccurrence({
                            status: "aguardando_validacao",
                            suggestedActionStatus: "Pedir mais informações",
                            timelineLabel: "Operador pediu mais informações.",
                            timelineSeverity: "warning"
                          }).catch(() => undefined)
                        }
                        disabled={!occurrence}
                      >
                        Pedir mais informações
                      </button>
                    </div>
                  </article>
                </>
              ) : (
                <article className={styles.panel}>
                  <h3 className={styles.title}>Sem indícios emergenciais</h3>
                  <p className={styles.kv}>
                    A chamada foi recebida e analisada. O conteúdo indica atendimento comercial/logístico, sem sinais de socorro,
                    risco físico, pessoa perdida, violência, incêndio ou emergência médica.
                  </p>
                  <p className={styles.kv}>Nenhuma ação emergencial sugerida. Manter registro para auditoria/demo.</p>
                </article>
              )}
            </div>
          </section>
        </div>
      </main>
    </CopilotSidebar>
  );
}
