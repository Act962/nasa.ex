# Playbook de experiência dos Apps (celular primeiro)

> Pacote de melhorias aplicado em outubro/2026 em **Formulários, Campanhas, Agenda, Forge e STAR FRIENDS**.
> Use este documento como checklist ao melhorar qualquer outro App da ÓRBITA. Ele complementa o
> [`design-system-overview.md`](design-system-overview.md) (tokens, componentes base e regra de lint):
> lá está **o que** usar; aqui está **como montar a tela** de um App.

## Princípios

1. **Celular é o caso principal.** Desenhe para ~375px e depois amplie (`sm`/`md`/`lg`). O computador mantém tabelas e abas; o celular ganha cartões, gavetas e menu de baixo.
2. **Menos elementos na tela.** Uma ação principal à vista; o resto em `⋯` (DropdownMenu) ou em gaveta. Avisos importantes viram popup com **Entendi**, não caixas fixas.
3. **Sem rolagem desnecessária.** Etapas, abas em pílula ou gavetas em vez de páginas longas. Conteúdo explicativo em abas (ex.: Benefícios · Custos · Como conectar).
4. **Tudo redondo e no token.** Elementos pequenos `rounded-full`; cartões `rounded-[18px]`–`[20px]`; destaques `rounded-[24px]`. Só tokens de cor (sem hex, sem `purple/indigo`). Ícones lucide, **nunca emoji** em rótulo.
5. **Linguagem simples.** Nada de jargão sem explicação (webhook, token, CRM): use o termo do cliente e um ícone ⓘ com cartão explicativo. Não chamar coisa externa de "app" (confunde com a ÓRBITA) — ex.: "conexão na Meta".
6. **Conduzir para a ÓRBITA.** Textos mostram o ganho de usar a plataforma (Chat da ÓRBITA, Astro, funil); nunca recomendam manter outra ferramenta.

## Estrutura padrão de uma tela de App

### 1. Barra de cima (`HeaderTracking`)
- `isTitleHidden` quando a página já mostra o próprio título (evita título duplicado).
- `astroCommand={{ examples, isHiddenOnMobile: true }}` para não poluir o topo do celular.
- App com identidade própria (ex.: Campanhas) pode trocar por uma barra própria com os números que importam (saldo, gasto) e atalho de relatório — ver `campanhas-top-bar.tsx`.

### 2. Topo da página
- Ícone do App em círculo (`size-10/11 rounded-full`, cor do App em `/15`) + título + subtítulo curto (1–2 linhas, `line-clamp-2`).
- **Celular:** o título é a **seção atual** (ex.: "Propostas"), porque a navegação está no menu de baixo.
- Ações secundárias (Configurações, Relatório) viram **botões redondos só com ícone** no celular (`AppReportButton isCompactOnMobile`).
- Ação principal da seção (ex.: "Nova proposta"): `h-11 w-full rounded-full` no topo da seção no celular; no computador volta ao lado direito.

### 3. Navegação
- **Computador:** `Tabs` com ícone lucide + texto, numa linha (`w-max` dentro de `scroll-hidden-x`).
- **Celular:** as abas saem (`max-md:sr-only`) ou viram linha que rola; as 4 seções principais vão para o **menu de baixo** (`useRegisterOrbitDock`): 2 à esquerda, ASTRO no centro, 2 à direita. Use `badgeCount` para pendências (ex.: resgates).
- Ação central própria no lugar do ASTRO quando ela é **a** ação da tela (ex.: "+ Bloco" no construtor, "Agendas" na Agenda): `centerAction`.
- Seção secundária que não cabe no menu: linha de abas que rola, ou item no topo.
- O menu **recolhe ao rolar** (bolinhas deslizam pelo arco até o centro; fica meia bola ou o ASTRO vai ao canto) e reabre perto do topo — já é global, não precisa fazer nada por tela.

### 4. Conteúdo
| Situação | Celular | Computador |
|---|---|---|
| Números/KPIs | `grid-cols-2 gap-2/3`, valor `text-lg`, rótulo `text-[12px]` | 3–5 colunas |
| Listas/tabelas | Cartões (`md:hidden`) com o essencial + `⋯` | `Table` (`max-md:hidden`) |
| Itens visuais (propostas, formulários, prêmios) | Grade `grid-cols-2` com miniatura | 3–4 colunas |
| Filtros | Pílulas numa linha que rola (`scroll-hidden-x -mx-4 px-4`) | Pílulas que quebram linha |
| Busca | Campo em pílula `h-11 rounded-full` na largura toda | `md:max-w-sm` |
| Formulário longo / edição | **Gaveta de baixo** (`Sheet side="bottom"` ou Dialog com `max-sm:` de bottom sheet), `rounded-t-[26px]`, `max-h-[88–92dvh]`, só o miolo rola, ação fixa embaixo `h-12 w-full rounded-full` | Dialog centralizado `rounded-[24px]` |
| Escolha de horário/data | Pílulas tocáveis (Manhã/Tarde/Noite, 30 em 30 min) + "Outro horário" | igual |
| Seleção única (tipo, modo) | Seletor em pílula `rounded-full bg-muted p-1`, ativo `bg-foreground text-background` | igual |

