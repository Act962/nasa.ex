---
id: 0014
titulo: Astro como agente financeiro — pack de tools, confirmação e leitura de documentos
dominio: astro
status: em-revisao
autor: Weydson
criada: 2026-09-15
atualizada: 2026-09-15
branch: feature/W-astro-finance-tools-20260915
pr:
peso: completa
---

# 0014 — Astro como agente financeiro (Fase 1)

---

## 1. Contexto

Dor relatada por um empresário: "eu queria um sistema financeiro que tivesse
contas a pagar, já puxasse as notas fiscais, desse entrada e gerasse a
conciliação". O `/payment` já faz tudo isso, mas à mão. O Astro tem só seis
tools financeiras rasas (`get_finance_metrics`, `list_payment_entries`,
`list_payment_categories`, `create_payment_entry`, `create_payment_category`,
`update_payment_entry`), que:

- ignoram a whitelist `PaymentAccess` (spec 0007) — qualquer membro da org
  enxerga e cria lançamentos pelo Astro, mesmo sem acesso ao módulo;
- gravam direto, sem confirmação, com `status: PAID` por default;
- não leem arquivo nenhum — o Astro não recebe anexos em nenhuma superfície.

Esta é a primeira de seis fases (ver `.claude/plans` / `docs/ASTRO_PROGRESS.md`
§2026-09-15). Ela cria a base que as demais reutilizam: pack de tools por app,
proposta → confirmação, anexo no chat, extração de boleto/NF.

## 2. Objetivo

O usuário anexa um boleto ou nota fiscal no chat do `/home`, pede "lança isso",
vê um resumo (fornecedor, valor, vencimento, documento), responde "sim" e o
lançamento nasce em `/payment` com o arquivo vinculado e renomeado no padrão —
e qualquer pergunta sobre a situação da empresa (painel, fluxo, projeção,
metas, DRE/DRO, vencidos) é respondida com os mesmos números das telas.

### Não-objetivos

- Extrato bancário em PDF e conciliação pelo Astro (fase 3, spec 0016).
- Lembretes com envio do boleto (fase 4, spec 0017).
- Leitura do Gmail (fase 5, spec 0018).
- WhatsApp com escrita e cobrança de Stars (fase 6, spec 0019).
- Widget flutuante no orb (fase 2, spec 0015).
- Trocar o modelo do orquestrador (segue OpenAI). A escolha de provedor vale
  só para a extração de documento.
- Cadastrar contato financeiro fora do fluxo de proposta.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Toda tool financeira do Astro passa pela mesma matriz de permissão do módulo (`resolveEffectivePermissions` + `ensureOrgOwnerPaymentAccess`), por recurso/ação. |
| RF-2 | Tools de leitura devolvem os números das mesmas funções que alimentam as telas (`loadPaymentDashboard`, `loadCashflow`, `loadPaymentProjection`, `loadGoalStatus`, DRE/DRO, `queryPaymentEntries`). |
| RF-3 | Nenhuma tool financeira grava lançamento ou baixa sem uma proposta confirmada pelo usuário (`propose_*` → `confirm_action`). |
| RF-4 | A proposta é persistida (`AstroPendingAction`) com TTL, e a confirmação valida org, usuário, status e expiração antes de executar. |
| RF-5 | O usuário anexa PDF/imagem no chat do `/home`; o arquivo sobe pela rota existente `/api/payment/attachments/upload` e viaja na mensagem como data part (`data-astro-attachment`), nunca como base64 no JSON. |
| RF-6 | `read_financial_document` extrai tipo, direção, emissor, pagador, valor, vencimento, documento, dados de boleto e de NF, com `confidence` e `warnings`, e guarda o resultado em `PaymentAttachment.extraction` para não cobrar duas vezes. |
| RF-7 | Ao confirmar um lançamento com anexo, o arquivo é vinculado (`entryId`), o `kind` reflete o tipo detectado e o `fileName` passa para o padrão `AAAA-MM-DD_<KIND>_<contato>_<valor>_<doc>.<ext>`, preservando o nome original. |
| RF-8 | A extração confere linha digitável (mod10/mod11, fator de vencimento, valor) e CNPJ/CPF; divergência rebaixa `confidence` e entra em `warnings`. |
| RF-9 | A proposta avisa quando já existe lançamento com mesmo documento, valor e vencimento. |
| RF-10 | `create_payment_entry` e `update_payment_entry` continuam existindo (nomes estáveis para sessões antigas), mas viram propostas. |
| RF-11 | `create_payment_category` continua direta — inócua e reversível. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O refactor dos handlers oRPC em serviços não muda contrato nem resultado das procedures do payment. |
| RNF-2 | Extração cobra 5★ (`astro_finance_document`) antes de chamar o modelo; sem saldo, a tool devolve erro e não chama a IA. |
| RNF-3 | Nada de I/O fora de banco dentro de `$transaction` (regra 18). |
| RNF-4 | Efeitos pós-commit (vínculo de anexo, aprovação, dunning, alerta de reserva, activity log) são best-effort e nunca invalidam o lançamento. |

