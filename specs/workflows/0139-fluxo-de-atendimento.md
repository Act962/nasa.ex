---
id: 0139
titulo: Fluxo de Atendimento — montar o atendimento do WhatsApp do zero, num lugar só
dominio: workflows
status: aprovada
autor: João Gabriel
criada: 2026-11-12
atualizada: 2026-11-12
branch: claude/fluxo-atendimento-creator-ac11e1
pr:
peso: completa
---

# 0139 — Fluxo de Atendimento

## 1. Contexto

Hoje o atendimento automático do WhatsApp está espalhado em vários lugares:

- **IA de atendimento** (specs 0084, 0089, 0091, 0096, 0100): responde a toda mensagem do cliente.
- **Menus salvos** e saída por opção (0096, 0098).
- **Estado de atendimento** (0113): decide quando a IA entra.
- **Gatilhos Automáticos em modo agente** (0090, 0099): já têm botões que esperam o clique, aceite LGPD e formulário pela conversa, mas estão misturados com automações de funil.

O dono da empresa não consegue ver nem controlar, num lugar só, o caminho que o cliente faz desde
a primeira mensagem. A referência de mercado é o BotConversa. Lá a empresa desenha o fluxo inteiro
em blocos (mensagem, botões, pergunta, condição, ação, atraso, IA) e escolhe como o cliente entra:
mandando mensagem (boas-vindas, palavra-chave, resposta padrão) ou recebendo um disparo para uma
lista de contatos.

O editor (`src/features/editor/`, `@xyflow/react`), as tabelas `Workflow`/`Node`/`Connection`/
`WorkflowRun` e o executor de grafo (`src/features/workflows/lib/run-workflow.ts`, que já pausa com
`step.waitForEvent`) cobrem a maior parte do motor. Falta o produto: a tela, os blocos que faltam,
a regra de quem responde e o controle de "quem está dentro do fluxo agora".

## 2. Objetivo

A empresa monta, numa tela própria, o fluxo de atendimento do WhatsApp do zero. Quando um fluxo
está ativo no número, **ele responde primeiro**. A IA entra **só onde o fluxo coloca o bloco de
IA**: conversa ali e devolve o lead ao fluxo por uma saída. Os outros automáticos só entram quando
o fluxo termina.

### Não-objetivos

- **Tabela nova para fluxo, bloco ou ligação.** Usa `Workflow`, `Node` e `Connection` (D-1).
- **Apagar ou migrar** os menus salvos, o roteiro (0091) e o estado de atendimento (0113) nesta spec.
  Eles continuam funcionando para quem não tem fluxo de atendimento. A migração é a Fase 3 (§6, D-8).
