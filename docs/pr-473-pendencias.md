# Pendências da PR 473

Revisão de 20 e 21/10/2026 da PR [Act962/nasa.ex#473](https://github.com/Act962/nasa.ex/pull/473): estado de atendimento, Editar gatilho, origem real do lead e Modo Agente igual ao normal (specs 0112, 0113 e 0114).

As correções marcadas com ✅ entraram na própria PR em 21/10/2026. Foram conferidas pela leitura do código, pelo typecheck completo (0 erros) e pelo `pnpm guides:check`. **Nenhuma foi exercitada em tela nem em WhatsApp real.** Ao tratar um item, marque o status. Não apague o item.

| # | Item | Status |
| --- | --- | --- |
| 1 | Botão de pausa da IA por lead desligado; a IA se cala sozinha | ✅ revisão 9.1 da spec 0113; `isActive` antigo em aberto |
| 2 | IA fala por cima do atendente e depois de "quero falar com humano" | ✅ a IA se cala por resposta humana recente |
| 3 | "Quem responde primeiro: Equipe" não faz efeito com a pausa desligada | ✅ volta a funcionar (pausa calculada) |
| 4 | Corrida entre resposta do atendente e entrada da IA | 🚧 IA barrada; mensagem fixa ainda pode sair |
| 5 | Eco da própria mensagem contando como fala do atendente | ⬜ precisa de teste com WhatsApp |
| 6 | Requisição HTTP: redirecionamento para endereço interno | 🚧 endereço inicial barrado; redirecionamento em aberto |
| 7 | Mudanças que valem para todas as empresas sem interruptor | ⬜ avisar suporte e clientes |
| 8 | `isActive` mudou de sentido em ~15 filtros (contagens) | ⬜ validar números |
| 9 | Custo do webhook de entrada e do Inngest | 🚧 webhook com 1 ida ao banco por mensagem; medir em produção |
| 10 | Estado e Score em campo Json da Jornada | ⬜ dívida assumida pela spec |
| 11 | Origem do lead: corrida e spam de cliques | ⬜ |
| 12 | Número oficial antigo continua DISCONNECTED | ⬜ |
| 13 | Variáveis preenchidas duas vezes nas mensagens | ⬜ |
| 14 | Correções já feitas | ✅ |

## 1. Botão de pausa da IA por lead desligado; a IA se cala sozinha

O botão por lead saiu do card, do chat e do "Personalizar board". A IA liga e desliga para o funil inteiro (Configurações → Chatbot IA) e **se cala sozinha** enquanto um atendente conversa: depois de uma resposta humana, fica calada pelo prazo do funil (`inServiceAiMinutes`, padrão 10 min). Se o cliente escreve e o atendente não responde nesse prazo, a checagem `human_absent` traz a IA de volta. Vale para todas as empresas. Desenho e implementação na revisão 9.1 da [spec 0113](../specs/tracking-chat/0113-estado-de-atendimento.md).

O interruptor `IS_LEAD_AI_PAUSE_ENABLED` (`tracking-chat-ai/lib/lead-ai-pause.ts`) continua `false`: a IA ignora `Lead.isActive` e nada grava a pausa manual.

**Em aberto:**
- Decidir se o botão manual volta. Se não voltar, apagar o interruptor, o `CheckIaLead`, os caminhos `IS_LEAD_AI_PAUSE_ENABLED ? ... : ...` e decidir o que fazer com a coluna `Lead.isActive` (ainda lida por relatórios e filtros, ver item 8).
- Leads que já estavam com `isActive = false` antes do deploy continuam assim no banco. Hoje isso não muda nada; se o botão voltar, eles voltam pausados de uma vez.
- O prompt (`system-prompt.ts`) ainda diz que `transfer_to_human` "pausa você nessa conversa". Agora quem segura a IA é a espera do consultor (empresas no estado de atendimento) ou a resposta humana; fora do estado de atendimento, depois de "quero falar com humano" a IA continua respondendo até um humano falar.

## 2. IA fala por cima do atendente

✅ Resolvido pela regra do item 1: resposta humana recente cala a IA nessa conversa.

## 3. "Quem responde primeiro: Equipe" sem efeito

✅ Volta a funcionar. A espera da equipe não depende mais de pausa guardada: o gatilho da IA calcula na hora se a seção a segura (`isAiHeldBySection`, em `attendance/ai-hold.ts`).

## 4. Corrida entre atendente e IA

`attendance-check.ts` confere e trava a seção num passo e age em outros sem conferir de novo `lastHumanAt`.

**Feito:** a IA chamada por uma checagem (`attendance-*`) confere a resposta humana recente ao começar e não entra se o atendente acabou de responder.

**Em aberto:** a mensagem fixa ("já vamos te atender") ainda pode sair se o atendente responder entre a trava e o envio, uma janela de segundos. Conferir `Lead.lastHumanReplyAt` dentro de `sendCheckFixedMessage` antes de enviar.

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

**Feito (revisão 9.1 da spec 0113):**
- Mensagem recebida custa **uma ida ao banco** para o estado: o mesmo `UPDATE` que grava `lastInboundAt` abre a espera (`awaitingSince`) e diz se é a primeira mensagem dela. Antes da revisão eram cerca de 11.
- A seção da Jornada só é lida e gravada na primeira mensagem de cada espera (ou numa reclamação), numa transação com uma gravação só.
- A etiqueta do estado só é mexida quando o `statusFlow` muda.
- "O atendente sumiu" usa a função `org-defaults-attendance-check` que já existia: no máximo um evento por espera, só quando o cliente escreve com a IA calada por resposta humana recente.

**Em aberto:**
- Lead novo de WhatsApp, em qualquer empresa: mais consultas para descobrir a origem (`resolve-whatsapp-origin.ts`).
- As esperas de até 15 dias do Modo Agente agora funcionam e ficam abertas no Inngest; conferir o limite de espera do plano.
- O passo `check-lead-ai` soma 1 step em toda execução da IA, de todas as empresas, e agora lê o lead com a configuração da IA (uma consulta).
- Ligar `ATTENDANCE_STATE_ORGS` primeiro só para as empresas de teste e acompanhar execuções e tempo do webhook.

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