- Elementos encostam na margem da página no celular: sem cartão dentro de cartão; o contêiner externo perde borda/fundo (`max-lg:border-0 max-lg:bg-transparent`).
- Toque mínimo de 36px (`size-9`); botões de ícone redondos.
- Carrosséis: sem barra visível (`scroll-hidden-x` + `snap-x snap-mandatory`, itens `snap-start`), trilho até a borda.

### 5. Miniaturas fiéis
- Para documentos que o cliente recebe (proposta, formulário), a miniatura é **o próprio documento** em escala: `iframe` da página pública com `?preview=1` (não conta visualização), montado só quando entra na tela (`IntersectionObserver`), escala pela largura real (`ResizeObserver`), `pointer-events-none`, formato 3:4. Referência: `proposal-thumbnail.tsx`.
- Quando dá para renderizar o componente direto (formulário), use os mesmos componentes do público em escala (`FormFirstGroupThumbnail` com `scope="first-page"`, `aspectRatio={3/4}`).

### 6. Avisos, ajuda e Astro
- **Aviso de um passo:** popup com ícone, texto com **destaques** (`**texto**`), botão **Entendi** e "Não entendi, Astro me explique melhor" (abre o Astro já com a pergunta).
- **Aviso geral do fluxo:** popup **uma vez só** (lembrado no navegador), não caixa fixa.
- **Termos técnicos:** `GuideTermsText` + glossário (`guide-glossary.ts`) — ⓘ na primeira ocorrência, cartão explicativo ao tocar.
- **Fluxos longos (ex.: conectar algo externo):** no celular, avise que é melhor no computador ("Copiar link para o computador" / "Continuar pelo celular"). Botão da ação externa grande e no topo; print sempre visível com **lupa** ao arrastar o dedo (`guide-shot.tsx`).
- **Astro:** ao criar um App novo, inclua o pack de prompt dele com glossário simples, custos e "direção" de resposta (ver `astro/lib/prompts/whatsapp-setup.ts`).

### 7. Loading, vazio e números
- Loading: **sempre** `OrbitaSpinner` (ou `Spinner` do ui, que o envolve). Em botão azul: `isOnBrandColor`.
- Vazio: cartão tracejado `rounded-[22px] border-dashed` com ícone em círculo `bg-muted` e frase curta orientando a próxima ação.
- Valores que importam (saldo, disponível, gasto) sempre visíveis — mesmo zerados (`R$ 0,00`).

## Checklist ao melhorar um App

- [ ] Título aparece uma vez só; barra de cima sem título duplicado e sem ícone de comando no celular.
- [ ] Topo: ícone redondo + título (seção atual no celular) + subtítulo curto; ações secundárias em botões redondos.
- [ ] Menu de baixo registrado com as 4 seções principais (e `badgeCount` onde houver pendência).
- [ ] Abas do computador com ícones lucide, sem emoji; no celular saem ou rolam.
- [ ] KPIs em 2 colunas no celular.
- [ ] Toda tabela tem versão em cartões no celular.
- [ ] Filtros em linha que rola; busca em pílula.
- [ ] Formulários/edições longas viram gaveta de baixo no celular, com ação fixa.
- [ ] Nada passa da tela: gavetas sem `w-full` (o padrão já flutua a 8px), `min-w-0` em flex, sem larguras fixas (`w-52`, `w-[300px]`) sem breakpoint.
- [ ] Sem hex/cores soltas, sem `rounded-md/lg` em elemento pequeno, sem emoji em rótulo, loading com `OrbitaSpinner`.
- [ ] Textos simples, sem jargão; ⓘ onde houver termo técnico; avisos como popup com Entendi.
- [ ] `npx eslint` nos arquivos alterados sem erro novo; `pnpm guides:check` se mexeu em `data-guide`.

## Implementações de referência

