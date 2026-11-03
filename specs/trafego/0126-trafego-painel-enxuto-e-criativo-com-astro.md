---
id: 0126
titulo: Painel do trafeGO enxuto, setup único de R$ 450 e criativo analisado pelo Astro
dominio: trafego
status: implementada
autor: Weydson Lima (com Claude)
criada: 2026-10-31
atualizada: 2026-10-31
branch: feature/W-trafego-ux-20261031
pr:
peso: completa
---

# 0126 — Painel do trafeGO enxuto, setup único de R$ 450 e criativo analisado pelo Astro

## 1. Contexto

Desde as specs 0122–0125 o painel lê a conta de anúncios do cliente direto da Meta, a conta é
conectada nos Satélites e o Astro conversa com a Meta pelo MCP oficial. O painel do pedido
(`/trafego/painel/[orderId]`), porém, continua desenhado para o modelo antigo, em que o cliente
mandava materiais para a equipe montar tudo:

- 7 abas (Materiais, Release, Acessos, Andamento, Desempenho, Publicar, Suporte), mais um anel de
  progresso com 9 etapas, avisos de ativação e o cartão "Seus próximos passos" **antes** das abas
  (`panel/order-detail.tsx:184-283`). O cliente abre a campanha e não vê a campanha.
- O diagnóstico de UX de 2026-10-31 (itens 4, 5, 9, 10 e 11) apontou o mesmo: entulho antes do
  conteúdo, Materiais como rolagem longa, jargão ("Release", "BM", "copy") e o briefing pedindo de
  novo o que o wizard já coletou.
- O setup varia por faixa de verba e só vale para quem diz não ter conta de anúncios
  (`lib/pricing-tiers.ts:34-38`, `api/checkout/trafego/route.ts:156-161`). Na prática, a equipe
  agora **sempre** conecta a conta Meta do cliente nos Satélites, tenha ele BM ou não.
- O cliente não recebe nenhuma opinião sobre o criativo antes de pagar a verba. Criativo fraco ou
  fora da política é a causa mais comum de anúncio reprovado e de dinheiro mal gasto.

## 2. Objetivo

Ao abrir uma campanha, o cliente vê de cara o anúncio, a verba e os números (gasto, CTR, CPC, CPM e
conversas). Ele paga um setup único de R$ 450 na primeira contratação. Ao criar uma campanha nova,
envia o criativo e recebe do Astro uma análise de qualidade e de política antes de publicar.

### Não-objetivos

