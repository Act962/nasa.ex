---
id: 0068
titulo: Planejamento semanal em mapa mental (cards, links, Lista no celular e Criar conteúdos)
dominio: nasa-planner
status: implementada
autor: Weydson + Claude
criada: 2026-10-05
atualizada: 2026-10-05
branch: feature/W-orbita-melhorias-ui-ux-2-20261004
pr: Act962/nasa.ex#431
peso: leve
---

# 0068 — Planejamento semanal em mapa mental

## 1. Contexto

Os mapas mentais do Planner eram soltos do conteúdo: tópicos, notas e cards de ação, sem ligação com os posts, sem links e difíceis de usar no celular (botões pequenos, só canvas). O usuário quer planejar a semana no mapa e, dele, criar os conteúdos.

## 2. Objetivo

A semana vira um mapa (dia → posts, links, notas), utilizável no computador e no celular, nos dois sentidos: roteiro → mapa e mapa → conteúdos.

### Não-objetivos

- Reescrever o editor antigo (segue com os mesmos nós e atalhos).
- Mapa em colunas verticais no celular (o Mapa usa a mesma organização do computador; a visão do celular é a Lista).
- Criar a arte pelo mapa.

## 3. Requisitos

| ID | Requisito |
| --- | --- |
| RF-1 | **Planejar a semana** (aba Mapas Mentais): escolhe a semana e cria um mapa `template = "weekly"` já montado — raiz com a semana (`weekStartIso`, `organizationId`), um tópico por dia (segunda a domingo) com o tema do dia, e um card por post da semana. Sem migration: nós e ligações moram no JSON do mapa. |
| RF-2 | Novos nós: **card de conteúdo** (`postNode`: post do Planner; status, horário e título lidos na hora, não copiados) e **link** (`linkNode`: nome + URL, abre em outra aba). Tocar abre uma janela (gaveta no celular) com Abrir no Planner / Abrir link / editar / apagar. |
| RF-3 | Visões **Mapa | Lista**. Lista: cada tópico é um bloco com seus itens e botões + Card / + Link / + Nota / + Tópico. No celular a Lista é a padrão e as ações ficam num menu de baixo próprio (o menu em órbita sai enquanto o editor está aberto). |
| RF-4 | **Criar conteúdos**: cada card novo dentro de um dia vira pauta (`IDEA`) no dia certo, com o tema do dia como objetivo e links/notas do card como referência; opção "Escrever roteiro e legenda com o Astro" (kit completo; um prompt por conteúdo). Card criado passa a apontar para o post. |
| RF-5 | **Atualizar com o roteiro**: acrescenta os posts da semana que faltam e atualiza o tema dos dias, sem apagar nada. **Organizar**: realinha o mapa em árvore. |

## 4. Critérios de aceite

- [x] **CA-1** — Mapa da semana 05–11/10 do GOTHAN CODEX montado com os dias, temas e posts, mais links, nota, cards novos e um tópico extra (mapa "Semana 05/10–11/10 · exemplo").
- [x] **CA-2** — `listPendingContents` devolve só os cards novos dentro de um dia, com dia, horário, tema e referências certos.
- [x] **CA-3** — Typecheck e lint dos arquivos novos e do editor.
- [ ] **CA-4** — Conferir na tela: Mapa e Lista, no computador e no celular; Criar conteúdos com e sem o Astro. (Não conferido visualmente.)

## 5. Decisões

- **D-1 — Estender o editor antigo, peças novas em arquivos próprios** (`components/mind-map/*`, `lib/mind-map/*`), em vez de reescrever 1.300 linhas.
- **D-2 — Tudo pelo cliente com as procedures que já existem** (`posts.createForClient`, `brandKit.generateScripts`, `mindMaps.create/update`). `mindMaps.create` só passou a aceitar `template: "weekly"` e nós/ligações iniciais.
- **D-3 — Status do post não é copiado para o mapa**: o card guarda só o `postId` e lê o resto do calendário.

## 6. Changelog

- 2026-10-05 — criada e implementada.
