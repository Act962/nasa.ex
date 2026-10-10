---
id: 0087
titulo: Chamada de voz do Astro, Etapa 2 — cliente liga, transcrição no chat, opções faladas e configuração por tela
dominio: astro-bot
status: parcial
autor: Weydson
criada: 2026-10-10
atualizada: 2026-10-10
branch: feature/W-form-fichas-proxima-data-20261009
pr: Act962/nasa.ex#453
peso: completa
---

# 0087 — Chamada de voz do Astro, Etapa 2

## 1. Contexto

A prova de conceito (spec 0086) mostrou que a chamada funciona: o Weydson ligou para o número de teste, o Astro atendeu em cerca de 3 segundos, respondeu rápido e sustentou uma conversa de mais de 2 minutos. O áudio passa por um retransmissor no servidor (`astro-bot/lib/voice-call/media-relay.ts`).

O que a prova deixou de fora ou mostrou de fraco:

- **Só a equipe é atendida.** Cliente que liga é recusado.
- **Não fica registro da conversa.** Só a lista dos pedidos feitos, em `WhatsappBotCommand`. Não dá para auditar o que foi dito.
- **Roteiros com escolha viram troca de mensagens.** Ao pedir um agendamento por voz, cada pergunta ("em qual agenda?") foi por mensagem com botões, e a pessoa teve de olhar a tela no meio da ligação.
- **Liga e desliga por variável de ambiente**, sem tela.
- **A empresa não liga para ninguém.**

O que já existe e será reaproveitado:

- O chat do atendimento já tem **registro de chamada** como mensagem (`mediaType: "voice_call"`, componente `tracking-chat/components/call-message-box.tsx`, com situação e duração), criado hoje pelas chamadas de vídeo com o lead.
- `Message.metadata` (JSON) já guarda a transcrição dos áudios (spec 0084).
- O agente do cliente e suas ferramentas presas ao lead (spec 0084): agenda, formulário, fichas, PIX, pedido à equipe, transferência para atendente.
- A aba "O que o Astro pode fazer" e o campo `AiSettings.capabilities`.
- Os lembretes (`Reminder`) e o envio por template.

## 2. Objetivo

A chamada de voz vira recurso de produto: o cliente liga e resolve o que é dele falando; a equipe conversa sem precisar olhar a tela; toda chamada fica transcrita no lugar certo para auditoria; a empresa liga e desliga tudo por tela.

### Não-objetivos

- Gravar o áudio. Fica só o texto.
- Vídeo.
- Transferir a chamada, ao vivo, para o telefone de um atendente (a transferência continua sendo para o chat).
- Gravação e transcrição de **reuniões** por vídeo (ver seção 9: é outra frente).
- Uazapi.

## 3. Requisitos

### Parte A — transcrição completa da chamada (auditoria)

| ID | Requisito |
| --- | --- |
| RF-1 | Durante a chamada, o sistema guarda cada fala em texto: quem falou (pessoa ou Astro), o que disse e a hora. A fala da pessoa vem da transcrição da voz em tempo real; a do Astro, do texto que ele mesmo gerou. |
| RF-2 | **Chamada de cliente:** ao terminar, entra na conversa do lead uma mensagem de chamada (a que o chat já sabe mostrar), com duração e o botão **Ver transcrição**, que abre a conversa inteira em ordem. |
| RF-3 | **Chamada da equipe:** não existe conversa de lead. A transcrição completa fica no registro de comandos do Astro (`WhatsappBotCommand`), visível na tela de registros do Astro pelo WhatsApp. |
| RF-4 | A transcrição também registra as ações: "Astro consultou: quantas manutenções essa semana", "Astro marcou: Consulta 12/10 09:00", "Astro enviou por mensagem: PIX". |
| RF-5 | Chamada que cai no meio (queda de rede, deploy) guarda o que foi dito até ali, marcada como interrompida. |
| RF-6 | A transcrição segue as regras de acesso da conversa: quem vê o lead vê a transcrição. Não vai para o cliente. |
| RF-7 | Na Visão do Lead e na busca do chat, a chamada conta como interação. |

### Parte B — conversa sem olhar a tela

| ID | Requisito |
| --- | --- |
| RF-8 | Pergunta de roteiro com até 5 opções é **falada**: "Tenho a Agenda Suporte e a Agenda Guia. Qual você quer?", e a resposta falada é aceita. |
| RF-9 | Com mais de 5 opções, o Astro fala as 3 primeiras e diz que mandou a lista completa por mensagem; aceita resposta falada ou clique. |
| RF-10 | Confirmação de ação simples (marcar, remarcar, cancelar o próprio horário, criar demanda) é **falada**: "Confirma consulta sexta ao meio-dia na Agenda Suporte?". Sim ou não por voz. |
| RF-11 | Continuam **só por mensagem**: PIX, links, códigos, e confirmação de ação que envolve dinheiro ou envia algo a terceiros. O Astro avisa na chamada. |
| RF-12 | Pedido repetido em seguida (mesma pergunta em menos de 20 segundos) não consulta de novo: reusa a resposta. Na prova, a mesma pergunta foi consultada duas vezes. |