## 4. Critérios de aceite

- [x] **CA-1** — Dado um membro sem `PaymentAccess`, quando pergunta "quanto tenho a pagar", então o Astro responde que não há acesso ao financeiro e nenhuma query em `PaymentEntry` é feita.
- [x] **CA-2** — Dado um período, quando o Astro responde "quanto vence esta semana" / "como está meu fluxo de caixa", então os totais batem com o Painel e o Fluxo de Caixa da tela para o mesmo filtro.
- [ ] **CA-3** — Dado um boleto anexado, quando o usuário pede "lança isso", então `read_financial_document` cobra 5★ uma vez e uma segunda leitura do mesmo anexo não cobra.
- [ ] **CA-4** — Dada uma proposta pendente, quando o usuário responde "sim", então `confirm_action` cria o `PaymentEntry` com `contactId`, `categoryId`, `documentNumber`, vincula o anexo, renomeia o arquivo no padrão e ajusta o `kind`.
- [x] **CA-5** — Dada uma proposta expirada, quando o usuário responde "sim", então nada é gravado e o Astro oferece refazer.
- [x] **CA-6** — Quando o modelo chama `create_payment_entry` (nome legado), então o retorno é uma `astro_confirmation` e nenhum lançamento é criado.
- [x] **CA-7** — Dado um lançamento existente com mesmo documento, valor e vencimento, quando a proposta é montada, então ela traz `warnings` com "Possível duplicado".
- [ ] **CA-8** — Dada uma linha digitável com dígito verificador inválido, quando o documento é lido, então `confidence` cai e o aviso aparece na proposta.
- [ ] **CA-9** — Dado o refactor, quando o Painel, o Fluxo, a Projeção, a DRE e a lista de lançamentos são abertos, então os números são idênticos aos de antes (mesmo banco, três filtros).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Anexo de outra organização referenciado na mensagem | Rota ignora o anexo (não entra em `ctx.attachments`); tool devolve "anexo não encontrado". |
| CB-2 | Documento sem valor ou sem vencimento | Proposta sai com o campo vazio e `warnings`; o Astro pergunta o que falta antes de propor. |
| CB-3 | Direção indeterminada (não dá pra saber se é a pagar ou a receber) | `direction: UNKNOWN`; Astro pergunta; a proposta nunca assume. |
| CB-4 | Contato não cadastrado | Proposta traz `newContact` (nome + documento); confirmação cria o `PaymentContact` antes do lançamento. |
| CB-5 | Mesmo anexo em duas propostas | Segunda proposta reaproveita `extraction`; ao confirmar, o vínculo usa `linkAttachmentsToEntries` (anexo já vinculado a outro lançamento gera aviso, não erro). |
| CB-6 | Usuário confirma proposta de outro usuário | `confirm_action` recusa (`userId` diferente). |
| CB-7 | Confirmação dupla (dois "sim") | Segunda chamada encontra `CONFIRMED` e responde que já foi executada, sem duplicar. |
| CB-8 | PDF escaneado (imagem dentro do PDF) | Modelo recebe o PDF como arquivo (vision); não há fallback de texto porque não há texto. |
| CB-9 | PDF > 32 MB ou provider recusa | Fallback `pdf-parse` → texto → mesmo schema; `warnings` indicam fallback. |
| CB-10 | Nenhuma chave de IA cadastrada | Tool aponta /integrations; a cobrança de Stars só acontece depois de resolver a chave, então nada é debitado. |
| CB-13 | Provedor principal fora do ar ou em limite de taxa | Tenta o próximo da ordem de custo; a proposta traz aviso dizendo qual provedor leu. |
| CB-11 | Parcelas na NF | `installments[]` vira lançamento parcelado (`installments = n`, uma parcela por vencimento). |
| CB-12 | Mensagem com anexo mas sem texto | Rota aceita; o bloco `[ARQUIVOS ANEXADOS]` já instrui a ler o documento. |