| Padrão | Arquivo |
|---|---|
| Menu de baixo + recolher ao rolar + ação central | `src/components/orbit-dock/orbit-dock.tsx`, `use-collapse-orbit-dock-on-scroll.ts`, `orbit-dock-store.ts` |
| Barra de cima com números do App | `src/features/campanhas/components/campanhas-top-bar.tsx` |
| Topo + abas + menu (seção atual como título) | `src/features/forge/components/forge-page.tsx`, `src/features/star-friends/components/star-friends-page.tsx` |
| Seção explicativa em abas + simulador com slider | `src/features/campanhas/components/self-service/connect-number-intro.tsx` |
| Miniatura fiel (iframe) | `src/features/forge/components/proposals/proposal-thumbnail.tsx` |
| Miniatura por componente | `src/features/form/components/form-first-group-thumbnail.tsx` |
| Tabela → cartões | `src/features/forge/components/products/product-card-list.tsx`, `contracts/contract-card-list.tsx`, `star-friends/components/members-list.tsx` |
| Gaveta de baixo + pílulas de horário | `src/features/agenda/components/create-appointment-modal.tsx` |
| Gavetas de atalho ligadas ao menu | `src/features/agenda/components/quick-menu/*` |
| Popup Entendi + Astro + ⓘ + lupa no print | `src/features/meta-guide/components/meta-guide-stepper.tsx`, `guide-terms-text.tsx`, `guide-shot.tsx`, `stay-on-track.tsx` |
| Calendário estilo Google (mês + dia) | `src/features/agenda/components/agenda-mobile-calendar.tsx`, `agenda-day-timeline.tsx` |
| Pasta atual como título + pastas em pílulas + gaveta de pastas | `src/features/nbox/components/nbox-app.tsx`, `nbox-folder-navigation.tsx` |
| Pré-visualização em gaveta (imagem, PDF, link) | `src/features/nbox/components/nbox-item-preview-sheet.tsx` |
| Sombra "tem mais itens" em lista rolável | `src/components/sidebar/sidebar.tsx` (`useHasMoreBelow`) |
| Ação central que muda com a seção (Novo link / Salvar) + Dialog que vira gaveta de baixo com ação fixa | `src/features/linnker/components/linnker-editor.tsx`, `linnker-sheet-dialog.tsx` |
| Lista de seções de configurações (linha com ícone redondo + título + descrição + seta; seção abre com voltar) + linha de ajuste (texto à esquerda, controle à direita) + salvar fixo embaixo | `src/features/settings/components/shell/settings-shell.tsx`, `settings-mobile-home.tsx`, `settings-section-row.tsx`, `settings-row.tsx`, `settings-sticky-save.tsx` |

## Changelog

- 2026-10-05 — Planner (2ª passada): barra do calendário reorganizada no celular (navegação + Criar, seletor de visão na largura toda, filtros em linha que rola), Roteiro em cartões, Kanban com `snap`, janelas de importação como gaveta de baixo; editor de mapa mental com visão Lista (padrão no celular) e menu de baixo próprio com `useHideOrbitDock`.
- 2026-10-04 — Planner: abas no topo (Dashboard, Calendário, Campanhas, Mapas Mentais, Kit da Marca) em pílulas com rolagem horizontal no celular; Kanban por status com colunas de 256px roláveis na horizontal; menu de baixo Dashboard/Calendário/Criar/Kanban/Planners.
- 2026-10-04 — Aplicado no Planner v2 (calendário Semana/Mês vira agenda em cartões no celular, menu de baixo Hoje/Rascunhos/Criar/Aprovação/Planners, criador em passos e revisão em gaveta de baixo, filtros em pílulas, cliente identificado por anel de cor em token).
- 2026-10-02 — Aplicado no NASA Route (vitrine com Catálogo/Meus cursos e cursos em grade de 2, painel do criador com capas e KPIs em 2 colunas, Vendas/Alunos em cartões com filtro em pílulas, formulários em gaveta de baixo com ação fixa, player com vídeo na largura toda e gaveta de aulas, menu de baixo do aluno/criador/player).
- 2026-10-02 — Aplicado no Pages (lista de sites em grade de 2 colunas com miniatura fiel da prévia em `?preview=1` sem barra nem pixels, números em 2 colunas, busca e filtros em pílulas, menu de baixo Sites/Templates/Novo site/Último editado; no editor, painéis laterais viram gavetas de baixo pelo menu Camadas/Páginas/Editar/Ajustes com "+ Bloco" no centro; assistente de novo site, prévia de template e domínio em gaveta de baixo).
- 2026-10-02 — Aplicado no Linnker (seção atual como título e menu de baixo Links/Aparência/QR Code/Visitas no editor, ação central Novo link/Salvar, miniatura fiel da página pública com `?preview=1`, números em 2 colunas, busca e filtros em pílulas, formulários de página e link em gaveta de baixo, prévia em gaveta no celular, emojis dos rótulos trocados por ícones).
- 2026-10-02 — Aplicado no trafeGO (painel do cliente: números sempre à vista, filtros em pílulas e busca, seção atual como título e menu de baixo no pedido, texto do anúncio e "Confirmar PIX" em gaveta de baixo, selos de status em tokens).
- 2026-10-02 — Aplicado em Configurações (lista de seções no celular com voltar, abas em pílula no computador, perfil em linhas de ajuste, membros/convites/links em cartões com busca, notificações com Switch e ícones no lugar de emoji, diálogos em gaveta de baixo, salvar fixo nos formulários da empresa).
- 2026-10-02 — Aplicado no N-Box (Enviar no centro do menu, pastas em pílulas e gaveta, pré-visualização em gaveta).
- 2026-10-02 — Primeira versão, consolidando Formulários, Campanhas, Agenda, Forge e STAR FRIENDS.