### Parte C — o cliente liga e o Astro atende

| ID | Requisito |
| --- | --- |
| RF-13 | Na aba "O que o Astro pode fazer" do tracking, a opção **Atender chamadas de voz** (desligada por padrão). Com ela ligada, cliente que liga para o número é atendido pelo Astro. |
| RF-14 | Na chamada, o Astro do cliente tem **as mesmas capacidades ligadas para o texto** nesse tracking (agenda, formulário, fichas, PIX, pedido à equipe) e as mesmas proteções da spec 0084. Nada a mais. |
| RF-15 | Saudação: "Olá, aqui é o [nome do assistente], assistente virtual da [empresa]. Como posso ajudar?". Deixa claro que é um assistente virtual. |
| RF-16 | "Quero falar com uma pessoa": o Astro avisa que um atendente vai continuar pelo WhatsApp, transfere o atendimento (como no texto) e encerra a chamada. |
| RF-17 | Cliente que liga com a opção desligada: a chamada é recusada e ele recebe a mensagem "No momento atendemos só por mensagem. Pode escrever por aqui." |
| RF-18 | Horário de atendimento por voz configurável; fora dele, vale o RF-17. |
| RF-19 | Limites por cliente: 10 minutos por chamada, 6 chamadas por hora (eram 3; em 10/10/2026 um cliente que ligou de novo depois de duas quedas foi recusado). |

### Parte D — configuração por tela

| ID | Requisito |
| --- | --- |
| RF-20 | **Equipe:** em Astro › WhatsApp, a opção "Atender chamadas de voz da equipe", por empresa. Substitui a variável de ambiente da prova, que continua existindo como trava geral de segurança. |
| RF-21 | Escolha da voz e do modelo (econômico ou completo), com o custo estimado por minuto ao lado. |
| RF-22 | A tela confere na Meta se o número pode receber chamadas (limite de 2.000 ou número de teste) e se o webhook assina chamadas; mostra o que falta, com o passo a passo. |
| RF-23 | Botão **Ativar chamadas neste número**, que liga o recurso na Meta com a confirmação do usuário. |

### Parte F — custos do número por conta do cliente, com histórico (pedido do Weydson em 10/10/2026)

Pedido: o custo das ligações, dos disparos e de tudo o que envolve o número da API oficial é do cliente, que cadastra o cartão; o sistema rastreia e guarda o histórico de todos os custos, junto dos custos do número em /campanhas.

**O que existe hoje (levantado no código):**

| Custo | Quem cobra hoje | Onde aparece |
| --- | --- | --- |
| Mensagens e disparos (tarifa da Meta) | A **Meta**, no cartão que o cliente cadastra **na Meta** (decisão D-1 da spec 0040) | Chip "Gasto do mês" e painel "Número e gastos" de /campanhas, lidos ao vivo da Meta, só o mês corrente |
| Taxa da Órbita por campanha | A Órbita, em checkout avulso (cartão ou PIX), atrás de uma chave hoje desligada | `BroadcastFeePayment`; somada ao "Gasto do mês" |
| Mensagem enviada pelo chat | A Órbita, em **Stars** (1 por mensagem), além da tarifa da Meta | Extrato de Stars |
| Mensalidade do número comprado (Salvy) | A Órbita, em **Stars** | Extrato de Stars |
| Chamada: tarifa da Meta | A Meta, no cartão do cliente na Meta. Grátis quando o cliente liga; R$ 0,0556/min quando a empresa liga | Fatura da Meta |
| Chamada: voz da IA (OpenAI) | **Ninguém cobra hoje.** O custo é da Órbita (cerca de R$ 0,15/min no modelo econômico) | Em lugar nenhum: a chamada nem registra o custo |

**Não existe em /campanhas saldo carregado em reais nem cartão do cliente guardado na Órbita.** O "saldo" da tela é o limite diário de contatos. O único saldo carregado com cartão e histórico que o sistema tem são as **Stars** (compra por cartão ou PIX, extrato com saldo após cada movimento, aviso de saldo baixo, carência).

**Proposta, reaproveitando o que existe (aguarda decisão do Weydson):**

