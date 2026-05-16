import { CopilotRuntime, OpenAIAdapter, copilotRuntimeNextJSAppRouterEndpoint } from "@copilotkit/runtime";
import OpenAI from "openai";

const serviceAdapter = new OpenAIAdapter({
  openai: new OpenAI({ apiKey: process.env.OPENAI_API_KEY }),
  model: "gpt-4.1-mini"
});

const runtime = new CopilotRuntime({
  // Exemplo didático: aqui você poderia registrar MCP servers consumidos pelo runtime
  // conforme a versão do @copilotkit/runtime usada no projeto.
});

export const POST = async (req: Request) => {
  const { handleRequest } = copilotRuntimeNextJSAppRouterEndpoint({
    runtime,
    serviceAdapter,
    endpoint: "/api/copilotkit"
  });

  return handleRequest(req);
};