- **Canais fora do WhatsApp** (In-Chat, Instagram, e-mail).
- **Base de conhecimento própria do bloco de IA, ferramentas novas da IA e IA que monta o fluxo.** O bloco de IA usa nesta fase o que a IA do funil já sabe (configuração, fatos e ferramentas de hoje) mais as instruções do bloco. Aprofundar a IA é evolução prevista sobre o mesmo bloco, em spec própria (D-10).
- **Construtor de templates da Meta.** O bloco usa templates já aprovados.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | **Tipo do fluxo**: `Workflow.kind` = `AUTOMATION` (o de hoje, padrão) ou `ATTENDANCE`. As listas e o editor de Gatilhos Automáticos mostram só `AUTOMATION`; a tela nova mostra só `ATTENDANCE`. |
| RF-2 | **Tela "Fluxos de atendimento"** por número (tracking): lista com nome, como o cliente entra, ativo/inativo e quantos leads estão dentro agora. Criar, duplicar, ativar/desativar, apagar. |
| RF-3 | **Editor** reaproveita o canvas atual com paleta própria, em categorias: *Conversa* (Enviar mensagem, Pergunta), *Lógica* (Condição, Randomizador, Atraso, Conectar fluxo), *IA* (Agente de IA), *Atendimento* (Distribuição, Finalizar), *Dados* (Ação: etiqueta, campo, mover coluna/funil, responsável, temperatura) e *Integração* (Webhook). Configuração em painel lateral, como no inspector (0090, seção E). |
| RF-4 | **Bloco Início** com a forma de entrada: **Boas-vindas** (primeira mensagem do contato no número), **Palavra-chave** (mensagem igual a ou contendo uma das palavras, sem acento e sem maiúsculas), **Resposta padrão** (qualquer mensagem que nenhuma outra regra pegou) ou **Disparo** (só entra por disparo, RF-12). |
| RF-5 | **Por número, no máximo um** fluxo ativo de Boas-vindas e um de Resposta padrão. Palavra-chave repetida em dois fluxos ativos do mesmo número é recusada ao salvar, com o nome do outro fluxo. |
| RF-6 | **Prioridade na mensagem do cliente** (WhatsApp), nesta ordem: (1) o lead já está dentro de um fluxo esperando resposta → a mensagem vai para o fluxo; (2) palavra-chave; (3) boas-vindas; (4) resposta padrão; (5) nada pegou → comportamento de hoje (IA, estado de atendimento, gatilhos). De (1) a (4), **a IA não é acionada** por essa mensagem. |
| RF-7 | **Enviar mensagem**: texto com variáveis (`{primeiro-nome}` etc.), imagem, vídeo, áudio, arquivo, botões (até 3) e lista (até 10), com uma saída por botão/item e a saída "sem resposta" (prazo configurável). Vários conteúdos no mesmo bloco, enviados em ordem. Em número **não oficial**, botões seguem a spec 0095. |
| RF-8 | **Janela de 24 h** (só número oficial): "Dentro da janela" envia o conteúdo livre; "Fora da janela" envia um **template aprovado** escolhido no bloco, com as variáveis mapeadas para campos do lead. Fora da janela sem template = o bloco não salva. |
| RF-9 | **Pergunta**: envia a pergunta, espera a resposta, valida o tipo (texto, número, e-mail, telefone, data, CPF/CNPJ) e grava em um campo do lead ou campo personalizado. Saídas: "respondeu", "inválida após N tentativas" e "sem resposta". |
| RF-10 | **Randomizador**: 2 a 5 caminhos com porcentagem (somando 100). **Distribuição**: escolhe o atendente pelo rodízio do funil (`TrackingConsultant`, `src/features/org-defaults/lib/attendance/rodizio.ts`) e o torna responsável; saída "sem atendente disponível". **Finalizar**: encerra o fluxo do lead e, se configurado, move de coluna. |
| RF-16 | **Agente de IA** (bloco): a IA conversa com o cliente **dentro do fluxo**, com as instruções e o objetivo escritos no bloco, por cima da configuração da IA do funil. Enquanto o lead está no bloco, cada mensagem dele é respondida pela IA. O lead sai do bloco por uma saída: **"objetivo cumprido"** (a IA conclui que o objetivo do bloco foi atingido), **"pediu atendente"**, **"limite de mensagens"** (máximo de respostas da IA no bloco, padrão 20), **"sem resposta"** (prazo) e **"erro"** (IA indisponível ou sem saldo). Opcional: **saídas por intenção**, de 2 a 5 com nome e descrição (ex.: "quer comprar", "quer suporte"). A IA escolhe uma e o fluxo segue por ela. |
| RF-17 | O que a IA descobre no bloco pode ser **gravado em campos** do lead, configurados no bloco (ex.: "nome", "cidade", "interesse"). Os campos ficam disponíveis como variáveis nos blocos seguintes. |
| RF-18 | Fora do bloco de IA, a IA do funil **não responde** lead que está dentro de um fluxo de atendimento. |
| RF-11 | **Humano assume**: se alguém da equipe envia mensagem ao lead (pela plataforma ou pelo celular, sem contar o eco do que o fluxo mandou), o fluxo daquele lead é encerrado com o motivo "equipe assumiu". |
| RF-12 | **Disparo para lista** (Fase 2): a partir de uma lista de leads (filtro do funil, coluna ou etiqueta), envia o template do bloco Início e coloca cada lead no fluxo. Usa o Disparo em Massa existente (`Broadcast`: limites diários, lotes e taxa da spec 0040). Quando o lead responde ou clica, o fluxo segue. |
| RF-13 | **Contador por bloco**: o editor mostra, em cada bloco, quantos leads estão parados nele agora. Clicar abre a lista desses leads. |
| RF-14 | **No chat**: a conversa mostra "No fluxo: <nome> · <bloco>" com os botões "Tirar do fluxo" e "Colocar em um fluxo". |
| RF-15 | **Histórico**: cada passagem por bloco fica em `WorkflowNodeRun`, que já existe, e aparece na linha do tempo do lead. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | **Uma ida ao banco** no caminho de toda mensagem para saber se o lead está dentro de um fluxo (busca por chave única, RF-6 passo 1). As regras de entrada do número são lidas só quando o passo 1 não pega. |
| RNF-2 | **Nenhum cron novo.** Espera e retomada usam `step.waitForEvent`/`step.sleep` na mesma execução (`execute-workflow`). |
| RNF-3 | **Escopo de organização** em toda procedure: o fluxo chega na org pelo `tracking`. Id de fluxo, bloco ou lead de outra org devolve "não encontrado". |
| RNF-4 | Envio para Meta/Uazapi e `inngest.send` ficam **fora de transação** (Regra 18). |
| RNF-5 | Empresa **sem nenhum fluxo de atendimento ativo** se comporta exatamente como hoje. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um número sem fluxo de atendimento ativo, quando o cliente manda mensagem, então a IA responde como hoje e nenhuma `WorkflowRun` de atendimento é criada.
- [ ] **CA-2** — Dado um fluxo ativo de Boas-vindas, quando um contato novo manda a primeira mensagem, então o fluxo envia o primeiro bloco e a IA **não** recebe o evento `chat/ai.whatsapp-message-received`.
- [ ] **CA-3** — Dado um lead parado num bloco de botões, quando ele clica em "Financeiro", então o fluxo segue pela saída desse botão e o contador do bloco cai em 1.
- [ ] **CA-4** — Dado um lead parado numa Pergunta de e-mail, quando ele responde "abc", então o fluxo pede de novo; depois de N respostas inválidas, segue pela saída "inválida".
- [ ] **CA-5** — Dado um lead no fluxo, quando um atendente responde pela plataforma, então a execução termina com "equipe assumiu" e a próxima mensagem do cliente segue a ordem do RF-6 a partir do passo 2.
- [ ] **CA-6** — Dadas duas mensagens do mesmo contato novo chegando juntas, então existe **uma** execução de atendimento para o lead.
- [ ] **CA-7** — Dado um bloco Distribuição com 2 atendentes ativos no rodízio, quando 4 leads passam por ele, então cada atendente recebe 2.
- [ ] **CA-8** — Dado um segundo fluxo ativo de Boas-vindas no mesmo número, ao ativar, então a tela recusa e diz qual fluxo já ocupa a entrada.
- [ ] **CA-9** — Dado um usuário da org A, quando ele chama qualquer procedure de fluxo com o id de um fluxo da org B, então recebe "não encontrado".
- [ ] **CA-10** — Dado um bloco "Fora da janela" sem template, ao salvar, então o editor recusa e aponta o bloco.
- [ ] **CA-12** — Dado um lead no bloco Agente de IA com o objetivo "descobrir o bairro", quando o cliente informa o bairro, então a IA grava o campo configurado e o fluxo segue pela saída "objetivo cumprido" para o próximo bloco.
- [ ] **CA-13** — Dado um bloco de IA com as saídas por intenção "comprar" e "suporte", quando o cliente diz que o produto quebrou, então o fluxo segue por "suporte".
- [ ] **CA-14** — Dado um bloco de IA com limite de 3 respostas, quando o cliente manda a 4ª mensagem sem o objetivo cumprido, então o fluxo segue por "limite de mensagens" sem a IA responder de novo.
- [ ] **CA-15** — Dado um lead parado num bloco de botões, quando ele escreve uma pergunta livre, então a IA do funil **não** responde (RF-18).
- [ ] **CA-11** — Dado um lead parado num bloco que foi apagado do fluxo, quando ele responde, então a execução termina com "bloco removido" e a mensagem segue a ordem do RF-6 a partir do passo 2.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Duas mensagens do contato novo ao mesmo tempo | A trava única por lead (D-3) deixa entrar uma execução; a outra mensagem é entregue à execução que ganhou, como resposta. |
| CB-2 | Webhook entregue duas vezes | Já é descartado pela deduplicação de `externalMessageId` do inbound; a retomada usa o id da mensagem como chave do evento. |
| CB-3 | Cliente manda mensagem enquanto o fluxo ainda está enviando (não está esperando) | A mensagem fica no chat e o fluxo não a usa. Não aciona a IA nem outro fluxo. |
| CB-4 | Execução morreu no Inngest e a trava ficou presa | A trava tem validade (`waitingUntil` + margem). Vencida, a mensagem trata a trava como solta, encerra a execução como "expirada" e segue a ordem do RF-6. O lead nunca fica preso sem resposta. |
| CB-5 | Cliente não responde nunca | O prazo da espera (padrão 24 h) leva à saída "sem resposta"; sem nada ligado nela, o fluxo termina e solta a trava. |
| CB-6 | Fluxo desativado ou apagado com leads dentro | Desativar: quem está dentro termina o caminho atual; nenhum lead novo entra. Apagar: as execuções terminam como "fluxo removido" (cascade já existente em `WorkflowRun`). |
| CB-7 | Fluxo editado com lead parado num bloco que mudou | Retoma pelo grafo atual. Bloco apagado → CA-11. Saída do botão apagada → segue por "sem resposta". |
| CB-8 | "Conectar fluxo" para outro fluxo de atendimento | A trava passa para a nova execução no mesmo comando; ciclo A→B→A é limitado pelo teto de 100 blocos por execução, que já existe. |
| CB-9 | Distribuição sem atendente ativo ou todos no limite (`maxFlow`) | Segue pela saída "sem atendente disponível". |
| CB-10 | Lead criado por formulário/importação e cliente escreve depois | Para Boas-vindas, conta como primeira mensagem **no número** (nenhuma mensagem de entrada anterior na conversa), não a criação do lead. |
| CB-11 | Número oficial fora da janela e bloco com conteúdo livre "Dentro da janela" | O envio falha na Meta; o bloco segue pela saída "erro" e a execução registra o código. Não tenta de novo sozinho. |
| CB-12 | Lista do disparo com lead que já está em outro fluxo | Fase 2: o lead é pulado e aparece como "já em fluxo" no relatório do disparo. Não rouba a trava. |
| CB-13 | Org com o estado de atendimento (0113) ligado | O fluxo tem prioridade; o 0113 só age quando a mensagem cai no passo 5 do RF-6 ou depois que o fluxo termina. |
| CB-15 | Cliente manda 3 mensagens seguidas no bloco de IA | A IA espera 3 s depois da última (como a IA de hoje) e responde uma vez só, lendo todas as mensagens desde a última resposta. |
| CB-16 | Mensagem chega enquanto a IA ainda está gerando a resposta | Não dispara segunda resposta. Na próxima volta, a IA lê também essa mensagem. |
| CB-17 | Funil sem IA configurada (sem chave/modelo) ou sem saldo de Stars | O bloco segue por "erro" na hora, sem mandar nada ao cliente. O editor avisa no próprio bloco que a IA do funil não está configurada. |
| CB-18 | A IA nunca conclui o objetivo | O limite de mensagens (RF-16) garante a saída. Não existe bloco de IA sem limite. |
| CB-19 | Atendente responde enquanto o lead está no bloco de IA | Vale o RF-11: o fluxo termina com "equipe assumiu". |
| CB-14 | Lead pausado (`isActive = false`, IA pausada) | O fluxo responde mesmo assim: a pausa é da IA, não do fluxo. "Tirar do fluxo" no chat é o controle do fluxo. |

