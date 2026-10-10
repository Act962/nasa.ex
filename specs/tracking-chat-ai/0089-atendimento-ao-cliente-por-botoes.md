---
id: 0089
titulo: Atendimento ao cliente por botões e listas
dominio: tracking-chat-ai
status: implementada
autor: Weydson
criada: 2026-10-10
atualizada: 2026-10-10
branch: feature/W-form-fichas-proxima-data-20261009
pr: Act962/nasa.ex#453
peso: completa
---

# 0089 — Atendimento ao cliente por botões e listas

## 1. Contexto

No teste real de 10/10/2026 (Clínica Tércio Rezende, funil Suporte), marcar uma consulta por conversa livre custou ao cliente 12 mensagens e à empresa 12 respostas de IA. A maior parte foi atrito, não atendimento:

| O que o cliente escreveu | O que aconteceu |
| --- | --- |
| "Jockey" | A assistente repetiu a pergunta da unidade |
| "08h", depois "Já disse" | Pediu o horário de novo e confirmou duas vezes |
| "Quero remarcar", "11", "Cancela minha consulta" | Confundiu o horário proposto com o marcado e não cancelou |
| 35 mensagens em 24 minutos | Bateu o limite de respostas por hora e a conversa foi cortada |

O ASTRO da equipe já resolve isso no WhatsApp com menu de botões e listas (spec 0079): escolha por clique, roteiro em código, sem modelo. O atendimento ao cliente ainda é só texto livre.

**Custo, para não confundir:** resposta dentro das 24 h depois da mensagem do cliente não é cobrada pela Meta, com ou sem botão. O ganho está nas respostas de IA (2★ cada, mais o custo do modelo) e no número de mensagens.

## 2. Objetivo

O cliente resolve o que é roteiro (marcar, ver, remarcar, cancelar, endereços, links, falar com atendente) clicando em botões e listas, sem modelo. Pergunta aberta, áudio e chamada de voz continuam com a assistente como hoje.

### Não-objetivos

- Mudar o atendimento por áudio ou por chamada: voz não tem botão.
- Tirar o texto livre: ele vale em qualquer ponto do menu.
- Mudar o ASTRO da equipe (spec 0079) ou o ASTRO do sistema.
- Construtor visual de menu: os itens saem das capacidades já ligadas.
- Tabela nova para guardar o passo do roteiro.
- Templates de marketing ou qualquer mensagem fora da janela de 24 h.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Interruptor "Atender com menu de botões" na aba "O que o Astro pode fazer" (`capabilities.guidedMenu`, booleano). Desligado por padrão: quem já usa o atendimento não muda |
| RF-2 | **Abertura**: saudação ("oi", "bom dia", "menu", "opções", primeira mensagem depois de 6 h de silêncio) responde com uma frase da assistente e até 3 botões, montados pelas capacidades ligadas. Com agenda: `Agendar`, `Meus horários`, `Mais opções`. Sem agenda: `Mais opções` e `Atendente` |
| RF-3 | **Mais opções** abre uma lista (até 10 linhas): Endereços e horários, Links da empresa, Formulários, Minhas fichas, Enviar documento, Pedido para a equipe, Falar com atendente. Só aparece o que estiver ligado. "Falar com atendente" aparece sempre |
| RF-4 | **Agendar**: lista das agendas liberadas (uma só: pula) → lista de dias com horário livre (próximos 9 dias com vaga, mais "Outra data") → lista de horários (até 9, mais "Ver mais horários") → resumo com `Confirmar` e `Cancelar`. Só o `Confirmar` marca |
| RF-5 | **Meus horários**: lista os agendamentos futuros do cliente; ao escolher um, botões `Remarcar`, `Cancelar`, `Voltar`. Remarcar reaproveita dias → horários → confirmar. Cancelar pede `Confirmar cancelamento` |
| RF-6 | **Texto livre vale sempre**: qualquer mensagem escrita que não seja saudação nem clique vai para a assistente, como hoje. A resposta dela termina com o botão `Menu` (só onde há botão de verdade) |
| RF-7 | **"Outra data"** pede para escrever o dia; essa resposta vai para a assistente, que consulta os horários e devolve a lista de horários do roteiro |
| RF-8 | O **id do clique carrega o passo** (`cli:<passo>:<dados>`), como na spec 0079 (RF-14). Nada de estado guardado entre mensagens. Os dados do id são conferidos de novo no servidor a cada clique: agenda liberada, horário ainda livre, agendamento do próprio cliente |
| RF-9 | Clique em menu antigo cujo dado não vale mais (horário já ocupado, agendamento já cancelado) responde "Esse horário não está mais disponível" e reabre o passo atual. Nunca é lido como pedido novo |
| RF-10 | **Passo por clique não cobra resposta de IA** nem conta no limite de respostas por hora (spec 0084, RS-9). Tem limite próprio: 120 cliques por cliente por hora; acima disso, silêncio |
| RF-11 | **Número não oficial ou envio interativo que falha**: cai para lista numerada ("1", "2"…), como a spec 0079 (RF-2). A resposta numérica só vale para a última pergunta enviada |
| RF-12 | **Áudio do cliente**: transcrito e tratado como texto livre (RF-6); a resposta segue as regras de áudio da spec 0084. O menu não é lido em voz alta |
| RF-13 | **Chamada de voz**: sem mudança (spec 0087). O interruptor do menu não afeta a chamada |
| RF-14 | Tudo o que o roteiro faz usa as **mesmas funções** das ferramentas da assistente (`tracking-chat-ai/server/tools/agenda.ts`, `client-services.ts`): mesmo escopo preso ao lead, mesmo lembrete, mesma jornada, mesma notificação à equipe |
| RF-15 | Toda mensagem do roteiro fica no histórico do chat (`persistOutboundMessage`), e o clique do cliente entra como mensagem dele com o título do botão |
| RF-16 | Lead com atendente humano (`isActive = false`) não recebe menu: clique recebe "Seu atendimento está com a nossa equipe" uma vez, depois silêncio |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Passo por clique responde em até 3 s (sem modelo, sem espera de digitação) |
| RNF-2 | Títulos respeitam os limites da Meta: botão 20 caracteres, linha de lista 24, descrição 72. Nome maior é encurtado no título e vai inteiro na descrição |
| RNF-3 | O roteiro roda no Inngest, como o agente (Regra 4); o webhook só publica o evento |

