"use client";

import Link from "next/link";
import { CopilotChat } from "@copilotkit/react-ui";

type ChatProps = {
  hasApiKey: boolean;
};

export function Chat({ hasApiKey }: ChatProps) {
  return (
    <main style={{ maxWidth: 920, margin: "40px auto", padding: "0 16px" }}>
      <h1 style={{ marginBottom: 12 }}>Exemplo CopilotKit + MCP</h1>
      <p style={{ color: "#4b5563", marginTop: 0 }}>
        Pergunte sobre integração do CopilotKit. O backend está configurado para usar ferramentas MCP.
      </p>
      <section
        style={{
          border: "1px solid #dbeafe",
          background: "linear-gradient(135deg, #f8fbff 0%, #eef6ff 100%)",
          borderRadius: 12,
          padding: 14,
          marginBottom: 14
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
          <strong style={{ color: "#1e3a8a" }}>Status da variável de ambiente</strong>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              padding: "4px 8px",
              borderRadius: 999,
              color: hasApiKey ? "#166534" : "#991b1b",
              background: hasApiKey ? "#dcfce7" : "#fee2e2",
              border: hasApiKey ? "1px solid #86efac" : "1px solid #fecaca"
            }}
          >
            {hasApiKey ? "OPENAI_API_KEY OK" : "OPENAI_API_KEY ausente"}
          </span>
        </div>
        <p style={{ marginBottom: 0, color: "#334155" }}>
          {hasApiKey
            ? "OPENAI_API_KEY configurada no backend. O valor nunca é exibido no frontend."
            : "Crie um arquivo .env com OPENAI_API_KEY=... para ativar o backend do chat."}
        </p>
      </section>
      <section style={{ marginBottom: 14 }}>
        <Link
          href="/vozguard"
          style={{
            display: "inline-block",
            textDecoration: "none",
            background: "#0f172a",
            color: "#e2e8f0",
            padding: "10px 14px",
            borderRadius: 10,
            border: "1px solid #334155",
            fontWeight: 600
          }}
        >
          Abrir VozGuard (cockpit operacional)
        </Link>
      </section>
      <div style={{ background: "white", borderRadius: 12, padding: 12, border: "1px solid #e5e7eb" }}>
        <CopilotChat
          labels={{
            title: "Assistente",
            initial: "Oi! Posso te ajudar com CopilotKit e MCP."
          }}
          instructions={
            "Use as ferramentas MCP disponíveis para responder com base na documentação do CopilotKit quando possível."
          }
        />
      </div>
    </main>
  );
}
