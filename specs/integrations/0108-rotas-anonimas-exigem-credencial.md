---
id: 0108
titulo: Rotas anônimas que mudam estado passam a exigir credencial
dominio: integrations
status: em-revisao
autor: João Gabriel
criada: 2026-10-13
atualizada: 2026-10-13
branch: claude/architecture-audit-modernization-0f66d6
pr: https://github.com/Act962/nasa.ex/pull/459
peso: leve
---

# 0108 — Rotas anônimas que mudam estado passam a exigir credencial

## 1. Contexto

Itens S1, S2 e S4 de [`docs/seguranca-auditoria-2026-08.md`](../../docs/seguranca-auditoria-2026-08.md),
abertos desde 2026-08-18 e reconfirmados em 2026-10-13. Qualquer pessoa com a URL conseguia:

| Rota | O que dava para fazer sem credencial |
| --- | --- |
| `POST /api/payments/asaas/webhook` | Marcar uma recarga de Stars como paga e creditar o pacote |
| `DELETE /api/s3/delete` | Apagar qualquer arquivo do bucket |
| `POST /api/integrations/facebook/webhook` e `.../instagram/webhook` | Injetar mensagens e criar leads em qualquer empresa conectada |
| `POST /api/domain-providers/[provider]/webhook` | Mudar o status de uma compra de domínio e disparar a ativação |

S7 (`external/new-lead`) fica fora: depende de decidir como autenticar os integradores. Só o
`console.log` do corpo, que gravava dados pessoais no log, foi removido aqui.

## 2. Objetivo

Nenhuma dessas rotas muda estado sem uma credencial que só o remetente legítimo tem.

### Não-objetivos

- Conferir se o usuário logado é dono do arquivo que apaga (as chaves são `uuid.ext`, sem empresa; exige registro de arquivos, tratado com S5/A3).
- Autenticar `external/new-lead` e `new-nasa-*` (S6, S7).
- Proteger os uploads anônimos (A3).

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Webhook Asaas de Stars só processa com `asaas-access-token` igual ao `webhookSecret` de um gateway Asaas ativo. Sem segredo configurado, recusa tudo |
| RF-2 | O mesmo webhook não credita quando o valor pago é menor que o da recarga |
| RF-3 | Duas entregas simultâneas do mesmo pagamento creditam uma vez só |
| RF-4 | `s3/delete` exige sessão ou o token de exclusão emitido no upload daquele arquivo |
| RF-5 | O token de exclusão vale para um arquivo, por 24 horas |
| RF-6 | Webhooks de Messenger e Instagram conferem `x-hub-signature-256` com `META_APP_SECRET` sobre o corpo cru |
| RF-7 | Webhook de domínio exige `x-webhook-token` igual a `DOMAIN_PROVIDER_WEBHOOK_TOKEN`. Sem a variável, recusa tudo |
| RF-8 | Cada webhook que hoje recebe tráfego real tem um modo `log-only`, por variável de ambiente, que registra o que seria recusado sem recusar |
| RF-9 | Nenhum log novo contém corpo de requisição, token ou dado pessoal |

## 4. Critérios de aceite