## 4. Segurança de dados

| # | Regra | Como |
| --- | --- | --- |
| S-1 | Identidade vem do servidor | O lead é o do telefone que clicou. O id do botão nunca carrega telefone nem lead |
| S-2 | Id de botão é entrada não confiável | Cada clique valida de novo: agenda entre as liberadas e da empresa; agendamento do próprio lead; data futura; horário livre. Id montado à mão com agenda de outra empresa ou agendamento de outro cliente é recusado sem dizer se existe |
| S-3 | Só "livre ou ocupado" | A lista de horários mostra os livres; nunca quem ocupa os outros |
| S-4 | Negar por padrão | Item do menu só existe se a capacidade estiver ligada; clique em item desligado depois recebe "Essa opção não está disponível" |
| S-5 | Ação que altera pede confirmação | Marcar, remarcar e cancelar só no botão de confirmar |
| S-6 | Dados sensíveis | PIX, links e códigos saem em texto, nunca em áudio; resultado de exame não entra em menu |
| S-7 | Rastro | Cada ação concluída gera o mesmo evento de jornada e a mesma notificação de hoje |

Testes de vazamento (critérios de aceite): id com agenda de outra empresa, id com agendamento de outro lead, clique em capacidade desligada, clique de lead com atendente.

## 5. Regras da Meta (reler a regra oficial antes do código)

| Regra | Efeito |
| --- | --- |
| Mensagens interativas: até 3 botões; lista com 1 botão de abrir e até 10 linhas | RF-2, RF-3, RF-4 e RNF-2 |
| Mensagem interativa só dentro da janela de 24 h | O menu só responde ao cliente; nunca inicia conversa |
| Automação exige saída para humano | "Falar com atendente" em todo menu (RF-3) |
| IA de uso geral proibida | Menu restrito aos serviços da empresa; texto livre continua sob as regras da spec 0084 |
| Qualidade do número: repetição e insistência geram bloqueio | Uma mensagem por passo; o menu não se repete sozinho; limite de cliques (RF-10) |