| ID | Requisito |
| --- | --- |
| RF-24 | **A voz da chamada é cobrada do cliente em Stars, por minuto**, na ação `astro_voice_minute`, com preço que cobre o custo e a margem. Cliente com chave própria da OpenAI em Satélites não paga Stars de voz: a OpenAI cobra dele direto. |
| RF-25 | **Todo custo ligado ao número fica registrado por evento**, em dinheiro, no registro de custos que já existe (`UsageEvent`): chamada (minutos, custo da voz e tarifa da Meta quando houver), mensagem do chat, disparo, mensalidade do número. Cada registro guarda o tracking, para somar por número. |
| RF-26 | **O gasto da Meta passa a ser guardado dia a dia** (hoje é só lido ao vivo e some se a chave cair), no mesmo registro de custos, para existir histórico de meses anteriores. |
| RF-27 | **Painel "Número e gastos" em /campanhas** passa a mostrar, por número e por mês: tarifa da Meta por categoria (cobrada no cartão do cliente na Meta), chamadas de voz (minutos e valor), mensagens do chat, mensalidade do número e taxa da Órbita; o saldo de Stars e o botão de recarga; e o **histórico** com os lançamentos, com filtro por período e exportação. |
| RF-28 | **Sem saldo de Stars:** chamada nova é recusada com a mensagem de atendimento por texto; chamada em andamento termina com aviso falado ao fim do minuto corrente. |
| RF-29 | A tela deixa claro o que é cobrado por quem: "cobrado pela Meta no seu cartão" e "cobrado pela Órbita em Stars". |

**O que esta proposta não faz, e por quê:** não cria uma carteira em reais nem guarda o cartão do cliente na Órbita para cobrança automática. Isso não existe em nenhum módulo, contraria a decisão D-1 da spec 0040 (cartão na Meta) e seria um sistema de cobrança novo, com tabela nova. Se o Weydson quiser esse caminho, é uma spec própria de cobrança, não parte da chamada de voz.

### Parte E — o Astro liga para o cliente (fica para a entrega seguinte)

Registrado para não se perder; **não entra nesta implementação**:

- Pedido de permissão ao cliente (mensagem da Meta), respeitando 1 pedido por dia e 2 por semana.
- Ligação de lembrete de consulta ou de retorno, só com permissão válida, em horário comercial.
- Trava antes dos limites da Meta (4 chamadas não atendidas revogam a permissão).
- Indisponível para números dos EUA, Canadá, Egito, Vietnã e Nigéria.

### Segurança

| ID | Requisito |
| --- | --- |
| RS-1 | **Identidade pelo servidor.** O cliente é o lead do número que ligou, informado pela Meta no webhook assinado. O que ele diz na chamada não muda quem ele é. |
| RS-2 | **Mesmas ferramentas do texto, presas ao lead** (spec 0084). O modelo de voz só alcança dados por elas. |
| RS-3 | **Negar por padrão.** Sem a opção ligada, a chamada é recusada. |
| RS-4 | **Sem gravação de áudio.** Só o texto fica, na conversa do lead ou no registro do Astro. |
| RS-5 | **A transcrição pode conter dado pessoal** dito pelo cliente. Fica com a mesma proteção das mensagens do chat e some junto com a conversa quando ela é apagada. |
| RS-6 | **Fala segura:** PIX, senha, código e link nunca são falados nem pedidos. Saúde: o Astro não orienta, só agenda ou transfere. |
| RS-7 | **Limites** por cliente (RF-19) e por empresa (chamadas simultâneas), para não esgotar o servidor nem o saldo. |
| RS-8 | **Encerramento garantido** e chamada nunca sem acompanhamento, como na spec 0086. |
| RS-9 | **Sem segredos** no prompt nem nos registros. A transcrição não guarda chaves nem identificadores internos. |
| RS-10 | **Aviso de assistente virtual** na saudação (RF-15) e de que a conversa fica registrada em texto (LGPD). |

### Regras da Meta (conferidas em 10/10/2026)

| Regra | Como a spec atende |
| --- | --- |
| Chamadas só em número com limite de 2.000 destinatários por dia, ou número público de teste | RF-22: a tela confere antes de oferecer |
| Atender em 30 a 60 segundos; encerrar pela API | Mantido da spec 0086 |
| Com SIP ligado no número, o aviso de chamadas para de chegar | A tela não mexe em SIP; RF-22 avisa se estiver ligado |
| Baixa taxa de atendimento ou reclamação restringe as chamadas | RF-17: chamada não atendida é recusada na hora com mensagem, em vez de tocar sem resposta |
| IA como funcionalidade auxiliar do negócio | O Astro do cliente só trata dos serviços da empresa, como no texto |
| Não pedir nem enviar documento, cartão ou informação de saúde | RS-6 |
| Empresa ligando exige permissão e tem limites | Parte E, fora desta implementação |

### Custos

Como na spec 0086: a Meta não cobra quando o cliente liga; a voz em tempo real custa cerca de R$ 0,15 por minuto no modelo econômico e R$ 0,40 a 0,55 no completo. A transcrição da fala do cliente já faz parte da sessão de voz. A forma de repassar esse custo ao cliente está na Parte F; **o preço em Stars por minuto é do Weydson definir**. A ação `astro_voice_minute` existe e está sem preço, e hoje a chamada não registra custo nenhum.

