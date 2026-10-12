---
id: 0086
titulo: Chamada de voz do Astro pelo WhatsApp — prova de conceito e plano
dominio: astro-bot
status: parcial
autor: Weydson
criada: 2026-10-10
atualizada: 2026-10-10
branch: feature/W-form-fichas-proxima-data-20261009
pr: Act962/nasa.ex#453
peso: completa
---

# 0086 — Chamada de voz do Astro pelo WhatsApp

## 1. Contexto

Última etapa do plano "ASTRO por voz no WhatsApp". As anteriores entregaram áudio gravado (ouvir e responder com nota de voz), que leva de 6 a 20 segundos por resposta. Conversa com resposta em 1 a 2 segundos só existe em **chamada em tempo real**.

O que existe hoje:

- **Voz em tempo real na plataforma** (spec 0054): o navegador fala direto com a OpenAI, e a ferramenta `consultar_astro` leva a pergunta ao Astro. Reaproveitável: a configuração da sessão (`astro/server/voice/build-voice-session-config.ts`), a cobrança por minuto (`charge-voice-minute.ts`) e o cálculo de custo (`realtime-usage-cost.ts`).
- **WhatsApp:** nada de chamada. O webhook oficial só assina mensagens (`http/whats-oficial/subscribe-app-webhook.ts`) e descarta eventos de chamada como formato desconhecido.

A Meta oferece a **Calling API** na API oficial: quando alguém liga para o número da empresa, o sistema recebe a chamada e responde por programa.

## 2. Objetivo

Alguém liga para o número da empresa no WhatsApp e o Astro atende, conversando por voz com resposta em 1 a 2 segundos, com as mesmas permissões e proteções do texto.

Esta spec tem duas etapas. **Só a Etapa 1 é implementada agora.**

### Não-objetivos (nesta spec)

- Chamada em número não oficial (Uazapi): não existe API para isso.
- Vídeo.
- Transferir a chamada para o telefone de um atendente.
- Gravar o áudio da chamada.

## 3. Como funciona (o caminho escolhido)

1. A pessoa liga para o número. A Meta avisa o sistema pelo webhook, com a "oferta" de conexão de áudio dela.
2. O sistema repassa essa oferta à OpenAI (voz em tempo real) e recebe a "resposta" de conexão.
3. O sistema devolve essa resposta à Meta e atende a chamada.
4. O áudio passa a correr **direto entre a Meta e a OpenAI**. O servidor da Órbita não transporta áudio: só acompanha a conversa por um canal de controle, onde recebe os pedidos de dados ("consultar o Astro") e devolve as respostas.

Por que este caminho: não exige servidor de telefonia novo nem serviço intermediário, e reaproveita a voz em tempo real da spec 0054.

**O que ainda é incerto, e é o que a prova de conceito responde:** se a oferta de conexão da Meta e a resposta da OpenAI são compatíveis entre si sem adaptação. As duas documentações descrevem o mesmo padrão (WebRTC, áudio Opus), mas não encontrei documentação oficial dessa ligação direta. Se não forem compatíveis, o plano B é o protocolo SIP, que as duas também oferecem, com um intermediário entre elas (o LiveKit, já usado nas reuniões do projeto, é o candidato). O plano B é mais caro de montar e fica para decidir depois da prova.

## 4. Requisitos

### Etapa 1 — prova de conceito: a equipe liga e o Astro atende

| ID | Requisito |
| --- | --- |
| RF-1 | O webhook oficial passa a aceitar eventos de chamada (`calls`), com a assinatura conferida como nas mensagens. |
| RF-2 | Chamada só é atendida se: a função estiver ligada no ambiente (desligada por padrão), o tracking estiver na lista de liberados, e quem liga for um membro vinculado ao Astro (o mesmo portão do WhatsApp por texto). Qualquer outra chamada é **recusada** na hora, sem tocar. |
| RF-3 | O Astro atende em até 5 segundos e se apresenta: "Oi, aqui é o Astro, o assistente da [empresa]". |
| RF-4 | Perguntas sobre dados e pedidos de ação passam pela ferramenta `consultar_astro`, que roda o **mesmo caminho da mensagem de texto** do WhatsApp (permissões da spec 0082, consultas em código, cobrança). O modelo de voz não acessa dados por conta própria. |
| RF-5 | O que não deve ser falado (PIX, links, códigos, listas longas, botões) é enviado por **mensagem de texto** na conversa, e o Astro avisa na chamada: "te mandei por mensagem". |
| RF-6 | Limite de 10 minutos por chamada: aos 9, o Astro avisa; aos 10, encerra. Uma chamada por vez por membro. |
| RF-7 | Ao desligar (de qualquer lado), o sistema encerra a chamada na Meta e na OpenAI. |
| RF-8 | Cobrança por minuto com a ação `astro_voice_minute` (já existe no catálogo, hoje sem preço). O registro guarda duração e custo. |
| RF-9 | A chamada fica registrada como um comando do Astro (`WhatsappBotCommand`): quem ligou, duração, e o resumo do que foi pedido. Sem gravação de áudio. |
| RF-10 | Falha em qualquer passo (OpenAI fora, oferta incompatível) recusa ou encerra a chamada e manda uma mensagem de texto: "Não consegui atender por voz agora. Me escreva por aqui." |