## 6. Critérios de aceite

- [ ] **CA-1** — Com o menu ligado, "oi" recebe a saudação com os botões das capacidades ligadas, sem execução de modelo (nenhum `AiChatRun` novo).
- [ ] **CA-2** — Agendar por cliques (agenda → dia → horário → Confirmar) cria o agendamento, o lembrete e o evento de jornada, com zero respostas de IA.
- [ ] **CA-3** — Clicar em horário e depois em `Cancelar` no resumo não cria nada.
- [ ] **CA-4** — Meus horários → escolher → Cancelar → Confirmar cancela o agendamento certo.
- [ ] **CA-5** — Remarcar por cliques muda data e hora e recria o lembrete.
- [ ] **CA-6** — "Vocês atendem Unimed?" no meio do menu é respondido pela assistente e a resposta traz o botão `Menu`.
- [ ] **CA-7** — Horário escolhido que foi ocupado antes do `Confirmar` recebe "não está mais disponível" e a lista de horários de novo.
- [ ] **CA-8** — Id de botão com agenda de outra empresa, ou agendamento de outro lead, é recusado e nada é lido nem alterado.
- [ ] **CA-9** — Capacidade desligada não aparece no menu; clique antigo nela recebe "não está disponível".
- [ ] **CA-10** — Número não oficial recebe lista numerada e "2" escolhe a segunda opção da última pergunta.
- [ ] **CA-11** — Áudio do cliente com o menu ligado é transcrito e respondido pela assistente; a chamada de voz funciona igual a antes.
- [ ] **CA-12** — Com o menu desligado, o atendimento é idêntico ao de hoje.
- [ ] **CA-13** — Passos por clique não debitam Stars de resposta de IA.
- [ ] **CA-14** — Lead com atendente humano não recebe menu.

## 7. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Nenhum dia com vaga nos próximos 30 dias | "Sem horários livres no momento" com `Atendente` e `Menu` |
| CB-2 | Mais de 9 horários no dia | 9 primeiros e "Ver mais horários", que mostra os seguintes |
| CB-3 | Mais de 10 agendas liberadas | 9 primeiras e "Outra", que pede o nome por texto (assistente) |
| CB-4 | Cliente clica duas vezes em `Confirmar` | O segundo clique encontra o horário ocupado por ele mesmo e responde "Já está marcado", sem duplicar |
| CB-5 | Cliente responde "sim" por texto no resumo | Vai para a assistente, que tem a mesma ferramenta e o contexto da conversa (o resumo está no histórico) |
| CB-6 | Clique chega fora de ordem ou duplicado pela Meta | Dedupe por `wamid` que já existe; passo é idempotente porque revalida tudo |
| CB-7 | Atendimento desligado no tracking (`globalAiActive = false`) | Nenhum menu é enviado |
| CB-8 | Empresa sem saldo de Stars | Menu por clique continua (não usa IA); texto livre segue a regra de saldo de hoje |
| CB-9 | Clique em botão de fluxo com tag (spec 0085) | Continua aplicando a tag; ids `cli:` são do menu, os demais seguem o caminho atual |
| CB-10 | Trackings já em produção | `guidedMenu` ausente = desligado. Nenhum caminho novo sobre dado antigo |

## 8. Decisões de design

### D-1 — Roteiro em código, modelo só no texto livre

- **Escolha**: os passos de escolha rodam sem modelo.
- **Alternativas descartadas**: instruir o modelo a "sempre mandar botões" (continua gastando uma resposta de IA por passo e erra o identificador, como no cancelamento do teste).
- **Consequência**: mais código de roteiro; em troca, custo zero e resultado previsível.

### D-2 — Estado no id do clique

- **Escolha**: `cli:<passo>:<dados>`, revalidado a cada clique.
- **Alternativas descartadas**: guardar o passo em tabela ou em `Message.metadata` (estado que envelhece, e a spec 0079 já provou o id).
- **Consequência**: ids curtos (a Meta limita a 256 caracteres); data e hora vão compactas.

### D-3 — Interruptor desligado por padrão

- **Escolha**: `guidedMenu` nasce desligado.
- **Alternativas descartadas**: ligar para todos (muda o atendimento de empresas em produção sem aviso).

