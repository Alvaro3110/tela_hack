# VozGuard AI — Webhook-First Cockpit

Este projeto entrega duas rotas:

- `/`: exemplo mínimo de CopilotKit.
- `/vozguard`: cockpit operacional webhook-first (SilentGuard/VozGuard).

## Stack

- Next.js + TypeScript
- CopilotKit (`CopilotKit`, `CopilotSidebar`, `useCopilotReadable`, `useCopilotAction`)
- MCP simulado (`location-mcp`)
- Persistência local: SQLite primário + snapshot JSON espelho

## Como rodar

```bash
cd example-copilotkit-mcp
npm install
npm run dev
```

Abra:

- `http://localhost:3000/`
- `http://localhost:3000/vozguard`

## Ambiente

Use `.env` na raiz:

```bash
cp .env.example .env
```

Opcional para LLM real no CopilotKit runtime:

```env
OPENAI_API_KEY=...
```

Sem chave, o cockpit continua 100% funcional em modo mock.

## Fluxo webhook-first

A entrada principal é:

- `POST /api/webhook/call-transcript`

A UI faz polling curto em:

- `GET /api/incidents/latest`
- `GET /api/incidents/:callId`

Atualizações operacionais (checklist/status):

- `PATCH /api/incidents/:callId`

## cURL de teste

### 1) Violência doméstica silenciosa

```bash
curl -X POST http://localhost:3000/api/webhook/call-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "CALL-VD-001",
    "timestamp": "2026-05-16T14:02:31Z",
    "callerPhone": "+55 11 99999-9999",
    "transcript": "Não posso falar agora. Ele está aqui. Estou na Rua das Flores, Centro, São Paulo.",
    "partial": false,
    "source": "external-phone-transcriber",
    "metadata": { "cityHint": "São Paulo", "channel": "phone", "language": "pt-BR" }
  }'
```

### 2) Emergência médica

```bash
curl -X POST http://localhost:3000/api/webhook/call-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "CALL-MED-001",
    "timestamp": "2026-05-16T14:05:31Z",
    "transcript": "Meu avô está com dor no peito e falta de ar. Estamos perto da Estação Sé.",
    "partial": false,
    "source": "external-phone-transcriber",
    "metadata": { "cityHint": "São Paulo" }
  }'
```

### 3) Pessoa perdida

```bash
curl -X POST http://localhost:3000/api/webhook/call-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "CALL-LOST-001",
    "timestamp": "2026-05-16T14:06:31Z",
    "transcript": "Tem um idoso confuso e perdido perto do Mercado Modelo, na Praça Visconde de Cayru.",
    "partial": false,
    "source": "external-phone-transcriber",
    "metadata": { "cityHint": "Salvador" }
  }'
```

### 4) Possível trote

```bash
curl -X POST http://localhost:3000/api/webhook/call-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "CALL-TRT-001",
    "timestamp": "2026-05-16T14:07:31Z",
    "transcript": "Tem um senhor caído na Praça da Sé, mas já saí do local. Deve ter levantado. Deixa pra lá.",
    "partial": false,
    "source": "external-phone-transcriber",
    "metadata": { "cityHint": "São Paulo" }
  }'
```

### 5) Atualização parcial

```bash
curl -X POST http://localhost:3000/api/webhook/call-transcript \
  -H "Content-Type: application/json" \
  -d '{
    "callId": "CALL-VD-001",
    "timestamp": "2026-05-16T14:08:31Z",
    "transcript": "Não posso falar agora. Ele está aqui. Estou no Centro.",
    "partial": true,
    "source": "external-phone-transcriber",
    "metadata": { "cityHint": "São Paulo" }
  }'
```

## Persistência local

Arquivos gerados automaticamente:

- `apps/web/.data/vozguard.sqlite` (fonte principal)
- `apps/web/.data/vozguard-snapshot.json` (espelho para debug/export)

## Segurança do MVP

A interface sempre exibe aviso de simulação:

`SIMULAÇÃO APENAS. NÃO ACIONA SERVIÇOS REAIS DE EMERGÊNCIA.`

Nada dispara PM/SAMU/Bombeiros/SMS real.