## 6. Decisões de design

### D-1 — Pack de tools por app, registro mínimo

- **Escolha**: `src/features/astro/server/tools/finance/` exporta
  `buildFinanceReadTools`/`buildFinanceWriteTools`; `tools/app-packs.ts`
  registra por `appSlug`; `server/tool-scope.ts` monta o conjunto por escopo.
- **Alternativas descartadas**: sub-agent "finance" (`runSubAgent` devolve só
  texto e perde `astro_table`/`astro_confirmation`); deixar as tools espalhadas
  em `analytics/lists/mutations` (sem gate de permissão e sem ponto único).
- **Consequência**: NERP e outros apps entram como chave nova no registro.

### D-2 — Confirmação por proposta persistida, não `needsApproval`

- **Escolha**: `propose_*` grava `AstroPendingAction` e devolve
  `{ kind: "astro_confirmation" }`; `confirm_action({ proposalId })` executa.
- **Alternativas descartadas**: `needsApproval` do AI SDK — a aprovação vive
  dentro da UIMessage; no WhatsApp o "sim" chega noutra request e não permite
  editar antes de confirmar.
- **Consequência**: mesma mecânica em chat, widget e WhatsApp; auditoria em
  tabela; a UI só precisa de um card com botão que envia "confirmar <id>".

### D-3 — Anexo sobe primeiro, mensagem carrega só a referência

- **Escolha**: upload pela rota REST existente, data part com `attachmentId`.
- **Alternativas descartadas**: `files` base64 no `useChat` (16 MB dentro do
  JSON e da `AiSession.messages`).
- **Consequência**: o arquivo já é um `PaymentAttachment` "sem vínculo" desde o
  upload — se o usuário desistir, aparece em Documentos.

### D-4 — Whitelist financeira vale no Astro

- **Escolha**: `assertPaymentToolAccess` em toda tool do pack.
- **Consequência**: membro sem `PaymentAccess` deixa de ver dados financeiros
  pelo Astro. É mudança de comportamento intencional (fecha o furo da 0007).

### D-5 — Extração multi-provedor, PDF como arquivo, tier barato

- **Escolha**: `generateObject` com o arquivo inteiro ao modelo (vision cobre
  boleto escaneado). O provedor sai de `resolve-extraction-model.ts`, que lê as
  chaves cadastradas em /integrations e tenta em ordem de custo: OpenAI
  (`gpt-4o-mini`), Gemini (`gemini-2.5-flash-lite`), Anthropic
  (`claude-haiku-4-5`). Override por `ASTRO_FINANCE_EXTRACT_PROVIDER` e
  `ASTRO_FINANCE_EXTRACT_MODEL`.
- **Alternativas descartadas**: `claude-opus-5` fixo, que era a escolha inicial
  e custa 36× o `gpt-4o-mini` para ler doze campos de um documento padronizado;
  `pdf-parse` → texto → LLM como caminho principal, que não cobre escaneado e
  fica só como degradação quando o provedor recusa o arquivo.
- **Consequência**: o tier barato é seguro aqui porque a saída é conferível — a
  linha digitável recalcula valor e vencimento, e o dígito verificador do CNPJ
  denuncia leitura errada (RF-8). O modelo que leu fica gravado na extração, e
  um fallback acionado vira aviso na proposta, para que a troca não passe
  despercebida.

Custo por mil leituras, estimando 2500 tokens de entrada e 400 de saída
(preços de setembro de 2026):

| Modelo | US$ / mil leituras |
| --- | --- |
| gpt-5-nano | 0,29 |
| gemini-2.5-flash-lite | 0,41 |
| gpt-4o-mini | 0,62 |
| claude-haiku-4-5 | 4,50 |
| claude-opus-5 (descartado) | 22,50 |

### D-6 — Nome padrão do documento