## 6. Decisões de design

### D-1 — Reusar `Workflow`/`Node`/`Connection` com `Workflow.kind`

- **Escolha**: enum `WorkflowKind { AUTOMATION ATTENDANCE }` em `Workflow.kind`, padrão `AUTOMATION`. Fluxo de atendimento sempre roda pelo executor de grafo (o do modo agente).
- **Descartadas**: tabelas próprias (`AttendanceFlow`, `AttendanceNode`) duplicariam editor, executor, histórico e simulador. Usar só `agentMode = true` não separa as telas e mistura as automações de funil já criadas em modo agente.
- **Consequência**: toda consulta de Gatilhos Automáticos passa a filtrar `kind = AUTOMATION`. Esquecer o filtro mostra fluxo de atendimento na tela errada ou o faz ser disparado por gatilho de funil.

### D-2 — Prioridade decidida no inbound, antes da IA

- **Escolha**: no `firePostInboundAutomations` (`src/features/tracking-chat/lib/incoming-message-pipeline.ts`), antes do passo "4. Inngest IA", um roteador do fluxo de atendimento aplica o RF-6. Se ele pegar a mensagem, o envio para a IA é pulado.
- **Descartadas**: deixar a IA decidir se passa para o fluxo (custa uma execução da IA por mensagem e cria corrida entre os dois).
- **Consequência**: um único ponto decide quem responde. O estado de atendimento (0113) roda antes, como hoje, e continua gravando os horários; só não aciona a IA quando o fluxo pegou a mensagem.