- Mudar o modelo de cobrança do serviço (30%, mínimo R$ 150, complemento — spec 0123).
- Mudar o construtor de campanha da aba Publicar (spec 0124): ele continua, só muda de lugar.
- Ouvir o áudio do vídeo ou transcrever a fala (fica para uma segunda etapa).
- Aceitar link do Drive, do YouTube, do TikTok ou de outro site.
- Mudar o setup do canal WhatsApp Oficial (número na API), que é outro serviço.
- Apagar models, colunas ou enums do schema neste PR (S9: sai depois, em migration própria).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | O detalhe do pedido deixa de ter abas. A tela tem: cabeçalho (código, nome, status em linguagem simples, menu `⋯`), cartão da **verba** (destinada × usada) e a **visão da campanha**. |
| RF-2 | A visão da campanha mostra, para cada anúncio das campanhas do pedido (código TG-NNNN no nome, spec 0122): a prévia do criativo, o status e os números do período — gasto, impressões, alcance, frequência, cliques, **CTR**, **CPC**, **CPM**, conversas iniciadas e custo por conversa. No topo, os mesmos números somados. No celular, um cartão por anúncio; no computador, uma tabela. |
| RF-3 | Enquanto a conta Meta da org não estiver conectada e lendo (`connectionCheck.canRead`), a tela mostra um só aviso — "Nossa equipe está configurando sua conta na Meta" — com o prazo e o botão de suporte, e o cartão do criativo (RF-9). |
| RF-4 | Saem do lado do cliente: aba Materiais (criativos, textos, prévia e briefing), aba Acessos, cartão "Seus próximos passos", anel de progresso e o aviso de "Ativar". |
| RF-5 | O menu `⋯` do cabeçalho abre gavetas com: **Andamento** (linha do tempo atual), **Sobre a empresa** (o antigo Release + os dados do briefing, num formulário só) e **Suporte** (conversa atual). O botão flutuante de WhatsApp continua. |
| RF-6 | O construtor de campanha (spec 0124) vira o botão principal "Publicar anúncio" quando o pedido ainda não tem campanha na Meta e o usuário pode publicar; depois que existe campanha, as ações de pausar, retomar e editar ficam no cartão de cada campanha, como hoje. |
| RF-7 | A lista de acessos (Acessos) passa para o detalhe do pedido no admin, marcada pela equipe. O cliente não vê mais a lista. |
| RF-8 | **Setup único:** R$ 450,00 pela configuração inicial feita pela equipe da Órbita (conectar a conta Meta nos Satélites, conferir página, Instagram, BM e parceria). A verba de anúncio **não** passa pela Órbita: o cliente recarrega direto na Meta, como na spec 0123. O primeiro checkout cobra **setup + taxa do serviço** (30% da verba, mínimo R$ 150); ex.: verba de R$ 300 → R$ 450 + R$ 150 = R$ 600. As contratações seguintes cobram só a taxa. O setup é cobrado na primeira contratação da empresa, de qualquer cliente, tenha ou não conta de anúncios. Empresa que já tem um pedido pago com setup não paga de novo. O visitante sem empresa (fluxo público) sempre paga. A pergunta "tem conta de anúncios?" continua no wizard, só para a equipe, sem mudar o preço. |
| RF-9 | **Passo "Criativo" no wizard** (`/trafego?nova=1#montar`) para membro logado, e o mesmo cartão no painel enquanto o pedido não está no ar: o cliente envia imagem ou vídeo, ou cola o link de um post do Instagram ou do Facebook da própria página. |
| RF-10 | O link do post só é aceito quando a conta Meta da org está conectada: o servidor procura o post entre as publicações da página conectada (`listInstagramMedia` / posts da página). Sem conexão, ou se o post não for da página, a tela pede o arquivo. |
| RF-11 | **Análise do Astro**, a pedido ("Analisar com o Astro"), devolve: uma nota de 0 a 100, um veredito ("Pronto", "Dá para melhorar", "Risco de reprovação") e itens em três grupos — **Política da Meta**, **Técnico** (formato 1:1, 4:5 ou 9:16, resolução, duração, texto perto da borda) e **Força do anúncio** (gancho, oferta clara, chamada para ação) —, cada item com o problema e a correção em uma linha. |
| RF-12 | A análise usa o "Sobre a empresa" (Release) como contexto quando existe, e o nicho e o objetivo do pedido. |
| RF-13 | O que o prescreen determinístico de políticas marca (`lib/ad-policies`) nunca é rebaixado pela IA, como na checagem de textos. |
| RF-14 | A análise cobra Stars (ação `trafego_creative_review`), só depois de a IA responder. Sem saldo, o botão avisa e não chama a IA. |
| RF-15 | A análise fica guardada junto do criativo e aparece de novo no painel e no admin, para a equipe usar ao publicar. |
| RF-16 | Os guias do Astro que apontavam para as abas removidas são atualizados ou removidos (regra 21), e `pnpm guides:check` passa. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Celular primeiro (`docs/apps-mobile-playbook.md`): nada de tabela a 375px, botões `rounded-full`, só tokens de cor. |
| RNF-2 | Vídeo: o navegador extrai até 4 quadros (início, 1 s, 3 s e meio) com `<video>` e `canvas`; só os quadros vão para a IA. Nada de ffmpeg no servidor. |
| RNF-3 | A análise responde em até 30 s no p95; passou disso, erro com "Tentar de novo" e sem cobrança. |
| RNF-4 | Números por anúncio usam o cache de 15 min da spec 0122 (chave conta + período + bloco), sem cron novo. |
| RNF-5 | Nenhum arquivo novo passa de 400 linhas; `order-detail.tsx` fica menor do que hoje. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um pedido com campanha no ar e conta lendo, quando o cliente abre o pedido, então a primeira dobra mostra a verba e os números (gasto, CTR, CPC, CPM, conversas) e não há abas.
- [ ] **CA-2** — Dado um pedido com dois anúncios, quando o cliente abre o pedido, então vê a prévia e os números de cada anúncio, e a soma bate com os números do topo.
- [ ] **CA-3** — Dada uma org sem conta Meta lendo, quando o cliente abre o pedido, então vê só o aviso "Nossa equipe está configurando…" e o cartão do criativo.
- [ ] **CA-4** — Dada uma empresa sem pedido pago anterior, quando ela contrata, então o resumo e o checkout cobram R$ 450 de setup mais a taxa do serviço (verba R$ 300 → R$ 600), sem a verba, mesmo respondendo que tem conta de anúncios.
- [ ] **CA-5** — Dada uma empresa com um pedido pago com setup, quando ela contrata de novo, então o setup é R$ 0.
- [ ] **CA-6** — Dado um criativo 1080×1920 com o texto "Você sofre de ansiedade?", quando o cliente pede a análise, então o veredito é "Risco de reprovação" e o item de política vem do prescreen.
- [ ] **CA-7** — Dada uma imagem 600×600, quando o cliente pede a análise, então aparece o item técnico de resolução baixa, sem chamar a IA para isso.
- [ ] **CA-8** — Dado um link de post que não é da página conectada, quando o cliente cola, então a tela recusa e pede o arquivo.
- [ ] **CA-9** — Dada uma org sem Stars, quando o cliente pede a análise, então nada é cobrado, a IA não é chamada e a tela diz como recarregar.
- [ ] **CA-10** — Dada uma falha da IA, quando o cliente pede a análise, então vê o erro com "Tentar de novo" e o saldo de Stars não muda.
- [ ] **CA-11** — Dado um membro de outra org, quando ele chama a análise ou a leitura por anúncio com o id de um pedido que não é dele, então recebe NOT_FOUND sem chamar a Meta nem a IA.
- [ ] **CA-12** — Dado um pedido antigo em ONBOARDING sem criativo, quando o cliente abre o pedido, então vê o cartão do criativo (sem aba Materiais) e consegue enviar.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Pedido antigo com criativos e textos enviados pela aba Materiais | Os criativos aparecem no cartão do criativo (só leitura depois do envio); os textos continuam visíveis para a equipe no admin. Nada é apagado. |
| CB-2 | Campanha na Meta sem o código TG no nome | Não entra na visão do pedido; aviso curto "Campanhas sem o código TG-NNNN no nome não aparecem aqui", como hoje no Desempenho. |
| CB-3 | Anúncio sem prévia (`thumbnail_url` vazio) | Ícone do formato no lugar da imagem; os números aparecem igual. |
| CB-4 | Período sem entrega | Números em zero com "Sem entrega no período", e não tela vazia nem carregando para sempre (item 6 do diagnóstico). |
| CB-5 | Falha da Meta ao ler (token vencido, limite) | Mensagem do `MetaGraphError.userMessage` com "Tentar de novo" e, para token, "Avise o suporte". |
| CB-6 | Vídeo que o navegador não decodifica (ex.: HEVC no Chrome) | Envio segue; a análise roda só com os dados técnicos e avisa que não deu para ver as imagens do vídeo. |
| CB-7 | Dois cliques em "Analisar" | O botão trava durante a análise; o servidor recusa uma segunda análise do mesmo arquivo em andamento. |
| CB-8 | Arquivo enviado no wizard e compra abandonada | O arquivo fica sob `trafego/drafts/<orgId>/` e é apagado pela regra de ciclo de vida do R2 em 7 dias (configuração do bucket, sem cron). |
| CB-9 | Empresa com pedido antigo de setup R$ 0 (tinha BM) | Conta como "nunca pagou setup": a próxima contratação cobra R$ 450. |
| CB-10 | Pedido pago antes deste deploy com setup por faixa | Valor gravado no pedido não muda; a regra nova só vale para checkouts novos. |
| CB-11 | Membro sem permissão de publicar | Não vê "Publicar anúncio"; vê os números e o cartão do criativo. |

