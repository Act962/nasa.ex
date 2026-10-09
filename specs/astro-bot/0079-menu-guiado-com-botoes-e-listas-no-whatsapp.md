---
id: 0079
titulo: Astro no WhatsApp com menu guiado por botões e listas
dominio: astro-bot
status: implementada
autor: Weydson
criada: 2026-10-09
atualizada: 2026-10-09
branch: feature/W-astro-correcoes-e-novas-funcionalidades-20261009
pr:
peso: completa
---

# 0079 — Astro no WhatsApp com menu guiado por botões e listas

## 1. Contexto

Hoje a equipe só usa o Astro do WhatsApp escrevendo o pedido. Quem não sabe o que pedir, ou como pedir, trava. E as perguntas do roteiro ("em qual workspace?", "qual a prioridade?") saem como lista numerada em texto, que a pessoa responde digitando o número.

Referência analisada em 09/10/2026: atendimento da Globo Drogaria (API oficial). Saudação com 3 botões; o terceiro abre uma lista com título e subtítulo por item; toda lista termina com "voltar ao menu"; conversa parada é encerrada com aviso de como retomar.

O que já existe no código:

- `WhatsappBotChannel.sendButtons` (`src/features/astro-bot/lib/types.ts`). No canal do tracking ele vira lista numerada; botões da Uazapi ficam atrás de `ASTRO_BOT_BUTTONS`, desligados, porque a mensagem não chegava ao aparelho.
- A entrada da API oficial já entende o clique (`interactive_reply`, em `adapters/meta-cloud/provider.ts`).
- **Não existe envio de mensagem interativa pela API oficial** (`src/http/whats-oficial/` só tem texto, mídia, template, contato e localização).

## 2. Objetivo

Em número de API oficial, a equipe usa o Astro de dois jeitos na mesma conversa: escrevendo o pedido, como hoje, ou clicando num menu que leva até o roteiro certo. As perguntas do roteiro passam a ser botões e listas.

### Não-objetivos

- Menu para o cliente final da empresa. O Astro do WhatsApp atende a equipe (allow-list); o cliente final fala com o agente do tracking.
- Mudar o Astro da plataforma.
- Ações novas. O menu só leva a roteiros que o Astro já tem.
- Botões na Uazapi (segue desligado) e em qualquer provider não oficial: ali o menu sai como lista numerada.
- Planner e demais Apps em que o Astro ainda não tem consulta nem ação: o menu só leva ao que já existe. A lista da Meta aceita 10 linhas, então cabem 9 Apps.
- Persistir o estado do menu em banco (segue em memória, como o ciclo guiado).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Novos clientes HTTP da API oficial: mensagem com **botões de resposta** (até 3, título até 20 caracteres) e mensagem de **lista** (até 10 linhas, título até 24 e descrição até 72 caracteres). |
| RF-2 | O canal do bot ganha "enviar escolha": até 3 opções viram botões; de 4 a 10 viram lista; em provider não oficial, ou se o envio interativo falhar, cai para a lista numerada de hoje. Nunca fica pergunta sem chegar ao aparelho. |
| RF-3 | O menu abre quando a pessoa escreve "menu" (ou "opções", "ajuda"), quando clica no botão "Menu" e quando o Astro não entende o pedido. |
| RF-4 | Saudação ("oi", "bom dia", primeira mensagem do dia) responde com o convite a escrever o pedido e 3 botões: `Agenda`, `Demandas`, `Mais opções`. |
| RF-5 | "Mais opções" abre a lista de Apps: Agenda, CRM (Tracking), Demandas (Workspace). Só aparecem os Apps em que a pessoa tem permissão de ver. |
| RF-6 | Escolher um App abre a lista de ações dele (tabela abaixo). Só aparecem as ações que a permissão da pessoa permite. Toda lista termina com "Voltar ao menu". |
| RF-7 | Escolher uma ação entra no roteiro que já existe (mesmo caminho de quem escreveu o pedido). O clique nunca executa nada sozinho. |
| RF-8 | Perguntas do roteiro com opções usam RF-2. Mais de 10 opções: mostra as 9 primeiras e "Buscar pelo nome", que pede para digitar. |
| RF-9 | Confirmação de ação que altera ou apaga sai com botões `Confirmar` e `Cancelar`. "SIM" e "NÃO" digitados continuam valendo. |
| RF-10 | Texto livre vale em qualquer nível do menu: um pedido escrito encerra o menu e segue o caminho de sempre. |
| RF-11 | Depois de uma ação concluída, a resposta traz os botões `Menu` e `Encerrar`. |
| RF-13 | O webhook oficial entrega ao Astro o **clique** em botão ou lista (`interactive_reply`), além de texto e mídia. Hoje o clique não passa pelo desvio do Astro e cai no atendimento como mensagem do lead. |
| RF-14 | A opção clicada é identificada pelo **id** que o Astro mandou, nunca pelo título: a Meta devolve o título já encurtado. O id carrega o suficiente para o Astro saber de qual pergunta é a resposta. |
| RF-15 | Clique em botão de pergunta que já expirou ou já foi respondida recebe "essa pergunta já foi encerrada, mande Menu", em vez de ser lido como pedido novo. |
| RF-16 | Pergunta do roteiro sem resposta por 10 minutos: o Astro encerra o pedido e avisa "Encerrei esse pedido por falta de resposta. Nada foi gravado. Quando quiser, mande Menu.", com o botão `Menu`. Menu sem resposta também encerra, com "Encerrei o menu por falta de resposta.". Qualquer mensagem do membro antes disso cancela o aviso. Confirmação pendente não dispara aviso (tem validade própria). `ASTRO_BOT_INACTIVITY_MINUTES` muda o prazo; `0` desliga. |
| RF-12 | Marcar ou remarcar compromisso devolve o link público do compromisso (`/agenda/appointment/<id>`), por onde o cliente remarca ou cancela. No WhatsApp o link vai na resposta. |