### D-3 — Trava "lead dentro do fluxo" na própria `WorkflowRun`

- **Escolha**: três colunas novas em `WorkflowRun`:
  - `attendanceLeadId` (único e nulo): preenchido enquanto a execução de atendimento está viva, limpo ao terminar. A unicidade garante uma execução por lead (CB-1).
  - `currentNodeId`: bloco em que o lead está parado, para o contador (RF-13).
  - `waitingUntil`: validade da trava (CB-4).

  Status novo `WAITING` no texto de `status`.
- **Descartadas**:
  - Tabela `AttendanceSession`: é a mesma informação da execução, com outro nome (S4).
  - Coluna no `Lead`: espalha estado de fluxo pelo lead e não guarda qual execução está viva.
- **Consequência**: a checagem do RF-6 passo 1 é uma busca pela chave única (RNF-1). Índice `[workflowId, currentNodeId]` para o contador.

### D-4 — Regras de entrada no `data` do bloco Início

- **Escolha**: novo `NodeType.ATTENDANCE_START`; forma de entrada e palavras-chave em `Node.data`. O roteador carrega os blocos Início dos fluxos ativos do número (poucos por número) e compara em memória.
- **Descartadas**: colunas tipadas para palavra-chave. As palavras são configuração livre do usuário, lida inteira e comparada no app, sem filtro nem soma no banco. Por isso o `Json` é aceitável aqui (S3).
- **Consequência**: a unicidade de Boas-vindas/Resposta padrão/palavra-chave (RF-5) é conferida na procedure de ativar e salvar, não no banco.