- [x] **CA-1** — Token do Asaas igual ao de um gateway ativo é aceito; diferente, ausente ou sem gateway com segredo é recusado.
- [x] **CA-2** — Valor pago menor que o da recarga (além de 1 centavo) não credita; igual ou maior credita.
- [x] **CA-3** — Token de exclusão autoriza apagar o arquivo para o qual foi emitido e nenhum outro.
- [x] **CA-4** — Token de exclusão vencido, adulterado, malformado ou assinado com outro segredo é recusado.
- [x] **CA-5** — Assinatura da Meta válida é aceita; corpo adulterado, assinatura de outro app e header ausente são recusados no modo `enforce`.
- [x] **CA-6** — No modo `log-only`, assinatura inválida não é recusada.
- [x] **CA-7** — Modo ausente ou desconhecido cai no padrão da rota.
- [ ] **CA-8** — `curl` sem credencial contra cada rota em homologação devolve 401. _(manual, na implantação)_
- [x] **CA-9** — Teste de integração por rota, com banco (`tests/integration/security/`).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Gateway Asaas ativo em produção **sem** `webhookSecret`, ou token não cadastrado no painel do Asaas | No modo `enforce`, toda confirmação de PIX é recusada com 401 e a recarga não credita. O Asaas reenvia; depois de 15 falhas pausa a fila. Por isso a implantação começa em `log-only` |
| CB-2 | Conexão manual antiga de Messenger ou Instagram, em que o cliente apontou o próprio app da Meta | A assinatura vem com o segredo do app do cliente, que a plataforma não tem, e nunca confere. Por isso o padrão dessas duas rotas é `log-only` |
| CB-3 | Visitante sem sessão remove, no formulário público, o arquivo que acabou de enviar | Funciona pelo token de exclusão |
| CB-4 | Visitante sem sessão volta outro dia e remove um arquivo de uma resposta antiga | O campo é esvaziado; o arquivo fica no bucket (401 tratado como "só desanexar") |
| CB-5 | `workspace/remove-file` chamava `/api/s3/delete` por HTTP, do servidor, sem cookie | Passa a apagar direto pela função de storage, depois de conferir a empresa da action |
| CB-6 | Pagamento Asaas confirmado duas vezes (`PAYMENT_CONFIRMED` e `PAYMENT_RECEIVED`) ao mesmo tempo | Só a primeira credita |
| CB-7 | `META_APP_SECRET` ausente | Nenhuma assinatura confere; em `log-only` segue processando, em `enforce` recusa tudo |

## 9. Riscos e rollback

O risco é recusar chamada legítima por segredo não configurado (CB-1, CB-2). Mitigação e reversão são
a mesma peça: uma variável de ambiente por rota, sem novo deploy de código.

| Rota | Variável | Padrão | Para voltar a só registrar |
| --- | --- | --- | --- |
| Asaas Stars | `ASAAS_STARS_WEBHOOK_AUTH_MODE` | `enforce` | `log-only` |
| Messenger e Instagram | `META_MESSAGING_WEBHOOK_AUTH_MODE` | `log-only` | já é o padrão |
| Domínio | `DOMAIN_PROVIDER_WEBHOOK_TOKEN` | recusa tudo | não tem modo: nenhum registrador real chama a rota |
| `s3/delete` | — | exige sessão ou token | reverter o commit |

Roteiro de implantação:

1. Conferir em `/admin/payments` que o gateway Asaas tem `webhookSecret` e que o mesmo valor está no
   campo de token do webhook no painel do Asaas.
2. Subir com `ASAAS_STARS_WEBHOOK_AUTH_MODE=log-only`. Fazer ou aguardar um PIX real e procurar no log
   por `[asaas/webhook] token inválido`. Sem ocorrência, remover a variável (passa a `enforce`).
3. Acompanhar por alguns dias `[facebook-webhook] assinatura da Meta inválida` e o equivalente do
   Instagram. Sem ocorrência vinda de conexão ativa, definir `META_MESSAGING_WEBHOOK_AUTH_MODE=enforce`.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-13 | João Gabriel | Criada junto com a implementação |
| 2026-10-13 | João Gabriel | Renumerada de 0075 para 0091: o número já estava em uso na `main` |
| 2026-10-13 | João Gabriel | CA-9 cumprido: testes de integração das quatro rotas contra Postgres real |
| 2026-10-13 | João Gabriel | Renumerada de 0091 para 0103: a primeira renumeração conferiu só até 0089 e colidiu de novo com a `main` |
| 2026-10-15 | João Gabriel | Renumerada de 0103 para 0108: a `main` recebeu as specs 0103 a 0107 antes deste PR ser mesclado |
