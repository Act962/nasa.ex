---
id: 0015
titulo: Painel de chat do Astro no orb flutuante
dominio: astro
status: em-revisao
autor: Weydson
criada: 2026-09-15
atualizada: 2026-09-15
branch: feature/W-astro-widget-panel-20260915
pr:
peso: leve
---

# 0015 — Painel de chat do Astro no orb (Fase 2)

## 1. Contexto

O orb do canto inferior direito só navegava pra `/home?prompt=`: pra perguntar
algo ao Astro o usuário saía da tela em que estava. A fase 1 (spec 0014) deu ao
Astro leitura de boleto e escrita financeira com confirmação, mas só no `/home`.
Quem está em `/payment` precisa conversar sem perder a tela.

## 2. Objetivo

Clicar no orb abre um painel compacto de chat sobre a tela atual, com o mesmo
motor do `/home` (`useAstroChat`): anexos, cartão de confirmação, contexto da
rota e voz.

## 3. Requisitos

- **RF-1** — Clique no orb em repouso abre/fecha o painel. Esc e × fecham.
- **RF-2** — A conversa usa `useAstroChat` + `AstroMessage` (tabelas, gráficos,
  `astro_confirmation`) e envia o contexto da rota (inclui `paymentTab`).
- **RF-3** — Anexo pelo clipe, colando ou arrastando; sobe por
  `/api/payment/attachments/upload` antes do envio.
- **RF-4** — A sessão do painel fica em `sessionStorage["astro-widget-session"]`,
  sobrevive a refresh e é separada da sessão do `/home`.
- **RF-5** — Evento DOM `astro:open` (`CustomEvent<{ prompt? }>`, helper
  `openAstroWidget`) abre o painel e, com prompt, envia.
- **RF-6** — Com o painel fechado, resposta concluída incrementa o badge do orb.
- **RF-7** — Sugestões iniciais dependem da rota (financeiras em `/payment`).

## 4. Decisões

- **D-1** — Painel novo em `components/widget/`; os widgets legados
  `astro-agent.tsx` e `astro-agent-legacy.tsx` (sem importadores) são removidos.
- **D-2** — Layout do widget do NERP (400×min(620px, 100dvh−7rem), raio 22px,
  pílula `rounded-[26px]`) com a paleta escura do `/trafego` (`#0d0d12`).
  Mobile: folha inferior de 85dvh.
- **D-3** — Não esconder em orgs `trafego`: o orb já é montado lá e o painel
  segue o orb. Só não existe no `/home`, onde o chat ocupa a página.
- **D-4** — Voz com o painel fechado mantém o fluxo antigo (`/home?prompt=`);
  com o painel aberto, a transcrição vai pro painel (`pendingPrompt`).
- **D-5** — Fechar esconde (`hidden`) em vez de desmontar, pra resposta em
  andamento terminar.
- **D-6** — O menu de voz (Falar, escuta "ASTRO", esconder orb) vira
  `AstroVoiceMenuItems`, usado pelo orb no `/home` e pelo ⋯ do cabeçalho. O guia
  de permissão do microfone passa a ser estado global (`micGuideOpen`).

## 5. Critérios de aceite

- [ ] **CA-1** — Fora do `/home`, clique no orb abre o painel; novo clique fecha.
- [ ] **CA-2** — Esc e × fecham; o foco vai pro campo ao abrir.
- [ ] **CA-3** — `openAstroWidget("Como está meu fluxo de caixa?")` no console
  abre e envia.
- [ ] **CA-4** — Wake word com o painel aberto envia no painel, não navega.
- [ ] **CA-5** — PDF anexado em qualquer rota cria `PaymentAttachment` sem
  `entryId` e o Astro o lê.
- [ ] **CA-6** — Refresh da aba retoma a conversa; `/home` não a mostra.
- [ ] **CA-7** — No `/home` o painel não aparece e o orb mantém o menu.
- [ ] **CA-8** — Cartão de confirmação no painel cria o lançamento ao confirmar.
- [ ] **CA-9** — Em 375px o painel ocupa a largura toda sem scroll horizontal.

## 6. Casos de borda

- **CB-1** — Sessão salva apagada/de outra org → limpa o storage e abre vazio.
- **CB-2** — Erro 402 (Stars) mostra a mensagem do servidor.
- **CB-3** — Prompt chegando com resposta em andamento espera ela terminar.
- **CB-4** — Anexo ainda subindo bloqueia o envio.
- **CB-5** — "Nova conversa" durante streaming para a resposta antes de limpar.
- **CB-6** — Esconder o orb fecha o painel.
- **CB-7** — Navegar com o painel aberto mantém a conversa; ir pro `/home` o
  desmonta.
- **CB-8** — Navegador sem Web Speech API não mostra o microfone.

## 7. Changelog

- 2026-09-15 — criada.