- **Escolha**: `AAAA-MM-DD_<KIND>_<contato-slug>_<valor>_<doc>.<ext>`, data de
  referência = vencimento (boleto/NF) ou criação; original em
  `originalFileName`.
- **Consequência**: a busca da aba Documentos por nome passa a achar por data,
  tipo, contato, valor e número.

## 7. Impacto

- [x] Schema / migration (`AstroPendingAction`, campos em `PaymentAttachment`)
- [x] Procedures oRPC — contrato **inalterado**; handlers viram wrappers
- [ ] Realtime
- [ ] Automações (Inngest)
- [x] Env vars novas — `ASTRO_FINANCE_EXTRACT_PROVIDER` e
      `ASTRO_FINANCE_EXTRACT_MODEL` (ambas opcionais). Sem elas, a chave vem de
      /integrations (cards OpenAI, Gemini, Anthropic) ou das variáveis de chave
      de cada provedor.
- [x] Breaking change — membros sem `PaymentAccess` perdem acesso financeiro pelo Astro (D-4)
- [x] Documentação — `docs/ASTRO_PROGRESS.md`, `docs/STARS_OVERVIEW.md`

## 8. Plano de testes

O projeto não tem runner de teste (CLAUDE.md, item 20). A verificação
automatizada rodou em dois scripts temporários, não versionados de propósito:
um só com lógica pura e outro contra o banco, que cria propostas de teste e as
apaga no fim. Deixá-los no repositório como scripts executáveis contra o Neon
seria arriscado. Resultado em 2026-09-15: **61 checagens, 0 falhas** (30 de
lógica, 31 de banco). Cada checagem cita o critério no nome.

| Critério | Tipo | Como verificar | Resultado |
| --- | --- | --- | --- |
| CA-1 | automatizado | Gate de permissão com usuário sem `PaymentAccess` | ok |
| CA-2 | automatizado | "A receber" e "a pagar" do painel = soma da lista com o mesmo filtro; tool do painel = serviço | ok |
| CA-3 | manual | Anexar boleto, pedir "lança isso" duas vezes; conferir `StarTransaction` | pendente: exige chave de IA em /integrations |
| CA-4 | manual | Confirmar a proposta; abrir Documentos e o lançamento | pendente: exige login e leitura real |
| CA-5 | automatizado | Proposta com `expiresAt` vencido não executa e vira `EXPIRED` | ok |
| CA-6 | automatizado | `create_payment_entry` devolve `astro_confirmation` e a contagem de lançamentos não muda | ok |
| CA-7 | automatizado | Proposta com mesmo valor e vencimento de lançamento existente traz "Possível duplicado" | ok |
| CA-8 | automatizado + manual | Dígito trocado em cada campo da linha digitável é detectado, em cobrança e arrecadação | lógica ok; rebaixa de confiança na leitura real pendente |
| CA-9 | manual | Abrir Painel, Fluxo, Projeção, DRE e lista no mesmo banco antes e depois | pendente |

Também verificados: CB-6 (outro usuário não confirma), CB-7 (segunda
confirmação não executa de novo), cancelamento, parcelas que não somam o total,
data inválida, âncoras públicas do fator de vencimento (1000 = 03/07/2000,
9999 = 21/02/2025), CPF e CNPJ de referência, nome padrão do documento e a
composição das 21 tools do pack depois da divisão em módulos.

## 9. Riscos e rollback

- Migration aditiva (tabela nova + colunas nulas). Rollback: `DROP TABLE
  astro_pending_actions; DROP TYPE ...; ALTER TABLE payment_attachments DROP
  COLUMN ...`.
- Qualidade do gpt-4o(-mini) ao decidir chamar `read_financial_document`:
  mitigado por `classifyComplexity` (termos financeiros → gpt-4o) e descrições
  diretivas.
- Alucinação de dígitos: validação determinística rebaixa confiança; a proposta
  sempre exibe os campos para conferência.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-15 | Weydson | Criada |
| 2026-09-15 | Weydson | D-5: extração deixa de ser Anthropic fixa e passa a multi-provedor por custo, com chave vinda de /integrations |
| 2026-09-15 | Weydson | Verificação automatizada de CA-1, CA-2, CA-5, CA-6, CA-7, CB-6 e CB-7 (61 checagens); `read.ts` e `write.ts` do pack divididos em módulos abaixo de 400 linhas |
