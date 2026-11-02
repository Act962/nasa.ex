---
id: 0127
titulo: Limite de anúncios rodando ao mesmo tempo, por faixa de verba
dominio: trafego
status: implementada
autor: Weydson Lima (com Claude)
criada: 2026-10-31
atualizada: 2026-10-31
branch: feature/W-trafego-ux-20261031
pr:
peso: leve
---

# 0127 — Limite de anúncios rodando ao mesmo tempo, por faixa de verba

## 1. Contexto

O limite de criativos de uma campanha (`TrafegoOrder.maxCreatives`) contava **todo arquivo enviado**: 3 por
padrão (`TrafegoSettings.includedCreatives`), extra a R$ 40 cada. Com o painel novo (spec 0126) o cliente
publica e troca anúncios sozinho, e contar o total pune justamente quem testa e troca o criativo que não
performa. Também não fazia sentido o mesmo limite para R$ 300 e para R$ 5.000 de verba: com pouca verba,
muitos anúncios dividem a entrega e nenhum aprende.

Não existe hoje fluxo de compra de criativo extra pelo painel (o model `TrafegoCreativeTopUp` não tem uso).

## 2. Objetivo

Cada campanha tem um número de **anúncios rodando ao mesmo tempo** que cresce com a verba; trocar anúncio é
livre, e passar do limite pede liberação da equipe (cobrada como extra, valor fixo).

### Não-objetivos

- Cobrar percentual por criativo (descartado: criativo extra é trabalho fixo da equipe, não proporcional à verba).
- Fluxo de compra do extra pelo painel: nesta etapa a equipe cobra pela Cobrança e libera no admin.
- Limitar anúncios criados direto no Gerenciador da Meta: só o que passa pelo Órbita (o gasto real já paga 30%).

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Anúncios incluídos por verba: até R$ 500 → 3; R$ 501 a R$ 2.000 → 5; acima de R$ 2.000 → 8 (`lib/creative-limits.ts`). |
| RF-2 | Pedido novo nasce com `maxCreatives` = incluídos da faixa (+ extras comprados no checkout, se houver). Pedidos antigos mantêm o valor que já têm. |
| RF-3 | O limite vale para **anúncios no ar ao mesmo tempo** nas campanhas do pedido (anúncio e campanha com status ACTIVE na Meta). Pausado ou arquivado libera a vaga. |
| RF-4 | Publicar e retomar pelo painel recusam quando passaria do limite, com a mensagem "Esta campanha roda até N anúncios ao mesmo tempo. Pause um anúncio ou peça mais à equipe." Trocar anúncio não conta (sai um, entra outro). |
| RF-5 | Envio de arquivos de criativo deixa de usar `maxCreatives`: teto técnico de 20 arquivos por pedido, só contra abuso. |
| RF-6 | O admin do pedido ganha "Anúncios ao mesmo tempo" para liberar mais (depois de cobrar o extra). |
| RF-7 | O extra continua com valor fixo (`TrafegoSettings.extraCreativeBrlCents`). |

## 4. Critérios de aceite

- [ ] **CA-1** — Verba R$ 500 → 3 anúncios; R$ 501 → 5; R$ 2.000 → 5; R$ 2.001 → 8.
- [ ] **CA-2** — Com 3 anúncios no ar e limite 3, publicar outra campanha do pedido é recusado com a mensagem do RF-4; pausando um, publica.
- [ ] **CA-3** — Anúncio pausado ou campanha pausada não conta como "no ar".
- [ ] **CA-4** — Trocar o anúncio de uma campanha no ar não é barrado.
- [ ] **CA-5** — Pedido com 3 arquivos enviados e limite 3 aceita o 4º arquivo.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Pedido antigo com `maxCreatives` maior que a faixa | Mantém o maior: nada é reduzido. |
| CB-2 | Campanha com 2 anúncios sendo publicada e 2 vagas livres | Publica: a conta é anúncios novos + no ar ≤ limite. |
| CB-3 | Falha ao ler a Meta antes de publicar | Recusa com a mensagem da Meta (não publica sem saber o que está no ar). |
| CB-4 | Retomar pelo Astro (spec 0125) | Fora desta etapa: o cartão do Astro não confere o limite (dívida registrada). |

## 9. Riscos e rollback

- Cliente com verba alta e muitos criativos antes da mudança: não perde nada (CB-1).
- Rollback: reverter o PR; `maxCreatives` continua no banco. A coluna `TrafegoSettings.includedCreatives` deixa de ser usada e sai em migration separada depois do deploy (S9).

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-31 | Weydson Lima (com Claude) | Criada e implementada, a partir da conversa sobre limite de criativos por campanha. |