### D-5 — Blocos novos só onde falta

- **Escolha**: novos `NodeType`: `ATTENDANCE_START`, `ASK_QUESTION`, `RANDOMIZER`, `DISTRIBUTE`, `AI_AGENT` e `FINISH_ATTENDANCE`. Os demais reaproveitam os existentes: `SEND_MESSAGE` com saídas por botão (0090 F), `IF_CONDITION`, `WAIT`, `TAG`, `MOVE_LEAD`, `RESPONSIBLE`, `TEMPERATURE`, `HTTP_REQUEST` e `CALL_WORKFLOW`. O bloco "Ação" do editor é um agrupador visual de `TAG`/`MOVE_LEAD`/`RESPONSIBLE`/`TEMPERATURE`/campo.
- **Descartadas**: reescrever "Enviar mensagem". O atual já tem botões, lista, mídia, aceite e formulário pela conversa.
- **Consequência**: os flags `NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE` e `NEXT_PUBLIC_WORKFLOW_FORM_CHAT` passam a valer **sempre** em fluxo de atendimento. Fora dele continuam como estão até a remoção prevista em cada spec.

### D-6 — Disparo pelo `Broadcast` que já existe

- **Escolha**: Fase 2 adiciona `Broadcast.workflowId` (nulo). O disparo usa todo o pipeline da 0040 (lote diário, taxa, status por destinatário). Cada destinatário enviado entra no fluxo no bloco seguinte ao Início, já com a trava.
- **Descartadas**: um envio em massa próprio do fluxo duplicaria os limites da Meta, a cobrança e o webhook de status.

### D-7 — Humano assume encerra o fluxo

- **Escolha**: mensagem da equipe encerra a execução (RF-11).
- **Descartadas**: pausar o robô por X minutos, como o "AutoOff" do BotConversa. Criaria um segundo relógio a manter. Pode entrar depois, como opção do Início, se pedirem.

### D-8 — Centralização em fases

- **Fase 1**: RF-1 a RF-11, RF-13 a RF-15. Entrada por mensagem.
- **Fase 2**: RF-8 (template fora da janela) e RF-12 (disparo).
- **Fase 3**: converter os menus salvos e o roteiro (0091/0096/0098) em fluxos de atendimento. Depois, apagar os caminhos antigos e as colunas que só eles usam (S9), em spec própria.

### D-10 — Bloco de IA dentro do fluxo, com o motor da IA de hoje

- **Escolha**: o `AI_AGENT` chama o mesmo núcleo da IA do funil (`runWhatsappAgent`, em `src/features/tracking-chat-ai/lib/agent.ts`). Ele recebe como extras as instruções e o objetivo do bloco, os campos a gravar e as saídas possíveis. A IA sinaliza a saída por uma ferramenta (`finish_step` com o id da saída), nunca por texto livre.
  - Cada volta acontece **dentro da mesma execução** do fluxo: espera a mensagem (`waitForEvent`), aguarda 3 s, responde e volta a esperar.
  - Cobrança de Stars e chave da IA seguem as da IA do funil.
- **Descartadas**:
  - Passar a conversa para a IA do funil e encerrar o fluxo: perde o controle de onde a IA sai, que é o objetivo do bloco.
  - Um segundo motor de IA só para fluxos: duplicaria prompt, ferramentas, cobrança e correções (`astro-corrections`).
- **Consequência**: o núcleo `runWhatsappAgent` precisa aceitar "modo bloco" (instruções extras, ferramenta de saída, sem enviar evento próprio). As melhorias futuras da IA (base de conhecimento, ferramentas novas) valem nos dois lugares. O bloco é o ponto de evolução previsto da IA no fluxo.

### D-13 — Esperar resposta é estado; esperar tempo é agendamento