### D-4 — Mesmas funções das ferramentas

- **Escolha**: extrair de `tools/agenda.ts` as funções de marcar, listar, remarcar e cancelar para serem chamadas pela ferramenta e pelo roteiro.
- **Alternativas descartadas**: reescrever a lógica no roteiro (duas implementações de agendamento divergem em semanas).

## 9. O que reaproveita

| Necessidade | Já existe |
| --- | --- |
| Enviar botões e lista, com queda para lista numerada | `TrackingProviderBotChannel.sendButtons` (spec 0079) |
| Receber o clique | `interactive_reply` no webhook oficial e na Uazapi |
| Horários livres | `listAgendaFreeSlots` (`public-booking-chat/lib/booking-agent.ts`) |
| Marcar, listar, remarcar, cancelar, lembrete | `tracking-chat-ai/server/tools/agenda.ts`, `lib/appointment-reminder.ts` |
| Links, formulários, fichas, pedido à equipe | `tracking-chat-ai/server/tools/client-services.ts` |
| Transferir para atendente | `transfer_to_human` |
| Gravar no chat | `persistOutboundMessage` |
| Capacidades | `AiSettings.capabilities` (spec 0084), sem migration |
| Execução assíncrona | evento do agente no Inngest |

**Novo de fato:** o roteiro do cliente (`tracking-chat-ai/lib/guided-menu/`), o desvio de saudação e de clique `cli:` antes do agente, o interruptor na tela.

## 10. Impacto

- [ ] Schema / migration — **não**
- [x] Procedures oRPC — `ia.capabilities` aceita `guidedMenu`
- [x] Automações (Inngest) — o agente ganha o desvio do menu; sem função nova
- [ ] Env vars novas — não
- [ ] Breaking change — não (desligado por padrão)
- [x] Documentação — `docs/whatsapp-oficial-overview.md` se o webhook mudar (Regra 14); âncora de guia no interruptor (Regra 21)

## 11. Plano de testes

Sem runner instalado (Regra 20): script em `scripts/` chamando o roteiro com cliques simulados no banco de desenvolvimento, e teste real pelo número de teste.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 a CA-5, CA-7, CA-13 | script + manual | Cliques simulados; conferir `Appointment`, `Reminder`, `AiChatRun` e saldo |
| CA-8, CA-9, CA-14 | script | Ids montados à mão |
| CA-6, CA-11 | manual | WhatsApp real, texto, áudio e chamada |
| CA-10 | script | Canal Uazapi simulado |
| CA-12 | manual | Menu desligado, repetir a rodada 1 de 10/10 |

## 12. Riscos e rollback

- **Cliente preso no menu**: mitigado pelo texto livre sempre valer e por "Falar com atendente" em toda lista.
- **Clique e texto ao mesmo tempo** (duas execuções): o roteiro é idempotente por revalidar; a assistente lê o histórico já com o clique.
- **Rollback**: desligar o interruptor. Sem migration; `guidedMenu` sobrando no JSON é ignorado.

## 13. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-10 | Weydson | Criada, para revisão |
| 2026-10-10 | Weydson | Aprovada ("pode seguir com as demais mudanças") e implementada. Divergências na seção 14 |

## 14. Como ficou a implementação

| Parte | Onde |
| --- | --- |
| Ids dos cliques, com validação de formato | `tracking-chat-ai/lib/guided-menu/menu-ids.ts` (prefixo `cli:`) |
| Roteiro | `tracking-chat-ai/lib/guided-menu/guided-menu.ts` (`handleGuidedMenu`) |
| Desvio antes da assistente | `tracking-chat-ai/lib/agent.ts`, etapa `guided-menu`, antes do limite de uso e da cobrança |
| Id do clique gravado na mensagem | `tracking-chat/lib/inbound/persist-canonical-inbound.ts` (`metadata.interactiveReplyId`) |
| Escopo de agenda compartilhado | `buildLeadAgendaScope` em `tracking-chat-ai/server/tools/index.ts` |
| Interruptor | `capabilities.guidedMenu`, seção "Forma de atender" na aba "O que o Astro pode fazer" |
| Verificação | `scripts/guided-menu-check.ts` (cliques simulados, canal falso, limpa o que grava) |