## 4. Critérios de aceite

- [ ] **CA-1** — Cliente liga, conversa e desliga: aparece na conversa dele a mensagem de chamada com a duração, e "Ver transcrição" mostra todas as falas em ordem.
- [ ] **CA-2** — Chamada da equipe: a transcrição completa aparece no registro do Astro.
- [ ] **CA-3** — A transcrição mostra as ações do Astro (consultou, marcou, enviou por mensagem).
- [ ] **CA-4** — Queda no meio da chamada: a transcrição parcial fica salva, marcada como interrompida.
- [ ] **CA-5** — "Agendar consulta para sexta ao meio-dia" por voz, com duas agendas: o Astro pergunta falando, aceita a resposta falada, confirma falando e marca, sem nenhuma mensagem de botão no meio.
- [ ] **CA-6** — "Manda o PIX": continua indo por mensagem, com aviso na chamada.
- [ ] **CA-7** — A mesma pergunta duas vezes seguidas gera uma consulta só.
- [ ] **CA-8** — Cliente liga com a opção ligada e agenda um horário por voz; o agendamento fica no nome dele e o lembrete é criado.
- [ ] **CA-9** — Cliente pede dado de outra pessoa ou da empresa por voz: recusa, como no texto.
- [ ] **CA-10** — "Quero falar com uma pessoa": transfere para o chat e encerra.
- [ ] **CA-11** — Opção desligada ou fora do horário: chamada recusada, com a mensagem do RF-17.
- [ ] **CA-12** — Quarta chamada do mesmo cliente na mesma hora é recusada.
- [ ] **CA-13** — A tela mostra corretamente um número que não pode receber chamadas e o que falta.
- [ ] **CA-14** — Usuário sem acesso ao lead não vê a transcrição.

## 5. Abordagem

- **Transcrição (A):** o canal de controle já recebe os eventos da sessão de voz; passam a ser lidos os de transcrição da entrada e da saída, acumulados na chamada em memória e gravados em blocos durante a chamada (para o RF-5). Cliente: `Message` com `mediaType: "voice_call"` na conversa do lead e a transcrição em `Message.metadata`; `call-message-box.tsx` ganha o "Ver transcrição". Equipe: `WhatsappBotCommand.responseSummary`, que já é texto livre. **Sem tabela nem coluna nova.**
- **Opções faladas (B):** a ferramenta `consultar_astro` passa a devolver a pergunta e as opções em vez de enviá-las, quando forem poucas e não sensíveis; a resposta falada volta pela mesma ferramenta, que já sabe casar texto com opção (o roteiro guiado aceita o nome digitado).
- **Cliente (C):** no evento de chamada, quando quem liga não é membro vinculado, procura-se o lead pelo telefone no tracking e, com a capacidade ligada, abre-se a sessão de voz com as ferramentas de `tracking-chat-ai/server/tools/` (`buildAgentTools`), que já recebem o lead do servidor. Prompt de voz derivado do prompt do Chatbot IA do tracking mais o bloco de proteção.
- **Configuração (D):** `AiSettings.capabilities.voiceCall` (cliente) e um campo em `OrganizationBotConfig` (equipe, migration aditiva de uma coluna, com autorização). Conferência na Meta com `GET /{phone-number-id}/settings` e o campo `messaging_limit_tier`.
- **Leiaute antes do código** para as telas (aba do tracking, Astro › WhatsApp e o "Ver transcrição").

## 6. Ordem de entrega

1. **A** (transcrição) e **B** (opções faladas): melhoram o que já funciona e valem para a equipe hoje.
2. **C** (cliente liga) com a opção em **D** para o tracking.
3. Resto de **D** (tela da equipe, conferência na Meta, ativar pelo botão).
4. **E** em spec própria.

## 7. Riscos e pontos em aberto

- **Produção ainda não foi testada.** O retransmissor de áudio precisa que o servidor saia por UDP; no ambiente local funcionou. Antes de ligar para clientes, é preciso uma chamada de teste em produção.
- **Capacidade:** cada chamada mantém conexões abertas na memória do servidor. Um deploy derruba as chamadas em andamento. Para poucas chamadas simultâneas é aceitável; para volume, o retransmissor precisa virar um serviço à parte. A spec limita chamadas simultâneas por empresa (RS-7) e deixa a separação para quando houver uso real.
- **Número de produção com limite de 2.000:** sem isso a empresa não liga as chamadas, e não depende de nós.

## 8. Decisões tomadas sem resposta do Weydson

1. Transcrição em **texto**, sem áudio gravado.
2. Transcrição da equipe no registro do Astro; a do cliente, na conversa dele.
3. Até **5 opções** faladas; acima disso, lista por mensagem.
4. O Astro ligar para o cliente (Parte E) fica para depois.
5. Modelo de voz econômico como padrão.