- **Escolha**: a execução parada guarda o que espera em `WorkflowRun.waitingFor` (`INPUT` ou `TIME`).
  - **INPUT** (botões, Pergunta, Agente de IA): antes de parar, o motor lê a caixa de entrada da execução — as mensagens que o roteador marcou com `Message.metadata.attendanceRunId` enquanto o lead estava no fluxo (fora do bloco Atraso, quando a mensagem não responde nada). A primeira marcada é usada e sai da caixa; sem nenhuma, espera o evento `agent-workflow/message-incoming` do lead, que também sai da caixa. A marca não depende do horário da mensagem, que vem do celular em segundos.
  - **TIME** (Atraso): `step.sleep`, nunca espera de evento.
- **Prazo**: padrão "sem prazo". Com prazo, o bloco ganha a saída "Sem resposta". Sem prazo, vale o teto técnico de 30 dias (duração máxima de execução no plano Free do Inngest); vencido, o fluxo do lead termina sem enviar nada. "Próximo passo" do menu é só para texto digitado em vez de clique.
- **Idempotência**: o evento da mensagem usa `message-incoming:<id da mensagem>` como id; o Inngest descarta repetição.
- **Por quê**: a espera do Inngest só enxerga eventos enviados depois que ela começa (documentação de `step.waitForEvent`). Sem a caixa de entrada, a resposta enviada enquanto o fluxo ainda mandava mensagens se perdia.
- **Janela entre a caixa e a espera**: uma mensagem que chega no instante entre ler a caixa e começar a espera não é vista pelo evento, mas fica marcada na caixa. Por isso a primeira espera dura 1 minuto; ao vencer, a caixa é lida de novo antes da espera longa. Quando o evento acorda, a resposta usada é a mais antiga da caixa (o evento só avisa), e as outras ficam para as próximas perguntas, na ordem. Custo: até dois passos a mais no Inngest por espera longa.
- **Risco residual**: a mesma janela, de milissegundos, existe de novo no fim do primeiro minuto; a mensagem perdida nela fica na caixa até a próxima mensagem do cliente.

### D-14 — Assistente próprio no bloco Agente de IA (fase 1 da troca do "Fluxo de atendimento" do funil)

- **Escolha**: o bloco guarda o próprio assistente em `data.assistant` (`assistantName`, `prompt`, `capabilities`). O painel ganha as abas **Etapa**, **Assistente** e **Pode fazer**. "Importar do funil" **copia** a IA de um funil para o bloco (`attendanceFlow.importFunnelAi`); depois disso o bloco vale sozinho, igual em todos os números.
  - Bloco sem `assistant` usa a IA do funil do número, como antes (fluxos que já existem não mudam).
  - Com `assistant`: nome e prompt do bloco no lugar dos do funil; os menus da aba "Botões" do funil não entram (no fluxo, botão é bloco de mensagem); o bloco roda mesmo em número sem IA configurada.
  - O bloco decide agenda, lembrete, formulários, fichas, links, documentos, PIX, pedido para a equipe, "uma mensagem só" e base de conhecimento (`BLOCK_CAPABILITY_KEYS`). Áudio, chamada de voz, menu guiado e estado de atendimento valem para o número e seguem vindo do funil.
  - Modelo e chave continuam os do funil do número (fase seguinte: modelo da empresa).
- **Segurança**: ao salvar o desenho, `workflow.update.updateNodes` passa as capacidades de cada bloco pela mesma conferência da aba do funil (`sanitizeAiCapabilities`): id de agenda, formulário, Workspace ou documento de outra empresa é descartado, e quem salvou assina demandas e lembretes.
- **Alternativa descartada**: o bloco ler a configuração do funil ao vivo, só com ajustes por cima. Um fluxo da empresa responderia diferente em cada número e a tela do funil nunca poderia sair.
- **Quem assina**: só passa a ser quem salvou quando as capacidades do bloco mudam. Mover ou editar outro bloco mantém quem configurou (`configuredByUserId`) e não refaz a conferência.

### D-9 — Sem flag de tela

- **Escolha**: o FlowAstro aparece na lista de Apps. Não há flag: fluxo novo nasce desligado e sem número, e o roteador do RF-6 só age com fluxo ligado (RNF-5).
- **Alternativa descartada**: `NEXT_PUBLIC_ATTENDANCE_FLOWS` (primeira versão), que só escondia uma aba do funil que deixou de existir.

### D-11 — FlowAstro: fluxo da empresa, ligado a vários números

- **Escolha**: app próprio (`/flowastro`), fora do funil. O fluxo de atendimento pertence à empresa (`Workflow.organizationId`) e responde nos números escolhidos (`WorkflowTrackingLink`, um por par fluxo–número). A regra `workflows_owner_xor` passa a aceitar exatamente um dono: funil, workspace ou empresa.
- **Alternativas descartadas**: lista de ids de funil dentro do fluxo (sem chave estrangeira: funil apagado deixaria id solto); fluxo preso a um funil (primeira versão), que obrigava a copiar o fluxo para cada número.
- **Consequência**: cada número tem as próprias colunas. "Mover coluna" e "Finalizar" guardam a coluna por número (`columns: { trackingId: statusId }`) e não movem o lead em número sem coluna escolhida. A disputa de entrada (RF-5) é conferida em cada número ligado.