## 6. Decisões de design

### D-1 — Uma tela sem abas, com gavetas para o resto
O cliente abre a campanha para saber se está dando resultado. Andamento, Sobre a empresa e Suporte
são consultas raras e vão para o `⋯`. **Descartado:** manter abas com menos itens — continua
exigindo um clique para ver o que importa.

### D-2 — Acessos vira tarefa da equipe, e não some
Com o setup pago, quem confere página, Instagram, BM e parceria é a equipe. Mas a conferência
continua necessária: sem a Órbita como parceira na BM, nada funciona. **Descartado:** apagar a
lista.

### D-3 — Status do enum ficam; o cliente vê quatro estados
`TrafegoOrderStatus` não muda (sem migration). O painel traduz: PAID/ACCOUNT_REVIEW/ONBOARDING →
"Configurando sua conta"; MATERIALS_SUBMITTED/REQUESTED/IN_REVIEW/CHANGES_REQUESTED/SCHEDULED →
"Montando a campanha"; RUNNING → "No ar"; PAUSED/COMPLETED/CANCELLED/REFUNDED → o nome atual. O
cliente deixa de "ativar" o pedido: a equipe move o status no admin, como já pode hoje.

### D-4 — Setup fixo em código, como a taxa mínima
`TRAFEGO_SETUP_BRL_CENTS = 45_000` em `pricing-tiers.ts`, ao lado de `TRAFEGO_MIN_SERVICE_FEE_BRL_CENTS`.
As faixas deixam de decidir o setup. "Uma vez por empresa" é uma consulta aos pedidos pagos da org
com `setupFeeBrlCents > 0`. **Descartado:** coluna nova na organização — o dado já existe nos pedidos.