### Etapa 2 — produto (spec de continuação, depois da prova)

Fica registrado o escopo, sem implementar:

- **Cliente liga e o Astro atende** com as capacidades da spec 0084 (agenda, pedidos), ligado por tracking na aba "O que o Astro pode fazer".
- **Astro liga para o cliente** (lembrete de consulta, retorno), com o pedido de permissão que a Meta exige.
- Configuração por empresa na tela (hoje é por variável de ambiente), escolha de voz, horário de atendimento da chamada.
- Chamada registrada na conversa do atendimento, com a transcrição.
- "Falar com atendente" durante a chamada.
- Preço em Stars por minuto definido.

### Segurança

| ID | Requisito |
| --- | --- |
| RS-1 | **Identidade pelo servidor:** quem liga é identificado pelo número que a Meta informa no webhook assinado, conferido no portão do Astro. Nada do que a pessoa diz na chamada muda quem ela é. |
| RS-2 | **Voz não é atalho:** todo dado sai de `consultar_astro`, que aplica as permissões da spec 0082. O modelo de voz não recebe nenhuma outra ferramenta. |
| RS-3 | **Negar por padrão:** função desligada no ambiente, tracking fora da lista ou número não vinculado = chamada recusada. |
| RS-4 | **Chave da OpenAI só no servidor.** A conexão de áudio é fechada entre Meta e OpenAI com credenciais temporárias da própria sessão; a chave nunca vai para a Meta nem para o aparelho. |
| RS-5 | **Sem gravação.** O áudio não é guardado. Fica só o texto do que foi pedido e respondido, como no WhatsApp por texto. |
| RS-6 | **Fala segura:** recusa de permissão é dita na frase padrão, sem detalhes. PIX, senhas, códigos e links nunca são falados (RF-5). |
| RS-7 | **Limites:** duração máxima, uma chamada por membro, e o limite de comandos por hora que já existe. |
| RS-8 | **Sem segredo no prompt** e recusa de pedidos de instruções, como no texto. |
| RS-9 | **Encerramento garantido:** se o canal de controle cair, a chamada é encerrada. Nenhuma chamada fica aberta sem o servidor acompanhando. |

### Regras da Meta (conferidas em 10/10/2026 na documentação oficial da Calling API)

| Regra | Como a spec atende |
| --- | --- |
| Chamadas exigem **limite de mensagens de 2.000 destinatários por dia**. Número público de teste é isento | A prova usa o número de teste. Em produção, só números que já atingiram esse limite; a tela (Etapa 2) vai conferir antes de oferecer |
| O sistema tem **30 a 60 segundos** para atender; depois a chamada cai como "não atendida" | RF-3: atender em até 5 s; RF-10: recusar na hora quando não der |
| É obrigatório **encerrar a chamada pela API**, mesmo quando o áudio já terminou, para a cobrança ficar correta | RF-7 e RS-9 |
| Com **SIP ligado no número, o webhook de chamadas para de chegar** | A Etapa 1 não liga SIP. O plano B troca o caminho inteiro, não mistura |
| **Empresa ligando para o cliente** exige permissão dele; produção: 1 pedido por dia e 2 por semana por cliente; 4 chamadas não atendidas revogam a permissão. Indisponível para números dos EUA, Canadá, Egito, Vietnã e Nigéria | Fora da Etapa 1. Na Etapa 2, o sistema conta e trava antes do limite |
| Chamadas com **baixa taxa de atendimento ou reclamação** podem ser restringidas | A Etapa 1 só atende quem ligou. Nenhuma chamada sai do sistema |
| IA só como **funcionalidade auxiliar** do negócio | Mesmo Astro, restrito aos Apps da empresa. A voz é só o canal |
| A documentação não exige avisar que é IA nem falar de gravação | Mesmo assim o Astro se apresenta como assistente (RF-3) e não grava (RS-5); LGPD |
| Informação de saúde e identificadores sensíveis | Valem as regras da spec 0084 também na voz |