## 9. Fora desta spec: reunião gravada e transcrita no Workspace

Pergunta do Weydson em 10/10/2026. **Hoje isso não existe no sistema.** A chamada de vídeo com o lead (`app/router/livekit/create-lead-meeting.ts`) cria a sala e deixa no chat uma mensagem com a duração; o próprio código registra que a gravação ficou para uma fase futura que não foi feita. A única transcrição de vídeo existente é a do Planner, de arquivo enviado.

Como poderia funcionar, reaproveitando o que há:

1. A reunião já acontece no LiveKit. Liga-se a gravação da sala (recurso do LiveKit), com aviso e consentimento de quem participa.
2. Ao terminar, o arquivo vai para o armazenamento do projeto.
3. A transcrição usa a ação que já existe e já tem preço (`transcribe_video`, por minuto).
4. A IA resume: decisões, pendências e responsáveis.
5. O resultado entra no Workspace como demanda ou documento ligado ao lead, com as pendências virando itens de checklist, e a transcrição completa fica na mensagem da reunião no chat, com o mesmo "Ver transcrição" desta spec.

Fica como proposta para uma spec própria, se o Weydson quiser.

## 10. Changelog

- 2026-10-10 — aprovada pelo Weydson com a opção 1 da Parte F (Stars como saldo do cliente) e um acréscimo dele: **sem crédito, não há ligação nem disparo; as demais funções seguem as regras de sempre.** Primeira parte implementada, só no servidor (as telas esperam o leiaute):
  - **Crédito:** `stars/lib/stars-credit.ts` (`hasStarsCredit`, `assertStarsCreditForBroadcast`). Sem crédito, o disparo não começa nem é agendado (`router/campanhas/send.ts`, `schedule.ts`), e a campanha agendada fica parada até haver recarga (`inngest/functions/campanhas/dispatch-due-broadcasts.ts`). Chamada sem crédito é recusada com mensagem; no meio da chamada, o Astro se despede e encerra. "Sem crédito" = saldo de Stars zerado ou conta suspensa. **O disparo continua sem descontar Stars por mensagem**: o bloqueio é só pela existência de saldo; se o Weydson quiser débito por mensagem, é decisão à parte.
  - **Cobrança da chamada (RF-24, RF-25):** ação nova `astro_whatsapp_call_minute`, cobrada minuto a minuto (o primeiro ao atender), com o custo em dinheiro gravado no registro de custos (`UsageEvent`), ligado ao tracking do número. Preço inicial no cadastro: **2 Stars por minuto**, ajustável no catálogo. Não usei `astro_voice_minute` para não começar a cobrar a voz da plataforma (spec 0054) sem decisão. Empresa com chave própria da OpenAI não paga Stars de voz; o custo é só registrado.
  - **Transcrição (Parte A, equipe):** cada fala da pessoa e do Astro e cada ação ("consultou", "enviou por mensagem") é guardada com a hora; a transcrição é salva a cada minuto e ao fim, em `WhatsappBotCommand.responseSummary`, e a chamada interrompida fica marcada. A transcrição no chat do **lead** depende da Parte C (cliente ligando).
  - **Verificado por script:** empresa com saldo tem crédito e dispara; empresa sem saldo tem o disparo bloqueado com o motivo; os módulos carregam.
  - **Não verificado:** a transcrição e a cobrança numa chamada real; o fim da chamada por falta de crédito; a campanha agendada adiada. No banco de desenvolvimento os preços não estão cadastrados, então a cobrança sai zerada lá.
  - **Não feito ainda:** Partes B, C, D; RF-26 (guardar o gasto da Meta dia a dia); RF-27 (painel em /campanhas com histórico); "Ver transcrição" na tela.