### D-5 — Quadros do vídeo extraídos no navegador
O modelo de visão lê imagens, não vídeo. Extrair 4 quadros com `canvas` no navegador custa zero no
servidor e evita subir um binário de ffmpeg no container. **Descartado:** ffmpeg no servidor.

### D-6 — Link só da própria página
Post de terceiros pode ser privado, sumir ou não ser do cliente, e a Meta só deixa anunciar post da
página do anunciante. Procurar o post na página conectada resolve as três coisas.

### D-7 — Análise guardada numa coluna `Json` do criativo
Uma coluna `TrafegoCreative.astroReview Json?`: é um relatório só para exibir, nunca filtrado nem
somado (S3 aceita `Json` para payload opaco). Antes do pedido existir, a análise vai no `briefing`
da `TrafegoPendingPurchase` junto com a chave do arquivo e é copiada para o criativo quando o pedido
nasce. **Descartado:** tabela de análises — o criativo tem uma análise por vez.

### D-8 — Duas camadas, como na checagem de textos
Técnico (dimensão, proporção, duração, tamanho) é regra pura em `lib/`, sem IA. Política passa
primeiro pelo prescreen determinístico do texto que a IA leu na imagem; a IA soma o resto e nunca
rebaixa. Mesmo padrão de `server/lib/compliance-check.ts`.

## 7. Impacto

**Schema:** 1 migration aditiva — `trafego_creatives.astro_review JSONB NULL`. Sem tabela nova.

**Reaproveita:** `compliance-check.ts` e `lib/ad-policies` (política), o padrão de visão de
`router/brand/extract-from-logo.ts` (Anthropic + `generateObject`), `chargeStarsByAction`,
`recordTrafegoAiUsage`, `listInstagramMedia` e `getMetaCampaignTree` (`ads-builder.ts`),
`fetchAdsInsightsDetailed` e o cache de `order-meta-performance.ts`, `ReleaseEditor`,
`StatusTimeline`, `SupportThread`, `AccessChecklist` e `CampaignBuilderView`.

**Novo:**
- `server/lib/meta/order-ads-performance.ts` — insights `level=ad` das campanhas do pedido + prévia.
- `lib/creative-review/` — regras técnicas puras e a montagem do veredito.
- `server/lib/creative-review.ts` — chamada de visão, prescreen e cobrança.
- Procedures `trafego.performance.ads` e `trafego.creativeReview.{analyze,resolveLink}`, com hooks em
  `use-trafego-performance.ts` e `use-trafego-creative-review.ts` (regra 9).
- UI: `panel/campaign-overview/*` (verba, totais, anúncio), `panel/order-menu-sheets.tsx`,
  `public/wizard/creative-step.tsx` e `creative-review-card.tsx` (usado no wizard e no painel).
- Admin: `AccessChecklist` no detalhe do pedido, com procedure admin.