O roteiro chama as próprias ferramentas da assistente (`makeLeadAgendaTools(...).execute`), não uma cópia da lógica: marcar, listar, remarcar e cancelar têm um caminho só. O envio usa `TrackingProviderBotChannel.sendButtons` (botões, lista ou lista numerada).

**Divergências do texto original**

| Item | Como ficou | Por quê |
| --- | --- | --- |
| RF-2, menu na primeira mensagem depois de 6 h | Só em saudação ("oi", "bom dia", "menu", "opções"…) | Abrir menu no lugar de responder a uma pergunta direta atrapalha |
| RF-3, itens "Endereços", "Formulários", "Fichas", "Documento", "Pedido para a equipe" no menu | "Mais opções" tem Links da empresa, Falar com atendente e Voltar; o texto convida a escrever a dúvida | Esses itens não têm resposta em código: são da assistente, por texto livre |
| RF-6, botão `Menu` depois da resposta da assistente | Não feito | Custaria uma mensagem a mais por resposta; "menu" digitado abre |
| RF-7, "Outra data" | A lista de dias diz "se preferir outra data, escreva o dia"; a resposta vai para a assistente | Mesmo efeito, sem passo extra |
| RF-16, aviso a lead que está com atendente | Silêncio | O atendimento nem é acionado para lead inativo, como já era |
| RNF-2 | Nomes que ficam iguais ao encurtar viram a parte que os diferencia ("Centro", "Jóckei"), com o nome inteiro na descrição; a lista de agendas sai sempre em lista | Dois botões "Consulta oftalmológ…" idênticos apareceram na verificação |

**Verificado em 10/10/2026** (`scripts/guided-menu-check.ts`, funil Suporte da Clínica Tércio Rezende): CA-1, 2, 3, 4, 5, 6, 8, 13 e CB-4, mais id malformado e "falar com atendente". **Falta verificar**: clique real no WhatsApp (CA-11, CA-12), número não oficial (CA-10), horário ocupado entre a escolha e o confirmar (CA-7), capacidade desligada (CA-9).

## 15. Testar o fluxo pela tela e novo nome do menu (2026-10-10)

Pedido do Weydson: a pessoa monta o fluxo e testa na própria tela, num celular com a cara do WhatsApp.

- **Nome**: o item "ChatBot AI" das configurações do tracking passa a se chamar **"Fluxo de atendimento"**. O item que já tinha esse nome (lista de consultores do funil) passa a se chamar **"Consultores"**. Só rótulos: valores de aba (`chatbot-ia`, `flow-attendance`), rotas e nomes de arquivo não mudaram. Textos que apontavam para "Chatbot IA" foram ajustados.
- **Testar**: o botão "Testar" da aba Geral já existia e abria um chat que chamava um webhook externo (`n8n.nasaex.com/webhook/chat-test`) direto do navegador, sem autenticação. Foi substituído por um celular simulado (`tracking-settings/components/chat-test-ai-modal.tsx`), servido pela rota própria `ia.attendanceTest.send`, que exige sessão e confere a empresa do tracking.
- **Como o teste responde** (`tracking-chat-ai/lib/attendance-test.ts`):
  - Saudação e cliques: o mesmo roteiro do menu, em modo de teste (`runGuidedMenuTest`). Agendas, dias e horários são os reais; confirmar mostra "(teste) Marcado!" e não grava; "Meus horários" e "atendente" explicam o que aconteceria.
  - Texto livre: a assistente de verdade, com as instruções, os documentos marcados e as opções ligadas no funil. Só as ferramentas de leitura (`list_agendas`, `get_available_slots`) rodam; as que gravam ou enviam devolvem um resultado simulado. Cobra como uma resposta normal (`chat_ai_message`) e registra o custo em `UsageEvent`.
  - Nada é enviado ao WhatsApp, nenhuma mensagem, agendamento, tag ou demanda é gravado. O histórico do teste vive só na tela.
- **Verificado**: ensaio por script do motor (menu, agendar até confirmar, meus horários, atendente, texto livre, tracking de outra empresa recusado) e contagem de zero agendamentos e zero mensagens gravados. **Falta**: abrir a tela no navegador.