- 2026-10-10 — **Parte C implementada (cliente liga e o Astro atende)** e ambiente de demonstração montado:
  - `astro-bot/lib/voice-call/client-call.ts`: quem liga e não é membro vinculado ao Astro naquele número é tratado como cliente. O lead é o do número (criado se não existir); a sessão de voz usa o mesmo prompt do Chatbot IA do tracking, o conhecimento da empresa, e as **mesmas ferramentas do atendimento por texto**, convertidas para a voz e presas ao lead (agenda, pedido à equipe, transferência). Ficam de fora as que mandam mídia ou botão. Opção nova "Atender chamadas de voz" na aba "O que o Astro pode fazer" (`capabilities.voiceCall`, sem migration). Sem a opção, ou acima de 3 chamadas por hora, a chamada é recusada com "No momento atendemos só por mensagem". Limite de 5 chamadas simultâneas por empresa.
  - A sessão de chamada (`call-session.ts`) passou a aceitar as duas personas: equipe (ferramenta `consultar_astro`) e cliente (ferramentas do atendimento). O registro de comandos do Astro só recebe as chamadas da equipe; a conversa do chat e a jornada recebem as duas.
  - **Ambiente de demonstração (banco de desenvolvimento):** a empresa "ASTRO QA" foi renomeada para "CLÍNICA TÉRCIO REZENDE"; documento de conhecimento com unidades, horários, médicos, tratamentos e a lista de exames tirados do site da clínica; três agendas no tracking do número de teste (consulta Centro, consulta Jóckei, exames); assistente "Íris" com as opções ligadas. **Os valores de consulta e exame e as orientações de preparo são fictícios**, marcados como demonstração no próprio documento: o site não publica preços nem a lista de convênios. O tracking do número de teste saiu da lista do Astro da equipe, para o Weydson ser atendido ali como paciente.
  - **Verificado por script:** a sessão do paciente monta com 9 ferramentas, as instruções trazem os dados da clínica e as regras de ligação, e a consulta de horários das agendas novas devolve os horários de segunda-feira.
  - **Não verificado:** uma chamada real como paciente.
- 2026-10-10 — **correção de rumo pedida pelo Weydson:** "você fica criando novas pastas e campos, podendo aproveitar tudo o que já existe"; a ligação de um número conhecido deve criar o lead no chat, deixar a transcrição na própria conversa e entrar na jornada do lead. Mudanças:
  - **Toda chamada atendida** (hoje, as da equipe) passa a ser gravada no que já existe: o lead do número que ligou (criado como numa primeira mensagem, se não existir no funil), uma mensagem de ligação na conversa do chat (`mediaType: "voice_call"`, a mesma das chamadas de vídeo) com a transcrição em `Message.metadata`, e um evento `voice_call` na jornada do lead (`LeadJourneyEvent`), com duração e o que a pessoa disse. Arquivo: `astro-bot/lib/voice-call/call-record.ts`. O chat ganhou o "Ver transcrição" na mensagem de ligação (`tracking-chat/components/call-message-box.tsx`) e a linha do tempo da jornada ganhou o tipo "Ligação de voz atendida pelo Astro". A Visão do Lead é recalculada ao fim da chamada.
  - **Removida** a tela "Chamadas de voz" que eu tinha criado em Astro › WhatsApp (rota `astroBot.calls.list` e componente): era um lugar novo para algo que o chat já mostra. O RF-3 deixa de valer como escrito: a transcrição da chamada da equipe também fica na conversa do chat. O registro de comandos do Astro continua guardando o custo e uma cópia do texto.
  - **Efeito a conhecer:** membro da equipe que liga passa a ter um lead com o próprio número no funil daquele WhatsApp, o que antes o Astro evitava para as mensagens de texto.
  - **Inteligência na ligação:** as instruções da chamada passaram a incluir o que a empresa ensinou ao Astro (memórias e documentos da Auto Inteligência, até 6 mil caracteres), a lista do que ele sabe fazer na plataforma, e a regra de repetir telefone, valor ou data ditados em partes antes de agir.
  - **Chamada das 12:22 (roteiro do lead até o fim):** o lead "Maria Antônia" foi criado de verdade no funil Suporte, com a pergunta do funil falada e respondida por voz. Defeitos vistos e corrigidos: saudação repetida (a escuta agora fica desligada enquanto o Astro se apresenta); telefone ditado em partes gerou três tentativas com números incompletos (regra de repetir e confirmar); o cartão "Lead criado" foi lido como pergunta e o Astro seguiu perguntando (só é pergunta o que tem botão de resposta do roteiro ou termina em "?").
  - **Verificado por script** (dados de teste removidos): a ligação cria o lead, grava a mensagem de ligação com a transcrição e o evento na jornada, e a segunda gravação atualiza a mesma mensagem.
  - **Não verificado:** essas correções numa chamada real; o "Ver transcrição" e a jornada no navegador.