**Sai (S9, no mesmo PR, se não tiver outro uso):** `CampaignSectionNav`, `CampaignLaunchProgress`,
`NextStepsCard`, a parte de ativação de `OrderStatusNotices`, `CopiesManager` e `BriefingForm` do lado do
cliente, as faixas de setup em `pricing-tiers.ts` e o `?tab=` das URLs (redireciona para o pedido).

**Preço e termos:** textos do simulador, do resumo e dos termos citam o setup de R$ 450; nova versão
dos termos.

**Docs:** `docs/trafego-overview.md` e `docs/trafego-playbook-gestor.md`.

**Inngest:** nada novo.

### Segurança de dados

- Toda procedure confere `organizationId` do pedido antes de chamar Meta ou IA (CA-11).
- Upload de rascunho: chave sob o prefixo da org; o servidor só aceita analisar chave desse prefixo
  ou de criativo de pedido da org.
- Link do post: aceito só se pertencer à página conectada da org (D-6); o servidor nunca busca URL
  arbitrária (sem SSRF).
- O criativo vai para o provedor de IA já usado na checagem de textos; nada além dos quadros, do
  texto lido e do Release.
- A lista de acessos e as análises guardadas não mostram token nem id interno ao cliente.

### Regras da Meta

- A análise cita a política e o link oficial de `lib/ad-policies/sources.ts`, e diz que é uma
  orientação: **não garante aprovação**.
- Atributos pessoais ("Você sofre de…?"), antes e depois, promessa de resultado, saúde e finanças
  seguem as regras já cadastradas; a regra `personal-attributes` (spec 0124) vale também para o texto
  lido na imagem.
- O limite antigo de 20% de texto na imagem não existe mais; o Astro só recomenda pouco texto por
  desempenho, sem tratar como reprovação.
- Formatos recomendados: 1:1 e 4:5 no feed, 9:16 em Stories e Reels, com as margens seguras do 9:16.

## 8. Plano de testes

- Sem runner de testes (regra 20): `scripts/trafego-0126-qa-check.ts` com um caso por CA das regras
  puras (CA-4, CA-5, CA-6, CA-7, CB-9, D-3), rodado com `pnpm tsx --conditions=react-server`.
- Rotas, com `pnpm dev` e `curl`: CA-11 (outra org → NOT_FOUND).
- Navegador, na org GOTHAN CODEX: CA-1, CA-2 e CA-3 (com e sem conexão), CA-8 a CA-10 e CA-12.
- `pnpm lint` nos arquivos tocados e `pnpm guides:check`.
- Sem typecheck local; o CI confere.

## 9. Riscos e rollback

- **Pedidos parados em ONBOARDING:** o cliente perde o "Ativar". Mitigação: o admin já move status;
  o painel do admin passa a mostrar a lista de acessos e o criativo com a análise.
- **Setup mais caro para quem tinha BM:** de R$ 0 para R$ 450. É decisão do produto; o texto do
  simulador explica o que o setup inclui.
