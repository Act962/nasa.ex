---
id: 0046
titulo: Astro Guia — passo a passo na tela real, com seta e balão
dominio: astro
status: em-revisao
autor: Weydson
criada: 2026-09-29
atualizada: 2026-09-29
branch: feature/W-astro-guia-na-tela-20260929
pr:
peso: leve
---

# 0046 — Astro Guia — passo a passo na tela real

## 1. Contexto

O Space Help ensina com prints e setas posicionadas à mão
(`SpaceHelpStep.screenshotUrl` + `annotations` em fração da imagem) e vídeo do
YouTube. Cada mudança de tela deixa esse conteúdo velho, e refazer prints e
vídeos para todas as funcionalidades custa produção humana que o time não tem.

A plataforma já tem um spotlight próprio (`src/features/tour`), usado só no
tour de boas-vindas, com 8 passos fixos e sem interação: o usuário lê e clica
"Próximo".

## 2. Objetivo

O usuário pede ao Astro "como eu crio um lead?" e o Astro o conduz **na tela de
verdade** — destaca o botão ou campo real, com seta animada e balão de texto,
espera o clique ou a digitação, troca de página quando precisa e, no fim,
entrega o link do que foi criado.

### Não-objetivos

- Prints ou vídeos gerados automaticamente para os artigos do Space Help.
- O Astro compor guias sozinho a partir do catálogo de âncoras (fase 2).
- Guias fora do Tracking (o piloto cobre só o Tracking).
- Mudança de schema: o vínculo guia ↔ artigo do Space Help mora no código.
- Guia pelo WhatsApp (`astro-bot`) — não há tela para destacar.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Guias vivem num registro em código (`src/features/astro-guides/lib/registry.ts`); cada passo aponta para uma âncora `data-guide` declarada em `GUIDE_ANCHORS`. |
| RF-2 | Cada passo avança de um jeito: `next` (botão do balão), `click` (clique no alvo), `input` (campo preenchido + "Continuar") ou `result` (a tela avisa que a ação terminou). |
| RF-3 | Passo com `route` navega para ela se o usuário não estiver lá; passo com `skipWhenPath` é pulado quando a rota atual já casa (ex.: já está dentro de um tracking). |
| RF-4 | O alvo fica clicável e editável dentro do spotlight; o resto da tela fica escurecido e bloqueado. |
| RF-5 | Pedido de guia ("como crio um lead", "me ensina a criar tracking", "passo a passo pra mover lead") é reconhecido em código, sem modelo, antes das consultas e das ações guiadas, e devolve o cartão do guia. |
| RF-6 | O orquestrador tem a tool `start_guide`, para quando o pedido chega por outro caminho. |
| RF-7 | O cartão tem o botão "Me mostre na tela", que fecha o painel do Astro e começa o guia. |
| RF-8 | Artigo do Space Help com guia vinculado mostra o mesmo botão no topo. |
| RF-9 | `pnpm guides:check` falha quando uma âncora usada por algum guia não existe em nenhum `.tsx`. |
| RF-10 | O tour de boas-vindas (`NASA_TOUR_STEPS`) continua funcionando como antes. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Pedido de guia reconhecido em código custa zero token (registrado como `astro_guide` no relatório de uso). |
| RNF-2 | O guia sobrevive a troca de rota e a recarregar a página (estado em `sessionStorage`). |
| RNF-3 | Pedido de guia não exige nem cobra Stars: é checado antes da cobrança do `astro_prompt`. Org com saldo zero também aprende a usar a plataforma. |

## 4. Critérios de aceite

- [x] **CA-1** — Dado o Astro aberto, quando o usuário manda "como eu crio um lead?", então chega o cartão do guia "Criar um lead" sem chamada ao modelo.
- [x] **CA-2** — Dado o cartão, quando o usuário clica "Me mostre na tela" fora de um tracking, então o guia abre `/tracking`, destaca a lista e, após o clique num tracking, segue no board.
- [x] **CA-3** — Dado o passo "Digite o nome do lead", quando o usuário digita no campo real, então o campo é editável e "Continuar" só habilita com texto.
- [x] **CA-4** — Dado o formulário preenchido, quando o usuário clica "Criar lead" e o lead é salvo, então aparece o cartão final com o botão "Abrir lead" para `/contatos/<id>`.
- [x] **CA-5** — Dado um passo cuja âncora não aparece em 5s, então o balão diz que não encontrou o item e oferece "Pular passo" e "Encerrar", sem travar a tela.
- [x] **CA-6** — Dado um guia que usa uma âncora removida do código, quando roda `pnpm guides:check`, então o comando sai com erro nomeando a âncora.
- [x] **CA-7** — Dado o menu da conta, quando o usuário inicia o tour de boas-vindas, então os 8 passos aparecem como antes, incluindo o do botão do Astro.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Usuário já está dentro de um tracking ao iniciar "Criar um lead" | Passo "escolha o tracking" é pulado (`skipWhenPath`). |
| CB-2 | Org sem nenhum tracking | Âncora da lista não aparece → balão de "não encontrei" (CA-5); o usuário pode encerrar e pedir o guia "Criar tracking". |
| CB-3 | Botão "Personalizar" oculto (sem permissão ou cabeçalho recolhido) | Mesmo comportamento de CA-5. |
| CB-4 | Clique no balão com Sheet/Dialog do Radix aberto | O Sheet **não** fecha: o overlay para o `pointerdown` antes de chegar ao `document`. |
| CB-5 | Usuário fecha o Sheet no meio do guia | O alvo some; após 5s aparece o balão de CA-5. |
| CB-6 | Recarrega a página no meio do guia | Guia retoma no mesmo passo (RNF-2). |
| CB-7 | Erro ao salvar o lead | Nenhum resultado é emitido; o guia continua no passo do botão e o toast de erro da tela aparece. |
| CB-8 | "crie um lead João" (ordem, não pergunta) | Não é pedido de guia: segue para a ação guiada, como hoje. |
| CB-9 | Guia iniciado com outro guia ativo | O novo substitui o anterior. |
| CB-10 | Org com 0 Stars pede "como crio um lead?" | Recebe o cartão do guia normalmente; qualquer outro pedido continua barrado com "Seus Stars acabaram". |

## 9. Riscos e rollback

Mudança só de front e de roteamento do chat, sem schema. O único caminho novo
em dado de produção é a checagem de guia no `route.ts`; se ela capturar frases
que não deveria, o rollback é remover a chamada a `matchGuideRequest` —
o resto do fluxo do chat fica intacto. O `TourProvider` vira um repasse vazio
para não quebrar quem o importa.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-29 | Weydson | Criada |
| 2026-09-29 | Weydson | CA-1 a CA-7, CB-1, CB-4, CB-5, CB-6 e CB-7 conferidos no navegador (produção local, org ASTRO QA). Destaque do telefone passou a incluir a chave "Validar número"; mascote removido do balão. |
| 2026-09-29 | Weydson | RNF-3/CB-10: o teste na org ASTRO QA (0 Stars) mostrou o guia barrado pela cobrança; a checagem passou para antes dela. |