- 2026-10-10 — leiaute aprovado pelo Weydson. Segunda rodada:
  - **Painel de custos em /campanhas (RF-25 a RF-27):** `campanhas/server/lib/number-costs.ts` (resumo do mês e histórico por número), rotas `campanhas.numberCostSummary` e `numberCostEntries` (conferem que o número é da empresa), componente `self-service/number-costs-panel.tsx` (crédito com recarga, gasto por tipo, meses, histórico com filtro e exportação, aviso de sem crédito), exibido abaixo do painel do número. As mensagens do chat passaram a registrar de qual número saíram (`chargeMessageOutbound` e as nove rotas de mensagem); as anteriores a esta mudança não têm essa marca e não entram no histórico por número.
  - **Gasto da Meta guardado dia a dia (RF-26):** `snapshotMetaDailySpend` e a rotina diária `campanhas-snapshot-meta-daily-spend` (05:20). Fica no registro de custos marcado como custo do cliente, para não entrar na conta de custo da Órbita. Em produção, pede "Resync app" no Inngest.
  - **Chamada real de 3 minutos do Weydson:** a transcrição completa ficou salva, com falas, horas e ações, e a chamada apareceu no resumo de custos (3 minutos; Stars zeradas porque o banco de desenvolvimento não tem preços). A transcrição revelou cinco defeitos, corrigidos em seguida:
    1. saudação repetida e "pode falar" sem ninguém ter falado → detecção de fala menos sensível e instrução de silêncio depois da saudação;
    2. respostas simples iam só por mensagem ("te mandei por mensagem") e a pessoa, ao telefone, não podia ler → respostas longas agora vão por mensagem **e** o Astro diz os números principais; só dinheiro, link e código ficam restritos à mensagem;
    3. o Astro disse que não agenda → instrução explícita de que ele faz as ações pela ferramenta;
    4. perguntas de roteiro iam por botão → com até 5 opções, são faladas e a resposta falada volta pela ferramenta (Parte B, RF-8);
    5. clicar no botão enviado durante a chamada respondia "esse botão é de uma pergunta anterior" → a pergunta enviada na chamada passou a ser registrada como a pergunta em aberto.
    Também entrou o reuso da mesma pergunta em 20 segundos (RF-12).
  - **Não verificado:** as cinco correções numa chamada nova; o painel no navegador (só lint e rotas respondendo); a rotina diária da Meta; o encerramento por falta de crédito.
  - **Não feito ainda:** Parte C (cliente liga, com a transcrição no chat do lead e o "Ver transcrição"), Parte D (configuração por tela), a tela da transcrição das chamadas da equipe (o texto está guardado, mas não há tela que o mostre).
- 2026-10-10 — acrescentada a Parte F (custos por conta do cliente, com histórico), a pedido do Weydson. O levantamento mostrou que não existe saldo em reais nem cartão guardado na Órbita em /campanhas; a proposta usa Stars e o registro de custos existente. Aguarda a decisão dele sobre esse caminho.
- 2026-10-10 — criada, a partir do resultado da prova de conceito (spec 0086) e dos pedidos do Weydson: transcrição completa no chat do lead para auditoria e opções faladas. Aguardando aprovação.
- 2026-10-10 — **Parte C verificada com chamada real** (Weydson como paciente, Clínica Tércio Rezende, 181 s): a assistente atendeu, respondeu endereço, consultou horários, marcou e cancelou de fato; a transcrição ficou na conversa do lead (`voice_call` com `callTranscript`) e o evento entrou na jornada. Respostas em menos de 1 s depois da fala. Defeitos achados e corrigidos em `client-call.ts`:
  - **Leu um link em voz alta** (o do agendamento). Agora todo link devolvido por ferramenta é enviado por mensagem de WhatsApp e a voz recebe só o aviso de que foi enviado.
  - **Não tinha como mandar link da empresa** ("me manda o link dos exames"). Ferramenta de voz nova `send_link_by_message`, só com os links ligados na tela.
  - **Respondeu "vou confirmar" sobre convênio que está no documento**: o conhecimento da chamada era cortado em 8 mil caracteres. Subiu para 24 mil.
  - **Disse que registrou um pedido tendo só colocado uma tag**. Regra nova nas instruções de voz; e as tags padrão do sistema (tipo `SYSTEM`) saíram do catálogo que a assistente enxerga (`tracking-chat-ai/lib/context.ts`): quem aplica "Aguard. atendimento" é o código.
  - **Transcrição da fala do cliente ruim em frases curtas** ("Às nove" virou "Hello"). Modelo de transcrição trocado para `gpt-4o-transcribe`. A assistente ouve o áudio direto, então entendeu certo; o defeito era só no registro.
  - Horários falados passam a ser só a hora de início, no máximo quatro.
  - **Ainda não verificado:** as correções acima em nova chamada; desligar por falta de crédito; cobrança por minuto com preço cadastrado (o banco de desenvolvimento não tem preços, a cobrança sai zero).
- 2026-10-10 — **Fala cortada e silêncio durante consultas** (relato do Weydson depois da chamada real). O registro mostrou 5 respostas canceladas com `turn_detected`: com `interrupt_response: true`, qualquer som do outro lado cancelava a frase em curso. Mudanças em `call-config.ts` e `call-session.ts`:
  - Nada interrompe a fala do Astro (`interrupt_response: false`). A resposta deixou de ser criada pela OpenAI (`create_response: false`) e passou a ser pedida pelo servidor (`requestResponse`), que espera a fala em curso ou a consulta terminar. Se a pessoa falar por cima, a fala dela é ouvida e respondida logo depois.
  - **Frase de espera**: quando o Astro chama uma ferramenta sem ter dito nada antes, o servidor manda dizer "Só um instante, por favor." (ou variação) enquanto a consulta roda. É uma resposta fora da conversa (`conversation: "none"`), que não entra no histórico do modelo.
  - **Som de teclado durante a espera: não feito.** Exige injetar áudio próprio na ponte (pacotes Opus com numeração contínua em relação aos da OpenAI) e um arquivo de som já codificado; sem codificador nesta máquina e sem como validar sem novas chamadas. Fica como próximo passo, atrás de uma variável de ambiente.
  - **Ainda não verificado em chamada.**