### D-12 — Editor próprio do FlowAstro

- **Escolha**: editor separado do editor dos Gatilhos, no estilo do BotConversa: canvas claro, cartões com o conteúdo à mostra, uma saída por linha, painel de edição à esquerda, botão "+" e salvamento sozinho. O desenho é salvo pela mesma procedure (`workflow.update.updateNodes`) e roda no mesmo motor.
- **Alternativa descartada**: paleta própria dentro do editor dos Gatilhos (primeira versão). Carregava área de etapa, painel de problemas e visual pesado que não servem para conversa.
- **Condição** (no estilo do BotConversa): "Contato corresponde a TODAS / a QUALQUER condição", com regras de etiqueta, dia da semana, hora, responsável, temperatura, coluna, campos do lead e variáveis do fluxo. Usa o `IF_CONDITION` que já existe, com saídas `true`/`false`; o formato com `rules` é avaliado lendo o lead do banco na hora (etiqueta e responsável mudam durante a conversa). Dia e hora no fuso de São Paulo. Regra sem valor conta como falsa.
- **Fora desta entrega**: "Horário de atendimento" na Condição (a empresa ainda não tem horário cadastrado no sistema) e o bloco "Webhook" no editor novo.

## 7. Impacto

- [x] **Schema / migration**:
  - enum `WorkflowKind` e `Workflow.kind`, com índice `[trackingId, kind, isActive]`
  - `WorkflowRun.attendanceLeadId` (único), `currentNodeId` e `waitingUntil`, com índice `[workflowId, currentNodeId]`
  - 6 valores novos em `NodeType`
  - Fase 2: `Broadcast.workflowId`

  Todas aditivas, com padrão: registros antigos viram `AUTOMATION` sem backfill.
- [x] **Procedures oRPC**: `attendanceFlow.list/create/duplicate/activate/deactivate/delete`, `attendanceFlow.leadsInNode`, `attendanceFlow.removeLead`, `attendanceFlow.startForLead`. As listas de Gatilhos passam a filtrar `kind`.
- [x] **Automações (Inngest)**: nenhuma função ou cron novo (RNF-2). Usa `execute-workflow` e um evento de retomada `workflow/attendance.reply` (consumido por `waitForEvent`, sem função própria).
- [x] **Env vars novas**: `NEXT_PUBLIC_ATTENDANCE_FLOWS` (D-9). Precisa ir no secret `NEXT_PUBLIC_ENV` (regra 24b).
- [ ] **Breaking change**: não, para quem não ativa fluxo (RNF-5).
- [x] **Documentação obrigatória**:
  - `docs/whatsapp-oficial-overview.md`: template fora da janela, Fase 2
  - guia do Astro (regra 21): âncoras da tela nova e do editor

### Custo no Inngest (S11)

Cada conversa que entra num fluxo é **uma execução** de `execute-workflow`. Os passos crescem com o
número de blocos percorridos (envio, espera e retomada contam).

Estimativa: **execuções por dia ≈ conversas novas por dia nos números com fluxo**, e **passos ≈
execuções × 8 a 15**. Exemplo: 500 conversas/dia ≈ 500 execuções e ~5.000 a 7.500 passos/dia;
com 10x, ~75 mil passos/dia.

No bloco de IA, cada mensagem do cliente soma uns 3 passos à mesma execução (esperar, aguardar 3 s,
responder), sem abrir execução nova. Por outro lado, cada mensagem que o fluxo pega **deixa de acionar** a IA (`chat/ai.whatsapp-message-received`),
que hoje é uma execução por mensagem. Em conversa de menu, o saldo tende a ser neutro ou de economia.
**Antes de implementar**, levantar o número real de conversas novas por dia dos maiores clientes,
para confirmar o plano.

## 8. Plano de testes

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-5, CA-11 | automatizado (roteador) | Testar a função do RF-6 com lead sem trava, com trava, com trava vencida e com bloco removido. Conferir se o evento da IA foi ou não enviado. |
| CA-3, CA-4 | manual (número oficial de teste) | Fluxo de botões e pergunta de e-mail no WhatsApp real; contador no editor. |
| CA-6 | automatizado | Duas chamadas simultâneas ao roteador para o mesmo lead → uma `WorkflowRun` com `attendanceLeadId`. |
| CA-7 | automatizado | Bloco Distribuição com 2 atendentes, 4 leads. |
| CA-8, CA-10 | automatizado (procedure) | Ativar segundo fluxo de Boas-vindas; salvar bloco "Fora da janela" sem template. |
| CA-12, CA-13, CA-14 | manual (número de teste) + script | Conversas roteirizadas no bloco de IA; conferir a saída escolhida e o campo gravado em `WorkflowNodeRun.chosenOutput`. |
| CA-15 | automatizado (roteador) | Lead com trava num bloco que não é de IA → evento da IA não enviado. |
| CA-9 | automatizado (procedure) | Cada procedure chamada com ids de outra org. |

