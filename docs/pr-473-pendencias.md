# Pendências da PR 473

Revisão de 20 e 21/10/2026 da PR [Act962/nasa.ex#473](https://github.com/Act962/nasa.ex/pull/473): estado de atendimento, Editar gatilho, origem real do lead e Modo Agente igual ao normal (specs 0112, 0113 e 0114).

As correções marcadas com ✅ entraram na própria PR em 21/10/2026. Foram conferidas pela leitura do código, pelo typecheck completo (0 erros) e pelo `pnpm guides:check`. **Nenhuma foi exercitada em tela nem em WhatsApp real.** Ao tratar um item, marque o status. Não apague o item.

| # | Item | Status |
| --- | --- | --- |
| 1 | Pausa da IA por lead desligada (decisão temporária) | 🚧 feito; condição de volta em aberto |
| 2 | IA fala por cima do atendente e depois de "quero falar com humano" | ⬜ consequência aceita do item 1 |
| 3 | "Quem responde primeiro: Equipe" não faz efeito com a pausa desligada | ⬜ |
| 4 | Corrida entre resposta do atendente e entrada da IA | ⬜ só acontece com a pausa ligada |
| 5 | Eco da própria mensagem contando como fala do atendente | ⬜ precisa de teste com WhatsApp |
| 6 | Requisição HTTP: redirecionamento para endereço interno | 🚧 endereço inicial barrado; redirecionamento em aberto |
| 7 | Mudanças que valem para todas as empresas sem interruptor | ⬜ avisar suporte e clientes |
| 8 | `isActive` mudou de sentido em ~15 filtros (contagens) | ⬜ validar números |
| 9 | Custo do webhook de entrada e do Inngest | ⬜ medir em produção |
| 10 | Estado e Score em campo Json da Jornada | ⬜ dívida assumida pela spec |
| 11 | Origem do lead: corrida e spam de cliques | ⬜ |
| 12 | Número oficial antigo continua DISCONNECTED | ⬜ |
| 13 | Variáveis preenchidas duas vezes nas mensagens | ⬜ |
| 14 | Correções já feitas | ✅ |

## 1. Pausa da IA por lead desligada (decisão temporária)

A IA liga e desliga só para o funil inteiro (Configurações → Chatbot IA, `Tracking.globalAiActive`). O interruptor `IS_LEAD_AI_PAUSE_ENABLED` em `src/features/tracking-chat-ai/lib/lead-ai-pause.ts` está `false`.

**Com ele desligado:**
- a IA ignora `Lead.isActive` (WhatsApp, In-Chat, Instagram, Facebook, chat do site e chamada de voz);
- nada grava a pausa: resposta do atendente, `transfer_to_human`, limite de uso, consultor do catálogo e o endpoint legado `/api/chat/ia/deactive`;
- o botão por lead some do card, do chat e do "Personalizar board" (fora das empresas no estado de atendimento);
- no estado de atendimento a IA responde sempre primeiro: sem espera da equipe, sem "IA entra" e sem a volta depois da transferência. Por isso **também não saem a mensagem fixa de espera nem os avisos ao dono** (sino e WhatsApp), que dependem da espera da equipe. Só a espera do consultor do rodízio ainda manda a mensagem de espera. Seguem: etiquetas e estado, Score (reclamação só com "Equipe primeiro") e agendamento.

**Em aberto:**
- Definir quando a pausa por lead volta (ou se sai de vez). Se sair de vez, apagar o interruptor, o `CheckIaLead` e os caminhos `IS_LEAD_AI_PAUSE_ENABLED ? ... : ...`, e decidir o que fazer com a coluna `Lead.isActive`.
- Leads que já estavam com `isActive = false` antes do deploy continuam assim no banco. Se a pausa voltar, eles voltam pausados de uma vez.

## 2. IA fala por cima do atendente

Consequência direta do item 1. A IA continua respondendo:
- depois que o cliente pede "quero falar com humano" (o prompt em `tracking-chat-ai/lib/system-prompt.ts` ainda diz que `transfer_to_human` pausa a IA);
- enquanto o atendente conversa com o cliente.

**Em aberto:** se a decisão "ligado ou desligado" ficar, ajustar o prompt para a IA não prometer que vai sair da conversa.

## 3. "Quem responde primeiro: Equipe" sem efeito

Com a pausa desligada, a configuração `firstResponder = TEAM` do estado de atendimento é ignorada (a IA responde primeiro, ver `org-defaults/lib/attendance/state.ts`). A opção continua aparecendo na tela de configuração e no guia `chat.attendance-first-responder`, assim como os tempos da mensagem fixa e dos avisos ao dono, que também ficam sem efeito.

**Em aberto:** esconder ou desabilitar a opção enquanto a pausa estiver desligada.

## 4. Corrida entre atendente e IA

Só acontece com a pausa ligada. `attendance-check.ts` confere e trava a seção num passo e age em outros (`state.ts`, envio da mensagem fixa e `setAiAllowed`) sem conferir de novo `lastHumanAt`. Se o atendente responde entre os passos, a IA é religada e responde por cima dele, ou o "já vamos te atender" sai depois da resposta humana.

**Em aberto:** antes de agir, reler a seção e sair se `lastHumanAt` mudou. Obrigatório antes de religar a pausa por lead.

## 5. Eco da própria mensagem como fala do atendente

`persist-canonical-inbound.ts` decide se a mensagem é eco procurando a `Message` pelo id externo, mas a mensagem fixa (`fixed-message.ts`) e a IA enviam primeiro e gravam depois. Se o eco do uazapi chegar antes da gravação, vira `applyHumanReplyAttendance`: o lead fica "Em atendimento" sem ninguém.

**Em aberto:** reproduzir com WhatsApp real. Se acontecer, gravar a mensagem antes de enviar ou marcar o envio em andamento.

## 6. Requisição HTTP e redirecionamento

O passo agora recusa endereço interno (localhost, rede privada, metadados da nuvem) usando `isPubliclyFetchable` (`trafego/server/lib/release/fetch-site.ts`), nos dois modos. Vale também para o modo normal, que antes não tinha proteção.

**Em aberto:**
- Um endereço público que redireciona para endereço interno ainda passa, porque o `ky` segue o redirecionamento. Seguir os redirecionamentos na mão, como o `fetchSiteText`.
- A checagem está em `trafego`. Com dois usos, vale subir para `src/lib/`.
- A resposta inteira fica gravada no histórico do fluxo; resposta grande pode estourar o limite do step do Inngest.

## 7. Mudanças para todas as empresas, sem interruptor

Intencionais nas specs, mas precisam de aviso ao suporte e aos clientes:
- "Esperar" em horas ou dias no Modo Agente passa a esperar de verdade (antes era pulado).
- Passos que paravam com "Sem executor" no Modo Agente agora rodam (Temperatura, Responsável, Ganho/Perda, HTTP, Enviar Formulário/Agenda/Linnker/N-Box/Route, Abrir Formulário, Filtrar Leads), e os envios seguintes passam a sair.
- Botões no Modo Agente cobram Stars.
- "Enviar para outro número" no Modo Agente vai para esse número (antes ia para o próprio lead).
- Contrato sem modelo escolhido falha, em vez de pegar um modelo qualquer.
- A mensagem do WhatsApp do Linnker e do Pages leva "(cód. LXXXX)", visível para o cliente. Pode quebrar fluxo que compara o texto da mensagem por igualdade.
- Link "Editar gatilho" nas mensagens de fluxo.

## 8. `isActive` mudou de sentido nos filtros

A PR trocou `isActive: true` por `currentAction`/`isArchived` em cerca de 15 lugares (dashboard, `search-entities`, `external-contacts`, `nasa-command`, `insights/funnel`, `lead-rescue`, `detect-stale-leads`, ferramentas de analytics do Astro, `lead-interest`, `step-node`).

**Em aberto:** comparar as contagens antes e depois numa empresa real.

## 9. Custo do webhook e do Inngest

- Empresas no `ATTENDANCE_STATE_ORGS`: de 15 a 18 idas ao banco em sequência por mensagem recebida. `mirrorStatusFlowTags` roda mesmo quando o estado não mudou (`state.ts`).
- Lead novo de WhatsApp, em qualquer empresa: mais consultas para descobrir a origem (`resolve-whatsapp-origin.ts`).
- Inngest: duas funções novas por evento (`org-defaults-attendance-check` e `org-defaults-appointment-watch`). Com a pausa desligada, as checagens de "Equipe primeiro" não são agendadas. As esperas de até 15 dias do Modo Agente agora funcionam e ficam abertas no Inngest; conferir o limite de espera do plano.
- O passo `check-lead-ai` soma 1 step em toda execução da IA, de todas as empresas.

**Em aberto:** ligar `ATTENDANCE_STATE_ORGS` primeiro só para as empresas de teste e acompanhar execuções e tempo do webhook. Pular `mirrorStatusFlowTags` quando o estado não mudou.

## 10. Estado e Score em Json

Estado, Score e conferências de agendamento vivem em `LeadJourneyEvent.metadata` (Json), filtrados por `path` e somados por `metadata->>'points'`. A spec escolheu isso (RNF-3).

**Em aberto:** se o Score virar relatório ou filtro de tela, mover para colunas tipadas.

## 11. Origem do lead

- Dois leads quase simultâneos podem ligar o mesmo clique do Linnker: o `update` do clique não exige `leadId: null`.
- O evento `whatsapp_click` das Pages é público e sem limite de taxa: spam de cliques rotula como "provável" os leads de WhatsApp da janela de 15 minutos.
- A janela por id (`id >= 'c' + base36`) depende de todos os ids serem cuid v1. Não testado com a collation do banco de produção.

## 12. Número oficial antigo DISCONNECTED

O número oficial só vira CONNECTED quando a empresa salva as credenciais de novo ou faz o Embedded Signup. Não há atualização dos registros antigos, então o `detect-broken-integrations` segue mandando alerta diário para eles. O simulador também não confere se o número oficial tem token.

## 13. Variáveis preenchidas duas vezes

`createMessageFiller` (`message-variables.ts`) aplica `{{nome}}` e depois `interpolate`. Se o nome do lead contiver `{{vars.x}}`, a variável do fluxo vai para o próprio lead.

## 14. Correções já feitas (21/10/2026)

- ✅ 22 erros de tipo que quebravam o build (`FlowMessageOrigin` como `type`, `where` tipado em `lead-interest.ts`, `select` sem `as any` em `get-many.ts`, `finish` no guia do chat, retorno do preset "Recuperar quem cancelou").
- ✅ IA sem resposta para quem usa Gemini com agenda: só a OpenAI recebe instrução depois do histórico.
- ✅ Lembrete de cobrança e aviso fiscal saindo pelo número oficial: `findConnectedOrganizationInstance` prefere o número de QR code.
- ✅ Requisição HTTP para endereço interno (ver item 6 para o que falta).
- ✅ In-Chat das empresas no estado de atendimento sem etiqueta: volta às etiquetas antigas.
- ✅ "Quanto tempo demora…?" contando como reclamação (−10 no Score).
- ✅ "Site (provável)" herdado do clique de outro lead que veio pelo código.
- ✅ Etiquetas do Modo Agente sem filtro de empresa.
- ✅ Prompt que mandava a IA "não dizer que é outra pessoa": agora diz que é a assistente virtual quando perguntada.