- 2026-10-10 — **Ambiente barulhento e viva-voz** (teste do Weydson com TV ligada e telefone no viva-voz: o Astro respondeu três vezes ao eco do próprio "Olá"). Mudanças em `call-config.ts` e `call-session.ts`:
  - **Uma pessoa por vez**: enquanto o áudio do Astro toca (`output_audio_buffer.started` até `stopped`), o que o microfone capta é descartado (item apagado da conversa e fora da transcrição), e o buffer de entrada é limpo quando ele termina e ao fim da saudação. Elimina o eco do viva-voz. Contrapartida: quem fala por cima do Astro não é ouvido; precisa esperar a frase acabar.
  - **Detecção de fala por volume** (`server_vad`, limiar 0,75, 700 ms de silêncio para fechar a frase) no lugar da detecção semântica, que não tem limiar e tratava a TV como fala. Ajustável por `ASTRO_WHATSAPP_CALLS_VAD_THRESHOLD` (0,3 a 0,95).
  - Limite que não se resolve no servidor: voz de outra pessoa perto do telefone, tão alta quanto a de quem ligou, continua sendo fala. A redução de ruído da OpenAI (`near_field`) e a do próprio WhatsApp atenuam, não separam vozes.
  - **Ainda não verificado em chamada.**
- 2026-10-10 — **Chamada real de 255 s no viva-voz com TV ligada**: fluxo inteiro funcionou (frase de espera, marcar, cancelar, link por mensagem, recusa de remédio, pedido à equipe). Achados e mudanças:
  - **A voz ainda era cortada** (4 vezes): no WebRTC a OpenAI apaga o áudio em andamento (`output_audio_buffer.cleared`) a cada `speech_started`, mesmo com `interrupt_response: false`. Agora a escuta fica **desligada** (`turn_detection: null`) enquanto o Astro fala e é religada, com o buffer limpo, quando o áudio termina (`openMic`/`closeMic` em `call-session.ts`). A reabertura é garantida por um temporizador calculado pelo tamanho da fala, porque o aviso `output_audio_buffer.stopped` nem sempre chega. A sessão já nasce com a escuta desligada, então a saudação também não é cortada.
  - **Tags de interesse ao fim da ligação** (`tracking-chat-ai/lib/tag-from-transcript.ts`): a voz não chamava a ferramenta de tag. Ao desligar, uma leitura única do que o cliente disse escolhe entre as tags com regra da empresa (as do sistema ficam de fora) e aplica com `applyTagsByAi`, o que dispara os fluxos de "lead recebe uma tag". Custo registrado em `UsageEvent` (`astro_whatsapp_call_tagging`).
  - **Horários**: a ferramenta de voz recebe só a hora de início, quatro por vez (`toSpokenSlots` em `client-call.ts`).
  - Regras de voz novas: pergunta de lista se responde citando itens; item da lista não vira pedido à equipe; repetir a unidade antes de consultar; despedida em uma frase.
  - Limite de chamadas por cliente ajustável em teste (`ASTRO_WHATSAPP_CALLS_MAX_PER_HOUR`); padrão 6.
  - **Ainda não verificado em chamada**: escuta desligada durante a fala, horários só com início, regras novas.
- 2026-10-10 — **Som de teclado durante as consultas** (pedido do Weydson: "não pode deixar o cliente no vácuo"). `media-relay.ts` ganhou `createCallerAudioWriter`: enquanto uma ferramenta roda, o servidor manda ao cliente quadros Opus de um som de teclado (`typing-sound.ts`, 3,2 s em laço, sintetizado, sem gravação de terceiros) no mesmo fluxo de áudio. Para isso a numeração de saída (sequência e tempo) passa a ser feita pelo servidor. A voz sempre vence: pacote de fala da OpenAI cala o teclado por 350 ms; o silêncio dela é substituído, não somado. Só vale com `ASTRO_WHATSAPP_CALLS_TYPING_SOUND=true`; desligado, o áudio é repassado intocado como antes. Simulado em `scripts/typing-sound-check.ts` (numeração contínua nas viradas de 16 e 32 bits). **Ainda não ouvido em chamada**: volume, e se o silêncio da OpenAI vem em pacotes pequenos como suposto (se vier grande, o teclado simplesmente não toca).
