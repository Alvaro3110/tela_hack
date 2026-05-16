import { readdir } from "node:fs/promises";
import path from "node:path";
import { spawn } from "node:child_process";

const samplesDir = path.join(process.cwd(), "samples");
const sender = path.join(process.cwd(), "scripts", "send-webhook-sample.mjs");

function runOne(file) {
  return new Promise((resolve) => {
    const child = spawn(process.execPath, [sender, file], {
      stdio: "inherit",
      env: process.env
    });

    child.on("exit", (code) => resolve(code ?? 1));
  });
}

async function run() {
  const files = (await readdir(samplesDir))
    .filter((name) => name.startsWith("call-webhook-") && name.endsWith(".json"))
    .sort()
    .map((name) => path.join("samples", name));

  if (!files.length) {
    console.error("Nenhum sample encontrado em /samples.");
    process.exit(1);
  }

  console.log(`Executando ${files.length} sample(s)...\n`);
  let failures = 0;

  for (const file of files) {
    const code = await runOne(file);
    console.log("-".repeat(60));
    if (code !== 0) failures += 1;
  }

  if (failures > 0) {
    console.error(`Falharam ${failures} sample(s).`);
    process.exit(1);
  }

  console.log("Todos os samples foram processados com sucesso.");
}

run().catch((error) => {
  console.error("Falha geral:", error.message);
  process.exit(1);
});