### Custos (estimativa de 10/10/2026)

| Item | Custo |
| --- | --- |
| Meta, quando a pessoa liga para a empresa | Grátis |
| Meta, quando a empresa liga (Etapa 2) | R$ 0,0556 por minuto |
| Voz em tempo real, modelo econômico (`gpt-realtime-mini`) | cerca de R$ 0,15 por minuto |
| Voz em tempo real, modelo completo (`gpt-realtime`) | cerca de R$ 0,40 a 0,55 por minuto |
| Consultas ao Astro durante a chamada | As Stars de sempre, por pergunta |

Chamada de 3 minutos atendida pelo Astro: de R$ 0,45 (econômico) a R$ 1,65 (completo), mais as consultas.

## 5. Critérios de aceite (Etapa 1)

- [ ] **CA-1** — O Weydson liga para o número de teste pelo WhatsApp: o Astro atende em até 5 segundos e se apresenta.
- [ ] **CA-2** — "Quantas manutenções tenho essa semana?": a resposta falada começa em até 3 segundos depois do fim da pergunta e bate com a do texto.
- [ ] **CA-3** — Dá para interromper o Astro falando por cima.
- [ ] **CA-4** — "Manda o PIX para o Weydson": o pedido de confirmação chega por mensagem de texto e o Astro avisa na chamada.
- [ ] **CA-5** — Membro sem permissão pergunta por um App bloqueado: ouve a recusa padrão.
- [ ] **CA-6** — Número não vinculado liga: a chamada é recusada, sem tocar.
- [ ] **CA-7** — Com a função desligada no ambiente, toda chamada é recusada e nada mais muda no webhook.
- [ ] **CA-8** — Desligar encerra a chamada dos dois lados; o registro mostra duração e o que foi pedido.
- [ ] **CA-9** — Aos 10 minutos a chamada é encerrada pelo sistema.
- [ ] **CA-10** — Com a chave da OpenAI inválida, a chamada é recusada e chega a mensagem de texto do RF-10.
- [ ] **CA-11** — O webhook de mensagens continua funcionando igual durante e depois das chamadas.

Se o CA-1 falhar por incompatibilidade entre a Meta e a OpenAI, o resultado da prova é esse, e a spec ganha a decisão sobre o plano B.

## 6. Abordagem (Etapa 1)

- **Entrada:** `http/whats-oficial/webhook-schema.ts` e `app/api/chat/webhook/official/route.ts` ganham o evento de chamada, **aditivo**: o tratamento das mensagens não muda. Portão: `resolveBotGate` (`astro-bot/lib/webhook-handler.ts`).
- **Meta:** cliente novo `http/whats-oficial/calls.ts` (aceitar, recusar, encerrar em `/{phone-number-id}/calls`).
- **OpenAI:** `astro-bot/lib/voice-call/` — cria a sessão com a oferta da Meta (`/v1/realtime/calls`), reaproveitando `buildVoiceSessionConfig`, e abre o canal de controle (`wss://api.openai.com/v1/realtime?call_id=…`, pacote `ws` já instalado).
- **Ferramenta:** `consultar_astro` chama `handleBotCommand` com um canal que, em vez de enviar pelo WhatsApp, devolve o texto para ser falado; o que não pode ser falado sai pelo canal de texto de sempre (`TrackingProviderBotChannel`).
- **Texto para a fala:** `voice/speakable-text.ts` (spec 0083).
- **Liga e desliga:** variáveis `ASTRO_WHATSAPP_CALLS=true` e `ASTRO_WHATSAPP_CALLS_TRACKING_IDS`. Sem tela e **sem mudança de banco** na Etapa 1.
- **Limite conhecido:** o canal de controle vive na memória do servidor durante a chamada. Um deploy no meio de uma chamada a derruba. Aceitável na prova; a Etapa 2 decide se isso precisa de um serviço próprio.
- **Documentação:** `docs/whatsapp-oficial-overview.md` (Regra 14).

## 7. O que depende do Weydson (não faço sozinho)

1. **Ligar as chamadas no número de teste** na Meta (configuração da conta).
2. **Assinar o evento `calls`** no webhook do app de teste na Meta.
3. Confirmar que o número de teste é um **número público de teste** da Meta (isento do limite de 2.000) ou já tem esse limite.
4. Fazer as ligações de teste do celular dele.

## 8. Decisões tomadas sem resposta do Weydson

