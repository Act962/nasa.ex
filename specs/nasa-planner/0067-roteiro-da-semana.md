---
id: 0067
titulo: Roteiro da semana no Planner — tema por dia, pautas, colar roteiro e visão em tabela
dominio: nasa-planner
status: implementada
autor: Weydson + Claude
criada: 2026-10-04
atualizada: 2026-10-04
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr:
peso: leve
---

# 0067 — Roteiro da semana no Planner

## 1. Contexto

O usuário planeja a semana num texto: tabela (dia, formato, objetivo/gatilho, conteúdo principal, CTA) e, por dia, roteiro e descrição. O Planner só guardava post a post, sem objetivo, sem tema recorrente do dia e sem entrada para o roteiro inteiro.

## 2. Objetivo

Colar o roteiro da semana e ter as pautas por dia; ver e fixar o tema de cada dia da semana; criar a arte de cada pauta a partir de uma lista; ver a semana em tabela.

### Não-objetivos

- Publicar enquete de Story (a Meta não expõe na API).
- Tema do dia para vários clientes ao mesmo tempo (é por cliente).

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | Tema fixo por dia da semana e por cliente (`NasaPlannerWeekdayTheme`, único por `organizationId + weekday`). Na visão Semana, etiqueta acima do dia, editável no clique por quem pode criar; aparece com um cliente em vista. |
| RF-2 | Post ganha `objective` (Objetivo / Gatilho) e usa o `cta` que já existia. Editáveis no passo Roteiro; post novo nasce com o tema do dia como objetivo. |
| RF-3 | "+ Criar → Conteúdo (roteiro da semana)": cola o texto, o Astro separa por dia **sem reescrever** (`planning.parseWeeklyScript`), o usuário confere e cria as pautas (status `IDEA`, rótulo "Pauta") na semana visível (segunda a domingo; se já passou, a próxima). Opção de usar os objetivos como tema fixo dos dias. |
| RF-4 | Filtro "Conteúdo" entre o cliente e o Tipo: lista os conteúdos do período com **Criar** (pauta sem arte) ou **Abrir**. Visão "Roteiro": a semana em tabela (Dia, Formato, Objetivo/Gatilho, Conteúdo principal, CTA, Status). |
| RF-5 | MCP: `get_brand_kit` devolve `weekdayThemes`; `create_draft` aceita `objective`/`cta` e, sem objetivo, usa o tema do dia. Astro: `planner_brand_kit_status` devolve `weekdayThemes`. |

## 4. Critérios de aceite

- [x] **CA-1** — Separação do roteiro devolve um item por publicação (dia com dois formatos = dois itens), com objetivo e CTA da tabela, roteiro e legenda do detalhe. (Testado no servidor com texto curto.)
- [x] **CA-2** — As 8 pautas da semana de 05/10 do GOTHAN CODEX têm objetivo e CTA nos campos próprios e os 7 temas de dia gravados.
- [ ] **CA-3** — Etiqueta do tema edita e remove pela tela; filtro Conteúdo e visão Roteiro conferidos no navegador. (Não conferido visualmente.)

## 5. Decisões

- **D-1 — Pauta = status `IDEA`**, sem tabela nova: a pauta já é o post (roteiro, legenda, CTA), só falta a arte. "Criar" abre o criador nele.
- **D-2 — Criação pelo cliente**, reutilizando `posts.createForClient` em sequência; o servidor só separa o texto. Falha no meio informa quantas foram criadas.
- **D-3 — Cobrança**: separar o roteiro conta como um prompt do Astro na chave da plataforma; chave da empresa não cobra.

## 6. Changelog

- 2026-10-04 — criada e implementada. Migration `20261005000000_planner_weekly_script`.