- **Custo de IA:** cada análise usa visão com até 4 imagens; coberta pelos Stars da ação.
- **Rollback:** reverter o PR volta o painel antigo; a coluna `astro_review` pode ficar (nullable).

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-31 | Weydson Lima (com Claude) | Criada, a partir do pedido de enxugar o menu e do diagnóstico de UX do /trafego. Decisões confirmadas: Acessos vai para o admin, Release vira contexto do Astro, setup único de R$ 450 por empresa, link só do Instagram e do Facebook, vídeo por quadros. |
| 2026-10-31 | Weydson Lima (com Claude) | Setup é só a configuração inicial da equipe; a verba é recarregada pelo cliente direto na Meta. 1º checkout = setup + taxa do serviço; seguintes, só a taxa. |
| 2026-10-31 | Weydson Lima (com Claude) | Implementada. Divergências: (a) só link do **Instagram** nesta versão; post do Facebook pede o arquivo (achar o post na página exige outra permissão); (b) "Sobre a empresa" mostra o formulário de briefing e o Release um abaixo do outro, sem fundir os dois; (c) o `⋯` ganhou "Mais números da conta" (gasto por dia, todas as campanhas e públicos), reaproveitando a visão da spec 0122; (d) o cabeçalho perdeu a grade de valores — a verba destinada × usada fica no cartão da campanha; (e) saíram do cliente `CopiesManager`, `CreativesManager`, `AdPreviewMockup`, `AccessChecklist`, `NextStepsCard`, `CampaignSectionNav`, `CampaignLaunchProgress`, `OrderStatusNotices` e a procedure `trafego.activateOrder`; as procedures de textos ficam (equipe e Astro); (f) a análise de um link no painel não fica guardada, porque não existe arquivo do criativo; no wizard o link vai para `materialsProfileLink`; (g) a análise custa 5 Stars: o saldo é conferido antes e a cobrança só acontece depois da resposta da IA; (h) limite de 20 análises por hora por empresa (`takeRateLimit`, em memória, como no resto do trafeGO); (i) o setup não se repete se a empresa tem pedido com setup pago, exceto reembolsado; (j) vídeo que o navegador não lê recebe análise só técnica, sem IA e sem Stars (CB-6). |
| 2026-10-31 | Weydson Lima (com Claude) | Ajustes visuais pedidos no teste: (a) título da campanha = "negócio · objetivo" (`lib/order-display.ts`), sem o nome do plano antigo; (b) cartão da lista com o WhatsApp de destino, a verba, "N campanhas" e, para campanha no ar ou pausada, miniaturas dos criativos + conversas, investido, cliques e custo por conversa (uma leitura por cartão, com o cache de 15 min); (c) setas de tendência contra o período anterior de mesmo tamanho (verde = bom para o cliente, vermelho = ruim, investido neutro); a tela da campanha abre em 7 dias para haver comparação. |
| 2026-10-31 | Weydson Lima (com Claude) | Setas trocadas: em vez de tendência contra o período anterior, cada anúncio é comparado com a **média dos anúncios da campanha** — acima, seta vermelha para cima; abaixo, seta verde para baixo (regra do produto, igual para todos os números). Saiu a segunda leitura da Meta do período anterior; a tela volta a abrir em "Desde o início". Cartão da lista mostra o nome do conjunto de anúncios ao lado da miniatura, com os números à direita. |
| 2026-10-31 | Weydson Lima (com Claude) | Cartão da lista: título = nome do conjunto de anúncios (quando há um só), com liga/desliga; uma linha por anúncio (até 3) com liga/desliga, miniatura, nome e os quatro números do anúncio. Pausar/ativar vai direto na Meta (`trafego.campaignBuilder.setDelivery`, `builder-delivery.ts`), só para objetos das campanhas do pedido, com a mesma guarda do "Publicar e editar" (`canBuild`); ativar pede confirmação e confere o limite da spec 0127 (agora o anúncio de conjunto pausado não conta como no ar). Depois da escrita o cache de leitura da org é limpo. |
| 2026-10-31 | Weydson Lima (com Claude) | Base das setas: média por anúncio **da conta de anúncios inteira** no mesmo período (só anúncios que gastaram), lida com cache próprio; antes era a média da própria campanha, que não dá seta quando a campanha tem um anúncio só. Setas também no cartão da lista (Conversas, Investido, Cliques, Custo/conversa). |
| 2026-10-31 | Weydson Lima (com Claude) | Cor das setas corrigida: a direção diz acima/abaixo da média; a cor diz se é bom para o cliente. Conversas, cliques, CTR, alcance e impressões acima = verde; custo por conversa, CPC e CPM acima = vermelho; investido e frequência em cinza. |
| 2026-10-31 | Weydson Lima (com Claude) | Passo "Criativo" do wizard ganha **prévia como na Meta** (`wizard/meta-ad-preview.tsx`): Feed do Facebook, Feed do Instagram e Stories/Reels, com foto e nome do perfil informado, texto cortado em "...Ver mais", barra "Entre em contato com a Página" + botão WhatsApp. O passo pede também **texto do anúncio** e **título** (opcional), guardados no rascunho (`message`, `headline`) e gravados como a primeira copy do pedido (`TrafegoCopy`, selecionada) em `create-order-from-purchase`. O rascunho agora aceita só o texto, sem arquivo. Link de post do Instagram ainda não mostra a imagem na prévia. |
| 2026-10-31 | Weydson Lima (com Claude) | Cartão da lista: sai o liga/desliga do conjunto (fica só nos anúncios); o título do conjunto ganha o rótulo "Conjunto" acima do código do pedido. |
