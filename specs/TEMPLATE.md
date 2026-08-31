---
id: NNNN
titulo: <Título curto e imperativo>
dominio: <form | trackings | leads | actions | insights | stars | admin | integrations | ...>
status: rascunho # rascunho | em-revisao | aprovada | implementada | descartada
autor: <nome>
criada: AAAA-MM-DD
atualizada: AAAA-MM-DD
branch: feature/<app>-<desc>-<AAAAMMDD>
pr: # preenchido no /ship
peso: leve # leve | completa
---

# NNNN — <Título>

> **Como usar este template**: apague os comentários em itálico ao escrever.
> Spec **leve** preenche as seções 1–5 e 9. Spec **completa** preenche todas.
> Ver [README.md](README.md) para saber qual peso usar.

---

## 1. Contexto

_Por que isto existe. Qual dor, de quem, com que frequência. Se for bug, inclua
evidência real: log, stack, query, print. Sem contexto, a spec vira burocracia._

## 2. Objetivo

_Uma frase. O que passa a ser verdade quando isto estiver pronto._

### Não-objetivos

_O que explicitamente NÃO entra. Esta seção é a que mais economiza tempo em
revisão — é onde o escopo para de crescer._

- ...

## 3. Requisitos

_Numerados para dar rastreabilidade: testes e código citam `RF-1`, `RNF-1`._

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | ... |
| RF-2 | ... |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | _ex: submit responde em < 1s no p95_ |

## 4. Critérios de aceite

_Verificáveis e binários. Se não dá pra provar com um teste ou um passo manual,
não é critério de aceite — é desejo. Cada `CA-n` vira pelo menos um teste._

- [ ] **CA-1** — Dado _<estado>_, quando _<ação>_, então _<resultado observável>_.
- [ ] **CA-2** — ...

## 5. Casos de borda

_A seção mais importante para este projeto. Enumere o que é raro, concorrente,
duplicado, vazio, nulo, offline ou fora de ordem. Marque o comportamento
esperado de cada um._

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | ... | ... |
| CB-2 | ... | ... |

## 6. Decisões de design

_O **porquê**, não o **como**. Registre a alternativa descartada — é isso que
impede a decisão de ser revertida sem querer daqui a seis meses._

### D-1 — <decisão>

- **Escolha**: ...
- **Alternativas descartadas**: ... _(e por quê)_
- **Consequência**: ...

## 7. Impacto

_Marque o que se aplica; detalhe abaixo._

- [ ] Schema / migration (`prisma/schema.prisma`)
- [ ] Procedures oRPC (contrato de entrada/saída)
- [ ] Realtime (Pusher / event-bus)
- [ ] Automações (Inngest)
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes
- [ ] Documentação obrigatória (CLAUDE.md itens 10 / 14 / 16)

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | automatizado / manual | ... |

## 9. Riscos e rollback

_O que pode dar errado em produção e como se desfaz. Para mudança de schema,
diga se a migration é reversível._

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| AAAA-MM-DD | ... | Criada |
