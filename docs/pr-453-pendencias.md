# Pendências da PR 453

Revisão de 12/10/2026 da PR [Act962/nasa.ex#453](https://github.com/Act962/nasa.ex/pull/453) (fichas, permissões, voz e atendimento ao cliente no WhatsApp). As linhas citadas na descrição de cada item são do commit `4ed930c7`, anterior às correções.

As correções marcadas com ✅ entraram na própria PR 453, em 12/10/2026. Foram conferidas só pela leitura do código e pelo build do CI: nenhuma foi exercitada em tela nem em WhatsApp real. Ao corrigir um item, marque o status. Não apague o item.

| # | Item | Status |
| --- | --- | --- |
| 1 | Campanha bloqueada sem Stars | 🚧 aviso e consistência feitos; decisão de negócio em aberto |
| 2 | Chave PIX sem checagem de papel | ✅ |
| 3 | Agendamento pela IA sem validar disponibilidade | 🚧 horário validado; corrida entre dois pedidos em aberto |
| 4 | Registro de executores do Astro frágil | 🚧 não derruba mais o processo; ciclo de imports em aberto |
| 5 | Chamadas de voz antes de ligar em produção | 🚧 lead só depois da opção conferida; resto em aberto |
| 6 | Ferramenta nova do Astro some sem aviso | ✅ script de conferência |
| 7 | Áudio longo transcrito e cobrado antes do descarte | ✅ para nota de voz OGG/Opus |
| 8 | Aba nova sobrescreve `isAudioEnabled` | ✅ |
| 9 | Itens menores | 🚧 |

## 1. Campanha bloqueada sem Stars

`hasStarsCredit` (`src/features/stars/lib/stars-credit.ts:10`) exige saldo maior que zero e empresa não suspensa. É usada em `campanhas/send.ts`, `campanhas/schedule.ts` e no agendador.

**Feito:**
- O caminho principal do agendamento (`watch-scheduled-broadcast.ts`) disparava na hora marcada sem conferir o crédito; só a rede de segurança (`dispatch-due-broadcasts.ts`) conferia. Agora os dois conferem, como a spec 0087 descreve.
- Quem agendou recebe um aviso no sino quando a campanha fica parada por falta de crédito, no máximo um por dia por campanha (`src/features/campanhas/server/lib/notify-broadcast-deferred.ts`).

**Em aberto:**
- A checagem não considera isenção nem período de carência. Empresa que hoje dispara com saldo zero para de disparar no deploy. Levantar em produção quais empresas estão nessa situação e decidir se a regra vale para elas.
- Depois da recarga, a campanha parada sai pela rede de segurança, que roda de 15 em 15 minutos.
- Definir o que acontece com a campanha que fica dias sem crédito (cancelar, manter, avisar de novo).

## 2. Chave PIX sem checagem de papel ✅

`saveRecordPixSettings` (`src/app/router/form-records/pix.ts`) só exigia login e empresa ativa: qualquer membro trocava a chave PIX da empresa, que é a mesma das Propostas (`ForgeSettings.paymentGatewayConfigs.PIX`). O `src/app/router/forge/settings.ts` tinha a mesma fraqueza.

**Feito:**
- Gravar a chave pelas fichas exige dono ou administrador (`src/features/permissions/server/is-org-admin.ts`) e fica no log de atividades, com os quatro últimos caracteres da chave.
- Em `forge/settings.ts`, quem não é dono nem administrador continua gravando as demais configurações, mas recebe recusa se o bloco `paymentGatewayConfigs` vier diferente do que está salvo. A tela reenvia o bloco inteiro a cada gravação, por isso a comparação.

**Em aberto:** a leitura da chave (`getRecordPixSettings`, `getForgeSettings`) segue aberta a qualquer membro. A tela de fichas mostra o botão "Chave PIX" a todos; o membro só descobre a recusa ao salvar.

## 3. Agendamento pela IA sem validar disponibilidade

`book_appointment` e `reschedule_my_appointment` (`src/features/tracking-chat-ai/server/tools/agenda.ts`) só conferiam conflito com outro agendamento.

**Feito:** as duas ferramentas recusam horário que não esteja entre os livres de `listAgendaFreeSlots` para a data (dias e faixas de atendimento, data bloqueada), e orientam o modelo a consultar os horários de novo.

**Em aberto:** a conferência e a gravação não são atômicas. Dois pedidos simultâneos para o mesmo horário ainda podem marcar os dois.

## 4. Registro de executores do Astro frágil

`src/features/astro/actions/confirmation.ts` contorna um import circular (registro de ações ↔ confirmação) com `queueMicrotask` e novas tentativas por `setTimeout`.

**Feito:** depois de cinco tentativas, a falha vira log de erro. Antes era uma exceção lançada dentro do timer, fora de qualquer requisição.

**Em aberto:** desfazer o ciclo (registro explícito na inicialização do Astro, ou mover o registro para um módulo sem dependência de volta).

## 5. Chamadas de voz antes de ligar em produção

Desligadas sem `ASTRO_WHATSAPP_CALLS=true` e `ASTRO_WHATSAPP_CALLS_TRACKING_IDS`.

**Feito:** a opção de chamada do funil é conferida antes de criar o lead (`voice-call/client-call.ts`). Chamada recusada por opção desligada não deixa mais um lead novo.

**Em aberto, antes de ligar:**
- O estado da chamada vive na memória do processo (`voice-call/call-session.ts`): deploy ou reinício derruba as chamadas em andamento, e o evento de término só encerra a chamada se cair na mesma instância.
- A ponte de áudio (`werift`) precisa de saída UDP no servidor, não testada em produção.
- O webhook oficial espera o atendimento da chamada antes de responder à Meta.

## 6. Ferramenta nova do Astro some sem aviso ✅

`filterToolsByPermission` (`src/features/astro/server/tool-permissions.ts`) nega por padrão: ferramenta sem regra declarada não é entregue à IA, nem para o dono, e o único sinal era um `console.warn`.

**Feito:** `scripts/astro-tool-permissions-check.ts` lê o código e falha quando uma ferramenta não tem regra. Rodado em 12/10/2026: 129 ferramentas, todas com regra; com uma regra removida de propósito, acusou a ferramenta.

```bash
node --experimental-strip-types scripts/astro-tool-permissions-check.ts
```

**Em aberto:** o script não roda no CI nem tem atalho no `package.json`. Confirmar com o time o efeito no papel `member` padrão, que deixa de editar e mover lead pela IA.

## 7. Áudio longo transcrito e cobrado antes do descarte ✅

Em `src/features/tracking-chat-ai/lib/audio-transcription.ts` a duração só era conhecida depois da transcrição: áudio acima de 3 minutos era transcrito, cobrado em Stars e descartado.

**Feito:** a duração da nota de voz é lida do próprio arquivo (`ogg-duration.ts`) e o áudio longo é marcado como "longo demais" sem transcrever nem cobrar. Conferido com arquivos montados à mão, não com áudio real do WhatsApp.

**Em aberto:** áudio em outro formato (MP3, M4A) segue o caminho antigo.

## 8. Aba nova sobrescreve `isAudioEnabled` ✅

`updateAiCapabilities` gravava `isAudioEnabled` com o valor de "responder em nota de voz". Nenhum código lê esse campo; a gravação foi retirada e o valor antigo fica como está.

## 9. Itens menores

- ✅ Variáveis `ASTRO_WHATSAPP_CALLS*` documentadas no `CLAUDE.md`.
- ✅ `ctx as never` em `src/features/form-records/server/record-notices.ts` trocado pelo tipo `AgentContext`.
- ⬜ Imports acima de `import "server-only"` em `tracking-chat-ai/lib/agent.ts` e `persist-canonical-inbound.ts`. Não mexido para não gerar conflito com a PR 454, que altera os mesmos arquivos.
- ⬜ O limite de 60 respostas por cliente por hora vale para todos os funis com Chatbot IA; avaliar se deve ser configurável.
- ⬜ Registrar no changelog da spec 0084 a validação de horário (item 3) e o áudio longo (item 7). Ficou de fora porque a PR 454 acrescenta uma linha no mesmo ponto do arquivo.

## Depois do deploy da PR 453

- Rodar `pnpm tsx --conditions=react-server prisma/seed-astro-action-prices.ts`. Sem ele, áudio, chamada e leitura de site saem sem cobrar Stars.
- Inngest: Resync do app (funções novas `send-record-notices` e `campanhas-snapshot-meta-daily-spend`; `campanhas-watch-scheduled-broadcast` mudou).
