import "@copilotkit/react-ui/styles.css";
import type { Metadata } from "next";
import { CopilotKit } from "@copilotkit/react-core";

export const metadata: Metadata = {
  title: "CopilotKit + MCP Example",
  description: "Minimal example using CopilotKit and MCP docs server"
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <body style={{ margin: 0, fontFamily: "system-ui, sans-serif", background: "#f6f7fb" }}>
        <CopilotKit runtimeUrl="/api/copilotkit">{children}</CopilotKit>
      </body>
    </html>
  );
}
