# Design System Órbita — overview

Fonte de verdade do padrão visual da plataforma. Atualize na mesma sessão sempre que mudar tokens, componentes base ou concluir a migração de um App.

## Camadas

| Camada | Onde | O que mora ali |
| --- | --- | --- |
| 1. Tokens | `src/app/globals.css` (`:root` / `.dark`) | Cores, raio (`--radius: 1.85rem`), espaçamento (`--spacing: 0.28rem`), sombras, tracking, cores Órbita (`--panel`, `--line`, `--knob`), estados (`--success`, `--warning`, `--info`, `--destructive`), temperatura (`--temp-cold/warm/hot/very-hot`), marca dos canais (`--brand-whatsapp/instagram/facebook/messenger`) e de modelos de IA (`--brand-claude`) |
| 2. Componentes base | `src/components/ui/*` | Variações de Button, Input, Switch (linha + bolinha), Checkbox (redondo), Sidebar (cantos + alça de dois traços)… Mudar aqui muda todos os Apps |
| 3. Shells globais | `src/components/orbit-dock/` | Dock em órbita do celular (host único no layout, cada tela registra seus itens com `useRegisterOrbitDock`) |
| 4. Padrões de domínio | `src/features/<app>/components` | Card do lead, coluna, barra de filtros — montados só com a camada 2 |
| 5. Telas | `src/app/(platform)/…` | Só organizam padrões. Sem cor fixa (`#hex`, `bg-zinc-900`) nem `style=` de cor |

