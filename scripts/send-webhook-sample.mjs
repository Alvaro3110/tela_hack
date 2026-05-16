import { readFile } from "node:fs/promises";

const filePath = process.argv[2];
const endpoint = process.env.WEBHOOK_URL || "http://127.0.0.1:3000/api/webhook/call-transcript";

if (!filePath) {
  console.error("Uso: node scripts/send-webhook-sample.mjs <arquivo.json>");
  process.exit(1);
}

async function run() {
  const raw = await readFile(filePath, "utf-8");
  const payload = JSON.parse(raw);

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  console.log(`Arquivo: ${filePath}`);
  console.log(`Endpoint: ${endpoint}`);
  console.log(`Status: ${res.status}`);

  if (!res.ok || !data.ok) {
    console.error("Erro:", data.error || "falha ao enviar webhook");
    process.exit(1);
  }

  const occurrence = data.occurrence;
  console.log("Call ID:", occurrence?.callId);
  console.log("Categoria:", occurrence?.category);
  console.log("Risco:", occurrence?.riskLevel);
  console.log("Status da triagem:", occurrence?.status);
  console.log("Warnings de normalização:", occurrence?.normalizationWarnings?.length || 0);
}

run().catch((error) => {
  console.error("Falha no teste:", error.message);
  process.exit(1);
});
