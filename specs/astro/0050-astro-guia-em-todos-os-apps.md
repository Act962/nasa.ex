---
id: 0050
titulo: Astro Guia em todos os apps restantes
dominio: astro
status: em-revisao
autor: Weydson
criada: 2026-09-30
atualizada: 2026-09-30
branch: feature/W-astro-guias-outros-apps-20260930
pr:
peso: leve
---

# 0050 — Astro Guia em todos os apps restantes

> Fecha a cobertura iniciada na [0046](0046-astro-guia-na-tela.md), [0048](0048-astro-guia-em-outros-apps.md) e [0049](0049-astro-guia-workspace-financeiro-campanhas-contatos-equipe.md).

## 1. Contexto

Depois da 0049, 10 áreas tinham guia na tela. Ficavam de fora trafeGO, Pages,
Linnker, N-Box, Planner, Route, Space Station, STAR FRIENDS, Integrações,
Insights, Comments, Astro/Astro Chat e NERP. O mapeamento mostrou três
situações novas:

1. **Guia que atravessa para página pública.** O assistente do trafeGO mora em
   `/trafego` (fora da plataforma), onde o overlay do guia não existia.
2. **Guia que termina em login de terceiros.** Integrações (Meta/Google) e NERP
   saem do site para autorizar; não há como acompanhar lá.
3. **Passo que o usuário cumpre navegando por conta própria.** Ex.: Linnker só
   abre o editor pelo menu ⋯ → Editar; o passo "abra a página" precisa perceber
   que a rota mudou.

## 2. Objetivo

Um guia para cada app da plataforma, na mesma PR, sem schema novo.

### Não-objetivos

- Acompanhar o usuário dentro do site da Meta, do Google ou do NERP.
- Guiar o pagamento do trafeGO: o guia para antes de "Finalizar e contratar".
- Guia do avatar dentro do mundo da Space Station (página pública em nova aba).
- Substituir a PR #421 (guia do Instagram com prints): este guia usa só telas
  que já estão na `main`.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Guias novos (22, com 44 no total): WhatsApp oficial (conectar número na API da Meta, pelo assistente de Campanhas), trafeGO (pedido), Pages (criar, publicar), Linnker (criar, adicionar link), N-Box (enviar arquivo, criar pasta), Planner (criar planner, criar post), Route (criar curso, adicionar aula), Space Station (criar), STAR FRIENDS (criar prêmio), Integrações (conectar), NERP (conectar), Insights (salvar relatório, adicionar indicador), Comments (conectar Instagram, resposta automática), Astro (permissões dos agentes, colocar o Astro no site). |
| RF-2 | `skipWhenPath` é reavaliado a cada troca de rota, não só ao entrar no passo. A navegação para `route` continua só na entrada. |
| RF-3 | Rota de passo com query (`/payment?tab=payables`, `/astro?aba=permissoes`) compara caminho **e** busca; sem query, só o caminho. |
| RF-4 | O layout público do trafeGO monta o `TourOverlay`, para o guia continuar depois do clique em "Nova campanha". |
| RF-5 | Guias que saem para login de terceiros terminam no clique/explicação; o cartão final diz como é a volta. |
| RF-6 | `pnpm guides:check` aceita âncora repassada por prop de componente próprio (`guideAnchorId={GUIDE_ANCHORS.x.id}`), não só `data-guide=`. |

## 4. Critérios de aceite

- [x] **CA-1** — 55 frases de teste caem no guia certo (novas e antigas); ordens diretas seguem fora.
- [x] **CA-2** — `pnpm guides:check` passa com 44 guias.
- [x] **CA-3** — Guia "Adicionar link no Linnker": abrir o editor pelo menu ⋯ → Editar avança o passo sozinho (RF-2).
- [x] **CA-4** — Guia do trafeGO: o clique em "Nova campanha" leva à página pública e o passo do assistente aparece lá (RF-4).
- [x] **CA-5** — Guia "Criar pasta" termina com o cartão final ao salvar (o de planner usa o mesmo mecanismo e não foi percorrido no navegador).
- [x] **CA-6** — Guias da 0046–0049 continuam funcionando (conta a pagar abre a aba certa — RF-3).

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | STAR FRIENDS não instalado | Aba de prêmios não existe → `missingMessage` pede para instalar. |
| CB-2 | Sem permissão (Insights, Astro Chat, STAR FRIENDS, Integrações) | Botão não renderiza → `missingMessage` específica. |
| CB-3 | NERP ou Instagram já conectados | Botão/cartão de conexão não existe → `missingMessage` explica. |
| CB-4 | Space Station já criada | O botão vira "Salvar Perfil"; o guia termina ao salvar (`station.saved`). |
| CB-5 | Criação do curso navega com recarga completa (fallback do Route) | O resultado é emitido antes da navegação; o estado do guia (sessionStorage) mostra o cartão final depois do reload. |
| CB-6 | Pages e Linnker cobram Stars | As mensagens dos passos avisam o custo antes do clique. |

## 9. Riscos e rollback

Só front. Mudanças de comportamento fora dos guias: `TourOverlay` no layout
público do trafeGO (só aparece com guia ativo) e o `ActionButton` do Insights
ganhando a prop opcional `guideAnchorId`. Rollback: remover os guias do
`ASTRO_GUIDES`; âncoras e emissores ficam inertes sem guia ativo.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-30 | Weydson | Criada |
| 2026-10-01 | Weydson | "Como criar um número na API oficial do WhatsApp?" caía no guia do Insights (o padrão dele aceitava \"números\"). Tirado \"números\" do Insights e criado o guia do número oficial (aviso + assistente de Campanhas). Integrado o guia do Instagram da PR #421 (spec 0047): o guia do Comments passou a usar o botão \"Conectar Instagram passo a passo\" e o diálogo dele. Specs do Astro Guia renumeradas 0048–0050. |
| 2026-09-30 | Weydson | Teste no navegador (org ASTRO QA): pasta do N-Box, página e link do Linnker (inclui o pulo de passo por navegação), trafeGO até o assistente e conta a pagar na aba certa. O trafeGO sem pedido anterior não abre o assistente sozinho → passo "Montar minha campanha" com `skipWhenVisible`. |