Ações por App (RF-6):

| App | Itens da lista |
| --- | --- |
| Agenda | Ver compromissos · Marcar · Remarcar · Desmarcar |
| CRM (Tracking) | Buscar lead · Criar lead · Mover de etapa · Atualizar lead |
| Demandas (Workspace) | Minhas tarefas · Criar demanda · Editar demanda · Concluir demanda |
| Chat | Não lidas · Aguardando resposta · Enviar mensagem · Abrir conversa |
| Insights | Funil · Ganhos e perdas · Vendas do mês · Canais |
| Propostas (Forge) | Ver propostas · Valor em aberto · Criar proposta |
| Financeiro | Resumo · Vencimentos · Lançar despesa · Lançar receita. Só aparece com o Astro Financeiro pelo WhatsApp ligado (spec 0019) |
| Formulários | Ver formulários · Enviar a um lead |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Navegar no menu não usa IA nem cobra Stars: é código. |
| RNF-2 | Título de botão ou de linha maior que o limite da Meta é encurtado com reticências, nunca rejeitado. |
| RNF-3 | Falha no envio interativo é registrada em log com o motivo da Meta e cai para texto (RF-2). |

## 4. Critérios de aceite

- [ ] **CA-1** — Em número oficial, "oi" responde com o convite e os botões `Agenda`, `Demandas`, `Mais opções`.
- [ ] **CA-2** — Clicar em `Mais opções` abre a lista de Apps; quem não tem permissão de ver Agenda não vê Agenda.
- [ ] **CA-3** — `Agenda` → `Marcar` leva à mesma pergunta que "quero marcar uma reunião" leva hoje.
- [ ] **CA-4** — "Em qual workspace?" com 5 workspaces chega como lista clicável; com 15, mostra 9 e "Buscar pelo nome".
- [ ] **CA-5** — No meio do menu, escrever "quantas tarefas tenho hoje?" responde a pergunta e sai do menu.
- [ ] **CA-6** — Em número não oficial, o mesmo menu chega como lista numerada e responder "2" escolhe o segundo item.
- [ ] **CA-7** — Com o envio interativo falhando (token sem permissão, por exemplo), a pergunta chega em texto.
- [ ] **CA-8** — Concluir uma tarefa pelo WhatsApp mostra `Confirmar` e `Cancelar`; clicar `Cancelar` não altera nada.
- [ ] **CA-9** — Marcar um compromisso pelo WhatsApp devolve o link do compromisso na resposta.
- [ ] **CA-11** — Clicar num botão do menu em número oficial chega ao Astro, e a conversa do lead no tracking não ganha uma mensagem solta "Agenda".
- [ ] **CA-12** — Clicar num botão de uma pergunta de ontem responde que a pergunta foi encerrada.
- [ ] **CA-13** — Deixar "Para quando eu marco?" sem resposta por 10 minutos faz chegar o aviso de encerramento; responder depois disso não continua o agendamento antigo.
- [ ] **CA-14** — Responder antes dos 10 minutos não gera aviso nenhum.
- [ ] **CA-10** — Uma linha com título de 40 caracteres chega encurtada, e o clique nela escolhe a opção certa.