Obs.: a Regra 20 registra que ainda não há runner de teste instalado. Os testes "automatizados" acima
viram script em `scripts/` (como `accounting-qa-check.ts`) até o runner existir.

## 9. Riscos e rollback

- **Lead preso sem resposta** se a trava não for solta: mitigado pela validade (CB-4) e pelo "Tirar do fluxo" no chat.
  Rollback imediato: desativar os fluxos do número. O roteador volta ao passo 5 em toda mensagem.
- **Fluxo e IA respondendo juntos** se algum caminho de inbound não passar pelo roteador (ex.: In-Chat). Por isso o escopo é só WhatsApp.
- **Gatilhos de funil disparando fluxo de atendimento** se faltar o filtro `kind` em alguma consulta. Na implementação, rodar `grep` em todo `prisma.workflow.findMany`/`nodes: { some` e listar os pontos no PR.
- **Custo do Inngest** acima do previsto: ver §7. Medir na primeira semana.
- **Migration**: só adiciona colunas com padrão e valores de enum. É reversível apagando as colunas. Valores de enum no Postgres não saem fácil, mas sem uso não fazem mal.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-12 | João Gabriel | Criada |
| 2026-11-12 | João Gabriel | Bloco "Agente de IA" passa a conversar dentro do fluxo e devolver o lead por saídas (RF-16 a RF-18, D-10), em vez de assumir e encerrar o fluxo. |
| 2026-11-12 | João Gabriel | Espera revista (D-13): caixa de entrada antes de parar, sem prazo por padrão, Atraso com `step.sleep`, evento com id. Botões com uma saída por opção passam a valer sempre no FlowAstro, sem o flag da 0090 (contexto `flowKind`). Mensagem e botões viram um bloco só. |
| 2026-11-12 | João Gabriel | Aprovada. FlowAstro: app próprio, fluxo da empresa ligado a vários números (D-11), editor próprio (D-12), sem flag de tela (D-9). Trava fica no status `SUSPENDED` já existente, não num `WAITING` novo. Botões com saída por opção seguem dependendo de `NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE` (dívida: ver §9). |
| 2026-11-12 | João Gabriel | Revisão de código: caixa de entrada por marca na mensagem (não mais cursor por horário) e ignorada durante o Atraso; desligar o fluxo ou a execução falhar solta a trava do lead; palavra-chave ignora pontuação; edição e reentrega do webhook não abrem fluxo. |
| 2026-11-12 | João Gabriel | Assistente próprio no bloco Agente de IA (D-14): abas Etapa, Assistente e Pode fazer; importar a IA de um funil copia nome, prompt e capacidades para o bloco. |
| 2026-11-12 | João Gabriel | Variáveis: Pergunta e Agente de IA (instruções, objetivo e prompt) trocam as mesmas variáveis do Enviar mensagem; a IA recebe o que o fluxo já coletou, marcado como dado do cliente. Seletor de variáveis (contato e fluxo) nos textos do editor. |
| 2026-11-12 | João Gabriel | Campanha do STAR FRIENDS no FlowAstro vira blocos de encaixe (Inscrever, Registrar cupom, Consultar): ver [spec 0140](0140-blocos-promocao-star-friends.md). |
| 2026-11-13 | João Gabriel | Revisão de código: espera relê a caixa depois de 1 minuto e usa sempre a resposta mais antiga (D-13); lead esperando num bloco apagado sai do fluxo ao salvar; salvar não troca quem assina a IA do bloco (D-14); bloco Início em conflito volta ao que era e o resto do desenho é salvo (RF-5); desligar o fluxo encerra os leads em lote; lista com teto de 500 fluxos. |
| 2026-11-13 | João Gabriel | Bloco Enviar mensagem ganha a aba Áudio: ver [spec 0141](0141-audio-no-enviar-mensagem.md). |
| 2026-11-13 | João Gabriel | Fluxos criados e editados pela IA da pessoa, pelo MCP do ÓRBITA: ver [spec 0142](0142-flowastro-pelo-mcp.md). O salvamento do desenho virou `saveWorkflowGraph`. |