1. A prova é com a **equipe**, não com o cliente: o número dele já está vinculado e o caminho de permissões está pronto.
2. Modelo de voz **econômico** na prova; o completo fica como opção.
3. **10 minutos** de limite por chamada.
4. **Sem gravação** de áudio.
5. Ligado por **variável de ambiente**, não por tela, até a prova passar.

## 9. Changelog

- 2026-10-10 — criada. Aguardando aprovação e os itens da seção 7.
- 2026-10-10 — aprovada pelo Weydson. **Etapa 1 escrita, ainda sem nenhuma chamada real.**
  - Arquivos: `http/whats-oficial/calls.ts`; `astro-bot/lib/voice-call/` (`call-config.ts`, `realtime-call.ts`, `call-session.ts`, `call-webhook.ts`); trecho novo no webhook oficial, depois da assinatura e antes das mensagens. `resolveBotGate` passou a ser exportado. Sem mudança de banco.
  - Voz padrão da chamada: Cedar, no modelo econômico. A Onyx, escolhida para as notas de voz, não existe na voz em tempo real.
  - **Verificado por script:** a rota do webhook carrega com o código novo; evento de chamada é reconhecido; webhook de mensagem e de status não é confundido com chamada; a função nasce desligada e só liga para tracking da lista; a sessão de voz só tem a ferramenta `consultar_astro`.
  - **Não verificado — é o que a prova vai mostrar:** se a OpenAI aceita a oferta de áudio da Meta e a Meta aceita a resposta (CA-1); tudo o que vem depois disso (CA-2 a CA-10). Os nomes dos eventos do canal de controle e o endereço de encerrar a chamada na OpenAI vêm da documentação e não foram exercitados.
  - Ambiente local: `ASTRO_WHATSAPP_CALLS=true` e o tracking de teste na lista, em `.env.local`.
- 2026-10-10 — **prova de conceito realizada com chamadas reais. Funcionou, com uma mudança de caminho.**
  - **Número usado:** o número público de teste da Meta (+1 555 140 0565), já ligado ao app "ORBITA TESTE DISPARO" do Weydson. O número que vínhamos usando (+55 86 9552-4630, "Armazém Carvalho") é um número real com limite de 250 e não se qualifica para chamadas. No ambiente local, a conexão do número de teste foi levada da org "TESTE DISPARO" para o tracking "Suporte" da ASTRO QA; o webhook do app passou a assinar `messages` e `calls`; as chamadas foram ativadas no número pelo próprio Weydson.
  - **1ª e 2ª chamadas: atendidas e mudas.** A OpenAI aceitou a oferta da Meta e a Meta aceitou a resposta, mas o áudio não fluiu. Causa, vista no diagnóstico: as duas pontas são ICE-lite (as duas esperam o outro lado iniciar a conexão de áudio), então nenhuma inicia. **A ligação direta descrita na seção 3 não funciona.**
  - **Caminho adotado:** um retransmissor de áudio no servidor (`voice-call/media-relay.ts`, biblioteca `werift`, JavaScript puro, adicionada às dependências e a `serverExternalPackages`). Ele abre uma conexão com a Meta e outra com a OpenAI, iniciando as duas, e repassa os pacotes de voz sem converter (as duas usam Opus). **Isso muda a seção 3 e o RS-4: o áudio passa pelo servidor da Órbita**, sem ser gravado. O plano B com SIP não foi necessário.
  - **3ª chamada: funcionou.** Áudio conectado nos dois lados; saudação ouvida; a voz do Weydson detectada; uma consulta feita pela ferramenta `consultar_astro` e respondida certo; encerramento correto dos dois lados. Segundo o Weydson: atendeu em cerca de 3 segundos e respondeu "bem rápido" (CA-1 e CA-2 atendidos na percepção dele, sem cronômetro; CA-8 pelos registros).
  - **Defeito observado:** logo depois da saudação o Astro respondeu sem ninguém ter perguntado (ruído ou eco tomado como fala). Ajustado com redução de ruído na entrada e instrução para esperar a pessoa falar. **O ajuste ainda não foi testado numa chamada.**
  - **Não verificado:** interromper o Astro (CA-3); pedido que vai por mensagem (CA-4); recusa de permissão por voz (CA-5); número não vinculado ligando (CA-6); limite de 10 minutos (CA-9); chave inválida (CA-10); a cobrança (a ação `astro_voice_minute` não tem preço cadastrado); o comportamento em produção, onde o retransmissor depende de o servidor conseguir sair por UDP.
  - **Para a Etapa 2 decidir:** o retransmissor vive na memória do servidor junto com o canal de controle; um deploy no meio derruba as chamadas em andamento, e cada chamada ocupa portas UDP do servidor.