Base do tema: [tweakcn](https://tweakcn.com/editor/theme) monocromático + elementos do SVG Órbita.

## Decisões (Fase 0 — 2026-10-01)

| # | Decisão | Como ficou |
| --- | --- | --- |
| D-1 | Excluir e erro | **Vermelho suave**: `--destructive` vermelho; variante `destructive` de Button/Badge = fundo vermelho claro + texto vermelho. Erros de formulário usam `text-destructive`. |
| D-2 | Gráficos | **Tons do azul do ASTRO** em `--chart-1..5` (claro → marinho), com versão escura mais clara para contraste. |
| D-3 | Páginas públicas (formulário, agendamento, catálogo, chat público) | **Marca de cada cliente**: mantêm cores/logo configurados pela empresa; recebem só a base nova (cantos, campos em pílula, tipografia). Não aplicar a paleta monocromática da plataforma. |
| D-4 | Cor principal | `--primary` quase preto no claro / quase branco no escuro (o cinza médio do tweakcn parecia botão desativado e tinha contraste baixo). |
| D-5 | ASTRO | Disco azul (`sky-500 → blue-700`) com anel, olhos e efeitos em branco. No celular, o orb é o botão central do dock, sem fechar e sem arrastar. |
| D-7 | Cabeçalhos | Sem linha divisória (`border-b`) acima/abaixo de cabeçalhos e barras de busca; a separação vem do espaço e das superfícies. |
| D-6 | Navegação no celular | Dock em órbita em todas as telas da plataforma: ASTRO no centro, 2 itens de cada lado (padrão: Início, Trackings · Chats, Agenda). Sem botão de voltar nos cabeçalhos. |

## Componentes base (padrão aplicado)

| Componente | Padrão |
| --- | --- |
| Button / Input | Pílula; botão encolhe 3% ao apertar; `destructive` em vermelho suave |
| Switch / Checkbox | Linha + bolinha / check redondo (elementos do SVG). Switch ligado = azul do ASTRO (`info`, bolinha `bg-info` e linha `bg-info/45`); desligado = cinza (`bg-knob` + linha `bg-line`) |
| Sheet | Flutuante (8px da borda), cantos `--radius − 6px`, borda em linha; fechar = círculo `bg-knob`. O menu lateral do celular sobrescreve para ficar encostado à esquerda |
| Dialog / AlertDialog | Cantos `--radius`, borda em linha, `bg-popover`; fechar = círculo |
| Dropdown / Context / Select / Command | Caixa 20px, borda em linha, sombra grande; itens em pílula. Nunca passam da tela (`max-w-[calc(100vw-1rem)]`); o botão do select nunca passa de quem o contém (`max-w-full`, texto com reticências). Não use `min-w-[...]` fixo em `SelectTrigger` — no CSS a largura mínima vence a máxima |
| Popover / HoverCard | Caixa 24px, borda em linha |
| Tabs | Trilho em pílula (`bg-panel`); aba ativa preenchida (`bg-foreground`) |
| Tooltip | Pílula escura com sombra |
| Toast (sonner) | `@/components/ui/sonner` no layout raiz; caixa 20px; no celular sobe acima do dock |
| Card / Alert / Empty | Cantos `--radius`/20px, borda em linha; ícone do Empty num círculo `bg-knob` |
| Skeleton | Brilho passando (`.orbita-shimmer`, respeita "reduzir movimento") |
| Loading (Spinner) | Sempre a marca da ÓRBITA girando: `OrbitaSpinner` (`@/components/orbita-spinner`) ou `Spinner` (`ui/spinner`, que o envolve). Nunca `Loader2`/`Loader` do lucide nem círculo de borda girando. Ícone de "atualizar" (`RefreshCw`) girando no próprio botão continua permitido |
| Formas | Tudo redondo: botões de ícone, amostras de cor (`input[type=color]` já é redondo pelo CSS global), miniaturas/avatares e chips = `rounded-full`; linhas e cartões pequenos = `rounded-[18px]`/`rounded-[20px]`. Nunca `rounded`/`rounded-md` em elemento quadrado pequeno |
| Rolagem horizontal (carrossel) | Sem barra visível: `scroll-hidden-x` + `snap-x snap-mandatory` e itens `snap-start`; no celular o trilho vai até a borda da tela (`-mx-4 px-4 scroll-px-4`). A barra escura `scroll-cols-tracking` fica só no kanban |

## Regra de lint

`orbita/no-hardcoded-color` (`eslint-rules/no-hardcoded-color.mjs`, nível **aviso**) aponta, em `src/**/*.tsx` fora de `src/components/ui`:
- classes de paleta fixa (`bg-zinc-900`, `text-blue-600`) e hex arbitrário (`bg-[#1447e6]`) em `className`, `cn()`, `cva()`;
- hex/rgb literal em `style` (`color`, `backgroundColor`, `borderColor`…).

Cor que vem do dado (variável) não é apontada. Ao migrar um App, zere os avisos dele; quando todos os Apps migrarem, a regra sobe para erro.

## Ritual por App

> Montagem de tela e celular: siga o [`apps-mobile-playbook.md`](apps-mobile-playbook.md) (estrutura padrão, checklist e referências).

1. Levantar o que a tela usa (componentes, cores fixas, `data-guide`).
2. Mock só se a estrutura mudar.
3. Definir os 4 itens do dock (`useRegisterOrbitDock`).
4. Trocar cores fixas por tokens; cor de dado (etapa, tag, temperatura) continua vindo do dado. Mapa padrão: vermelho → `destructive`, verde → `success`, âmbar/amarelo → `warning`, azul/roxo/IA → `info`, cinzas → `background`/`card`/`knob`/`foreground`/`muted-foreground`/`line`. Fundo claro de selo = `bg-<token>/15` + `text-<token>` + `border-<token>/30`. Escalas com 4+ níveis usam as cores de temperatura para não colapsar níveis.
5. Tirar `border-b`/`border-t` de cabeçalhos e barras do App (D-7).
6. Testar celular e desktop, claro e escuro.
7. `pnpm guides:check` — guias do Astro continuam achando os botões (manter os mesmos `data-guide`).
8. Uma branch e um PR por App.

## Roadmap

| Fase | Escopo | Status |
| --- | --- | --- |
| 0 | Decisões D-1…D-6 | ✅ |
| 0 | Componentes base restantes (sheet, dialog, dropdown, select, tabs, toast, tooltip, card, empty, skeleton) + regra de lint contra cor fixa | ✅ |
| 1 | Tracking, Contatos/lead, Chat, Agenda — 0 avisos de cor | ✅ |
| 2 | Início (NASA Command) + painel do ASTRO — 0 avisos de cor; gráficos nos tons do ASTRO | ✅ |
| 3 | Workspaces/Tarefas, Formulários, Campanhas — cores em tokens, sem linhas nos cabeçalhos, dock de cada App | ✅ |
| 4 | Insights, Payment, Contábil, Forge — cores em tokens, gráficos nos tons do ASTRO (`src/lib/chart-palette.ts`), abas em pílula, dock de cada App | ✅ |
| 5 | Pages, Satélites (Integrações), ÓRBITA Planner, Comando, trafeGO, Linnker — cores em tokens, abas em pílula, dock de cada App | ✅ |
| 6 | Space Help, Stars, Space Point, Space Page (área logada e página pública), ÓRBITA Route — Space Station fica fora (mundo de jogo com arte própria) | ✅ |
| 7 | Admin — tokens seguindo o tema, abas em pílula, menu em gaveta no celular | ✅ |
| 8 | Sobras fora das fases: portal do parceiro, alertas, configurações, sino, assinatura, telas de auth, onboarding, NERP, Star Friends, workflows, tags, N-Box e telas pontuais | ✅ |

## Changelog

- 2026-10-02 — Playbook de experiência dos Apps (`docs/apps-mobile-playbook.md`), consolidando Formulários, Campanhas, Agenda, Forge e STAR FRIENDS.
- 2026-10-02 — Campanhas com identidade WhatsApp/Meta: token `brand-whatsapp-deep` (#103928), selo Meta Tech Provider (`public/campanhas/meta-tech-provider.png`), topo com saldo (disponível hoje + gasto no mês) e assistente da Meta em tela cheia no celular.
- 2026-10-02 — Regra de formas: elementos pequenos redondos; seletor de cor global redondo; botões de ícone quadrados convertidos (13 arquivos).
- 2026-10-02 — Loading padrão = `OrbitaSpinner` (codemod em ~280 arquivos, `Spinner` do ui passa a usá-lo); padrão de carrossel sem barra (`scroll-hidden-x` + snap).
- 2026-10-01 — Tema tweakcn + elementos Órbita aplicados globalmente; dock em órbita; decisões D-1…D-6.
- 2026-10-01 — Componentes base restantes no padrão; regra `orbita/no-hardcoded-color` (aviso).
- 2026-10-01 — Tokens `success`/`warning`/`info` e `temp-*`; Tracking migrado (0 cores fixas).
- 2026-10-01 — D-7 (sem linha nos cabeçalhos); tokens `brand-*` dos canais; Fase 1 concluída (Tracking, Contatos, Chat, Agenda).
- 2026-10-01 — Fase 2 concluída: Início e painel do ASTRO; paleta dos gráficos do ASTRO em `--chart-*`; `--brand-claude`. Ficam fixos de propósito: logos de marca (Google/Gemini), a ilustração do foguete e as cores padrão que o servidor usa ao criar tags e etapas.
- 2026-10-01 — Início redesenhada (céu animado, saudação por horário, conversa aberta acima da caixa); Integrações vira **Satélites** nos rótulos; satélites conectados orbitam o ASTRO numa órbita inclinada (passam por trás do disco), "+" tracejado sempre visível (spec 0053).
- 2026-10-01 — Fase 3 concluída: Workspaces/Tarefas (dock Lista/Kanban/Calendário/Nova ação), Formulários (dock por seção) e Campanhas (dock com as 4 seções). Ficam fixos de propósito: cores do PDF de formulário, preview do WhatsApp, texto branco sobre cor de tag e fundo do visualizador de imagem.
- 2026-10-01 — Fase 4 concluída: Insights (dock Visão geral/Jornada/Atividades/Relatórios), Payment e Contábil (dock Painel/Receita/Despesa/Fluxo), Forge (dock Painel/Propostas/Contratos/Produtos; botões roxos viraram o primário). Paletas categóricas dos gráficos em `CHART_PALETTE`. Ficam fixos de propósito: e-mails, contrato público (marca do cliente, D-3), azul do gov.br e as cores escolhidas pelo usuário no gráfico personalizável.
- 2026-10-01 — Fase 5 concluída: Pages (dock Sites/Templates/Novo site/Último editado), Satélites (dock IA/Mensagens/Anúncios/Buscar), ÓRBITA Planner (dock Painel/Campanhas/Posts/Calendário), Comando (dock Comandos/Visão geral/Aprovações/Alertas), trafeGO (dock Início/Campanhas/Nova/Como funciona; landing pública escura via `.dark` + tokens, roxo virou `info`), Linnker (dock Início/Páginas/Nova página/Contatos). Ficam fixos de propósito: conteúdo e páginas públicas do cliente (Pages, Linnker — D-3), prévias que imitam rede social (post do Instagram, anúncio no WhatsApp/Google), cores de marca das integrações, palco do editor de imagem, fundo branco do QR, disco do ASTRO (D-5) e gradientes das personas do Comando.
- 2026-10-01 — Fase 6 concluída: Space Help (dock Space Help/Rotas/Buscar/Início), Stars e Space Point (widgets e modais seguem o tema; estrela em `warning`), ÓRBITA Route (dock da vitrine Cursos/Buscar/Certificados/Criador e do painel do criador Vendas/Alunos/Acesso livre/Novo curso; abas do editor em pílula), Space Page (página pública mantém o visual escuro via `.dark`, laranja da marca antiga virou `info`; rodapé público `nasa-footer-public` idem). Space Station fica fora (decisão: mundo de jogo com arte própria). Ficam fixos: popup de conquista e pódio do ranking (cena ouro/prata/bronze), páginas públicas e checkout de curso (D-3), certificado, player de vídeo, imagem de compartilhamento (`next/og` não lê CSS vars; hex com o azul do ASTRO).
- 2026-10-01 — Fase 7 concluída: Admin inteiro em tokens (antes desenhado só para escuro, agora segue o tema), botões de excluir em vermelho suave (D-1), níveis de parceiro em `temp-*` (Suite=muted, Earth=cold, Galaxy=warm, Constellation=hot, Infinity=very-hot), papéis Master=info/Adm=knob/Moderador=warning/Membro=muted. No celular, a sidebar vira gaveta aberta pelo botão de menu do cabeçalho (o admin não usa o dock em órbita). Ficam fixos: prévia do popup como o usuário final vê, presets de cor, fundo branco dos logos de integração, alça vermelha da anotação sobre o print.
- 2026-10-01 — Fase 8 (sobras) concluída: portal do parceiro, sino, alertas, configurações, assinatura, cadastro/redefinir senha (bloco `.dark` sobre o fundo artístico), onboarding, catálogo de apps, NERP, Star Friends, workflows, tags, N-Box, chamada e telas pontuais. Fora de propósito: Space Station, site de marketing (`src/app/(home)`), e-mails (`src/lib/email`), prévia que imita o WhatsApp, agendamento/calendário público, contrato público do Forge e contato do Linnker (D-3), `global-error` (roda sem o tema), ilustrações (space-journey, níveis do Star Friends), balão escuro do tour do ASTRO.
- 2026-10-02 — Switch ligado passa de `foreground` para o azul do ASTRO (`info`); desligado continua cinza. Vale para todos os Apps.
- 2026-10-02 — Alça de recolher o menu lateral deixa de ser bolinha com traço: agora são dois traços verticais dentro do menu, rente à borda (o de dentro menor), na cor da borda (`line`), que escurecem no hover.
- 2026-10-02 — Calendário: faixa do período selecionado em `bg-info/15` (antes `accent`, invisível no tema claro); "hoje" marcado por contorno `ring-info/50` em vez de fundo.
- 2026-10-02 — Construtor de formulários no celular (<768px): tela cheia, dock em órbita com **ação central** (`centerAction` do `useRegisterOrbitDock`, aqui "+ Bloco" no lugar do ASTRO — o orb se esconde enquanto a ação existir), gavetas de blocos/edição/ajustes, subir/descer/editar no bloco selecionado. 8 modelos prontos (`lib/starter-templates.ts`) no formulário vazio e em "Modelos prontos" da página de Formulários. Blocos com nomes em português (Título, Parágrafo, Texto curto/longo, Escolha única, Caixas de seleção, Lista suspensa…).
- 2026-10-08 — Escopo `.light` no `globals.css` (mesmos tokens do `:root`): fixa o tema claro numa área com a plataforma no escuro. Usado pelo formulário, que mantém a cor da empresa (D-3); a classe vem de `formSurfaceThemeClass(backgroundColor)`, que devolve `light` ou `dark` pelo contraste do fundo.