## 5. Como o clique chega (webhook da Meta)

O clique vem no mesmo webhook das mensagens (`/api/chat/webhook/official`, campo `messages`), como uma mensagem do tipo `interactive`:

```json
{
  "from": "5586998221810",
  "id": "wamid.HBg...",
  "timestamp": "1791542801",
  "type": "interactive",
  "context": { "from": "5511952133700", "id": "wamid.<mensagem com os botões>" },
  "interactive": {
    "type": "button_reply",
    "button_reply": { "id": "menu:app:agenda", "title": "Agenda" }
  }
}
```

Em lista, `interactive.type` é `list_reply` e o bloco é `list_reply: { id, title, description }`.

- `id` é exatamente o que o Astro enviou no botão ou na linha (até 256 caracteres). `title` é o texto que a pessoa viu.
- `context.id` é o `wamid` da mensagem que tinha os botões: serve para saber a qual pergunta o clique responde.
- Botão de **template** (quick reply) chega diferente: `type: "button"` com `button: { payload, text }`. Não é o caso do menu, mas o adapter já trata os dois.

No código, `adapters/meta-cloud/provider.ts` já converte os dois formatos para `interactive_reply` com `replyId` e `replyText`. **O que falta é o desvio do Astro**: `official/route.ts` só chama `maybeHandleBotMessage` para texto e mídia. O `context.id` não é lido hoje.

Amostras reais capturadas no teste de 09/10/2026, em `src/http/whats-oficial/jsons/webhooks/`: `interactive-button-reply.json` e `interactive-list-reply.json`. O formato bateu com o documentado. Em `list_reply` a Meta só manda `description` quando a linha tinha uma.

## 5.1 Abordagem

- **HTTP**: `src/http/whats-oficial/send-interactive.ts` (botões e lista), exportado no `index.ts`.
- **Provider**: a porta de saída (`providers/types.ts`) ganha `sendInteractive`; só o adapter `meta-cloud` implementa.
- **Canal do bot**: `tracking-provider-channel.ts` escolhe botões, lista ou texto (RF-2). O id de cada opção volta no `interactive_reply` e é traduzido para a resposta que o roteiro já entende.
- **Menu**: `src/features/astro-bot/lib/menu/` com a árvore como dado (`menu-tree.ts`) e o estado por conversa (`menu-state.ts`). Cada folha aponta para a chave de uma ação (`appointment.create`, `action.complete`) ou de uma consulta, e entra pelo mesmo `resolveGuided`.
- **Entrada**: `official/route.ts` passa a desviar para o Astro também a mensagem única do tipo `interactive_reply`, entregando `replyId` e `replyText`; `maybeHandleBotMessage` ganha o campo `interactiveReply`. Ids com prefixo próprio (`menu:` para navegação, `ans:` para resposta de roteiro), para o clique de botão de automação do tracking (tag por botão) continuar indo para o fluxo dele.
- **Roteador**: `router.ts` consulta o menu antes das camadas baratas; texto que não é navegação segue o caminho de hoje.

## 6. Riscos

| Risco | Tratamento |
| --- | --- |
| Mensagem interativa aceita pela Meta e não entregue (foi o que aconteceu com a Uazapi) | Teste real no número oficial antes de ligar; flag `ASTRO_BOT_INTERACTIVE` para desligar sem deploy |
| Menu atrapalhar quem já escreve o pedido | RF-10: texto livre sempre vence |
| Limite de 10 linhas | RF-8 |
| Janela de 24 h da Meta | O Astro só responde a quem escreveu, então está sempre dentro da janela |

## 7. Documentação

