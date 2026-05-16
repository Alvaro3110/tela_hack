# Conexão Webhook — VozGuard

## 1) Conexão local (mesmo computador)

1. Suba o app:

```bash
npm run dev:light
```

2. Endpoint local:

```text
http://localhost:3000/api/webhook/call-transcript
```

3. Teste com payload real:

```bash
npm run test:webhook:real
```

4. Abra a tela:

```text
http://localhost:3000/vozguard
```

## 2) Conexão externa (outro computador) com ngrok

1. Com app rodando localmente na porta `3000`, abra novo terminal.
2. Inicie túnel HTTPS:

```bash
ngrok http 3000
```

3. Copie a URL HTTPS gerada (exemplo: `https://abc123.ngrok-free.app`).
4. No sistema externo, configure webhook para:

```text
https://abc123.ngrok-free.app/api/webhook/call-transcript
```

5. Envie payload real de teste e valide no `/vozguard`.

## 3) Checklist de verificação operacional

- webhook respondeu `200`.
- ocorrência aparece na sidebar (`callId`, status, última fala).
- transcrição segmentada (Atendente/Cliente) renderizou.
- painel “Análise externa recebida” preenchido.
- painel “Triagem emergencial VozGuard” com categoria e risco.
- CopilotKit responde perguntas com o estado atual.

## 4) Troubleshooting

### Erro 400 por contrato

Causa comum:
- payload sem `call.id`.
- `transcript` ausente ou inválido.

Ação:
- valide formato com `samples/call-webhook-real-logistica.json`.

### Payload vazio ou sem efeito visual

Causa comum:
- endpoint incorreto.
- servidor não está rodando na porta 3000.

Ação:
- confirme `npm run dev:light`.
- reenvie usando `npm run test:webhook:real`.

### Diferença entre “sem risco emergencial” e “erro de ingestão”

- `sem_risco_emergencial`: webhook aceito e classificado como fora de escopo.
- erro de ingestão: request inválido ou falha de processamento (`400/500`).

### Copilot não acompanha estado

Causa comum:
- ocorrência ainda não recebida ou polling em andamento.

Ação:
- aguarde 2-3 segundos após POST.
- recarregue `/vozguard` e teste novamente.
