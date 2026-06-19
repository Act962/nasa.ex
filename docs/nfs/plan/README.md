# Plano de Implementação — NFS-e no Forge via Focus NFe

Implementação dividida em 6 etapas sequenciais. Cada etapa pode ser executada e validada de forma independente antes de avançar.

## Etapas

| # | Arquivo | Descrição |
|---|---------|-----------|
| 1 | [01-schema.md](01-schema.md) | Schema Prisma: novos modelos, enums, relações e migration |
| 2 | [02-http-client.md](02-http-client.md) | HTTP client Focus NFe (`src/http/focus-nfe/`) |
| 3 | [03-orpc-procedures.md](03-orpc-procedures.md) | Procedures oRPC (`src/app/router/fiscal/`) |
| 4 | [04-webhook-inngest.md](04-webhook-inngest.md) | Webhook route + Inngest function de sync de status |
| 5 | [05-hooks.md](05-hooks.md) | React hooks do domínio fiscal (`src/features/fiscal/hooks/`) |
| 6 | [06-ui.md](06-ui.md) | Componentes UI: perfil fiscal, diálogo de emissão, card de status |

## Decisões arquiteturais

- **Conta master única** na Focus; cada org é "empresa" roteada por CNPJ do prestador.
- **Nota por emissão manual**: 1 clique = 1 `FiscalInvoice`. Campo `dataCompetencia` explícito no diálogo.
- **Síncrono e assíncrono**: a resposta do POST na Focus pode já trazer `autorizado` — o handler trata os dois caminhos.
- **Guard de dupla emissão**: `findFirst` de invoice ativa (PROCESSANDO|AUTORIZADO) antes de criar nova.
- **Ref queimado**: re-emissão após `ERRO` cria novo registro com `ref` incrementado (`forge-<id>-<n+1>`).
- **Stars cobradas só em AUTORIZADO**: dentro do Inngest, nunca antes.
- **XML salvo no storage próprio**: Inngest baixa e faz upload R2/S3 na autorização.
- **Reconciliação manual**: usuário usa "Atualizar status" no card. Sem cron.
- **Municípios v1**: só emite se `FiscalCompanyProfile.supportedByFocus = true`.

## Env vars necessárias

```bash
FOCUS_NFE_TOKEN_HOMOLOGACAO=
FOCUS_NFE_TOKEN_PRODUCAO=
FOCUS_NFE_WEBHOOK_SECRET=
```

## Verificação final (end-to-end)

Após todas as etapas:
1. `pnpm db:migrate` → ritual pós-migration (regen Prisma, bump SCHEMA_VERSION, touch catch-all, curl validate)
2. Configurar `FiscalCompanyProfile` via UI
3. Cadastrar empresa + cert A1 no painel da Focus (homologação)
4. Registrar webhook com ngrok URL
5. Criar contrato → "Emitir nota fiscal" → conferir `PROCESSANDO`
6. Aguardar webhook/Inngest → conferir `AUTORIZADO` com PDF + XML
7. Testar `refreshStatus` manual
8. Testar re-emissão após `ERRO` (novo ref)
9. Testar guard de dupla emissão (2 cliques → 1 invoice)
