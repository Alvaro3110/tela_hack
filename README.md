# VozGuard AI — Quickstart (Webhook-First + CopilotKit)

Cockpit operacional de triagem em `http://localhost:3000/vozguard`.
Entrada principal: **webhook** (`POST /api/webhook/call-transcript`).
CopilotKit: camada generativa para explicar classificação, risco e ação recomendada.

## Quickstart 5 minutos

```bash
cd /home/alvarocruz/Documentos/Unhackaton/tela_hack
npm install
npm run dev:light
```

Abra:

- `http://localhost:3000/vozguard`

Parar com segurança:

- `Ctrl + C` no terminal do `npm run dev:light`

## Teste rápido de webhook real

Com o servidor rodando:

```bash
npm run test:webhook:real
```

Ou via curl:

```bash
curl -X POST http://localhost:3000/api/webhook/call-transcript \
  -H "Content-Type: application/json" \
  --data @samples/call-webhook-real-logistica.json
```

## Contrato oficial do webhook (payload real)

Endpoint:

- `POST /api/webhook/call-transcript`

Formato canônico (resumo):

```json
{
  "call": { "id": "...", "status": "...", "started_at": "..." },
  "geo": { "from_city": null, "from_state": null },
  "counts": { "segments": 22, "client_turns": 11, "agent_turns": 11 },
  "agents": {
    "sentiment": { "data": { "label": "frustrado", "score": 0.85 } },
    "classification": { "data": { "category": "Logística e Entrega", "tags": [] } },
    "routing": { "data": { "teams": [] } },
    "supervisor": { "data": { "score": 3.5 } }
  },
  "summary": { "summary_md": null, "summary_json": null },
  "transcript": [
    {
      "id": "...",
      "channel": "mic",
      "speaker": "client",
      "text": "...",
      "timestamp": "2026-05-15T16:51:12.000Z"
    }
  ]
}
```

Regras de aceitação:

- Obrigatório: `call.id` e `transcript[]` utilizável.
- Tolerante: variações de tipo (`id` número/string, timestamp diferente, campos opcionais ausentes).
- `400`: quando faltar o mínimo operacional (payload quebrado/inviável).
- Legado simples (`callId/timestamp/transcript`) continua desativado.

## Samples disponíveis

- `samples/call-webhook-real-logistica.json` (canônico real)
- `samples/call-webhook-logistica.json`
- `samples/call-webhook-violencia-domestica.json`
- `samples/call-webhook-emergencia-medica.json`
- `samples/call-webhook-idoso-perdido.json`
- `samples/call-webhook-possivel-trote.json`

Executar todos os samples:

```bash
npm run test:webhook:all
```

## Conectar sistema externo (webhook)

Veja o guia completo:

- `docs/webhook-connection.md`

Resumo rápido:

1. Suba o app local (`npm run dev:light`).
2. Configure o sistema externo para `POST http://localhost:3000/api/webhook/call-transcript`.
3. Para outro computador/rede externa, use túnel HTTPS (ngrok) e configure a URL pública.
4. Valide no `/vozguard`:
- status `200` no webhook
- cards atualizados
- transcrição segmentada
- CopilotKit explicando classificação

## Prompts prontos no CopilotKit

- `Essa chamada é emergência?`
- `Por que ficou fora do escopo?`
- `Quais sinais detectados no cliente?`
- `Resuma para o operador.`

## Se travar (modo demo leve)

- Mantenha apenas 1 aba aberta no navegador.
- Evite rodar `npm run build` durante a demo.
- Use um cenário por vez e aguarde 2-3 segundos entre envios.
- Prefira `npm run dev:light` em vez de outros processos paralelos.

## Segurança do MVP

`SIMULAÇÃO APENAS. NÃO ACIONA SERVIÇOS REAIS DE EMERGÊNCIA.`

Nenhuma ação dispara PM/SAMU/Bombeiros/SMS real.