`docs/whatsapp-oficial-overview.md` (Regra 14): novo cliente HTTP, novo método da porta, flag.

## 9. Changelog

- 2026-10-09 — criada.
- 2026-10-09 — acrescentada a seção do webhook de resposta (RF-13 a RF-15, CA-11 e CA-12), depois de conferir que o clique não chega ao Astro hoje. RF-12 (link do compromisso) já implementado na mesma branch.
- 2026-10-09 — aprovada pelo Weydson e implementada. Divergências e detalhes:
  - RF-14: o id de uma opção do roteiro é `ans:<posição>` ("ans:2"), que entra como a resposta digitada na lista numerada. É o caminho que já funcionava; o id da entidade não serve porque algumas opções não são entidades (ex.: "Título", "Prazo").
  - RF-6: os botões da saudação usam rótulo curto ("Demandas", "CRM"); a lista de Apps usa o nome completo.
  - RF-3: "quando o Astro não entende" cobre a resposta de reserva do orquestrador, que ganha o botão "Menu".
  - RF-9 e RF-11: Confirmar/Cancelar e Menu/Encerrar só aparecem onde há botão de verdade; na lista numerada o texto já diz "responda SIM ou NÃO".
  - "Buscar lead" é uma dica de como escrever, não um roteiro: não existe consulta em código de lead por nome, o pedido vai para o orquestrador.
  - Sem `ASTRO_BOT_INTERACTIVE` definido, os botões ficam **ligados** (a flag só desliga).
- 2026-10-09 — verificado: navegação do menu por script com um usuário real, só leitura (saudação, lista de Apps, resposta numerada, folha, "menu", id inexistente, saudação com pergunta no ar) e o corte de listas (12, 5 e 3 opções). **Não verificado**: envio real pela Meta e clique real (CA-1 a CA-12 dependem de número oficial). Sem captura do webhook de resposta.
- 2026-10-09 — teste com número real (tracking "API OFICIAL DE TESTE", org ASTRO QA, banco de desenvolvimento). Confirmado: saudação com botões entregue e lida, clique de botão (`menu:app:agenda`) e de lista (`ans:4`) chegando ao Astro e seguindo o roteiro (CA-1, CA-3, CA-11). Defeitos achados e corrigidos:
  - O Astro não reconhecia o número na API oficial: a Meta manda o `wa_id` sem o 9º dígito e o binding tem o 9. O gate passou a usar `waIdLookupVariants` e a filtrar pela org da tracking (havia um segundo binding do mesmo telefone, na outra grafia, em outra org).
  - O servidor respondia `ok` com a resposta não saindo (token inválido). Agora responde `send_failed`.
  - "Para amanhã" → "que horas?" → "meio dia" voltava a perguntar o dia: a segunda resposta apagava a primeira. Campos respondidos em partes passam a se somar (`accumulatingFields`), e "meio dia", "meia noite", "3 da tarde" e hora solta ("12") são lidos como hora.
  - "Com o Antônio José" não achava o lead: a busca tenta de novo sem a preposição.
  - Perguntas com seletor na plataforma ganharam atalhos em botão no WhatsApp (Hoje/Amanhã, opções fixas, "Sem lead") e textos próprios ("Busque abaixo" não existe no WhatsApp).
  - Não verificado depois dessas correções: o fluxo de marcar até o fim, CA-2, CA-4 a CA-10 e CA-12.
- 2026-10-09 — RF-16 (aviso de inatividade), pedido pelo Weydson a partir do exemplo da Globo Drogaria. Função Inngest `astro-bot-inactivity-notice` com `cancelOn` no evento de mensagem recebida; lógica em `src/features/astro-bot/lib/inactivity.ts`. Sem pesquisa de satisfação: o Astro atende a equipe. Em produção depende do "Resync app" no Inngest depois do deploy.
- 2026-10-09 — menu ampliado a pedido do Weydson: Chat, Insights, Propostas, Financeiro e Formulários (8 Apps). Cada item foi conferido por script: os 29 caem numa ação ou consulta em código, exceto "Buscar lead", que é dica. Planner ficou de fora: o Astro não tem ação nem consulta do Planner. RF-16 passou a valer também para menu parado, como estava na proposta aprovada.
