# VozGuard AI — Webhook Real (Normalizar Primeiro, Classificar Depois)

Este projeto contém:

- `/`: exemplo mínimo CopilotKit
- `/vozguard`: cockpit operacional webhook-first com payload completo de chamada

## Stack

- Next.js + TypeScript
- CopilotKit (sidebar, readable state, actions)
- MCP simulado de localização
- Persistência local: SQLite + snapshot JSON

## Executar

```bash
cd example-copilotkit-mcp
npm install
npm run dev
```

Acessar:

- `http://localhost:3000/`
- `http://localhost:3000/vozguard`

## Formato oficial do webhook

Endpoint:

- `POST /api/webhook/call-transcript`

Formato esperado (resumo):

```json
{
  "call": { "id": "..." },
  "geo": { "from_city": "..." },
  "counts": { "segments": 4 },
  "agents": { "classification": { "data": { "category": "..." } } },
  "summary": { "summary_md": "..." },
  "transcript": [
    {
      "id": "1",
      "channel": "mic",
      "speaker": "client",
      "text": "...",
      "timestamp": "..."
    }
  ]
}
```

Importante:

- O formato legado simples (`callId/timestamp/transcript`) **não é aceito**.
- O webhook retorna `400` para payload incompatível.

## Testar com samples

```bash
curl -X POST http://localhost:3000/api/webhook/call-transcript \
  -H "Content-Type: application/json" \
  --data @samples/call-webhook-logistica.json
```

Arquivos disponíveis:

- `samples/call-webhook-logistica.json`
- `samples/call-webhook-violencia-domestica.json`
- `samples/call-webhook-emergencia-medica.json`
- `samples/call-webhook-idoso-perdido.json`
- `samples/call-webhook-possivel-trote.json`

Resultado esperado para logística:

- payload normalizado
- transcrição segmentada renderizada
- análise externa exibida
- triagem VozGuard => `fora_escopo`
- risco baixo
- sem ação emergencial

## Segurança do MVP

A aplicação exibe aviso fixo:

`SIMULAÇÃO APENAS. NÃO ACIONA SERVIÇOS REAIS DE EMERGÊNCIA.`

Nenhuma ação dispara PM/SAMU/Bombeiros/SMS real.

## Ambiente

Use `.env` na raiz para integrar LLM real no runtime CopilotKit:

```env
OPENAI_API_KEY=...
```

Sem chave, o cockpit continua funcional no modo mock operacional.
