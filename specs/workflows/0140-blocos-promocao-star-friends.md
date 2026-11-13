---
id: 0140
titulo: Blocos da promoção STAR FRIENDS no FlowAstro
dominio: workflows
status: implementada
autor: João Gabriel
criada: 2026-11-12
atualizada: 2026-11-12
branch: claude/fluxo-atendimento-creator-ac11e1
pr:
peso: completa
---

# 0140 — Blocos da promoção STAR FRIENDS no FlowAstro

## 1. Contexto

O Mercadinho Preço Baixo usa a campanha de sorteio do STAR FRIENDS ([spec 0102](../stars/0102-star-friends-campanha-de-sorteio.md)) pelo WhatsApp oficial. Na cópia de produção de 2026-11-10, a "Campanha 15 anos" tinha 84 inscritos, 226 cupons e 377 números da sorte. Nenhum fluxo dos Gatilhos participa. São duas peças da IA do funil:

- **Menu guiado** (`capabilities.guidedMenu`): a boas-vindas com "Ver opções" e o item "Promoção 15 anos".
- **Campanha** (`handleCampaign`, em `src/features/tracking-chat-ai/lib/campaign-handler.ts`): nome, aceite das regras, foto do cupom, leitura por IA, números da sorte, pontos e códigos com conferência do celular. Roda antes da IA, dentro de `runWhatsappAgent`.

O FlowAstro ([spec 0139](0139-fluxo-de-atendimento.md)) vai substituir aos poucos o "Fluxo de atendimento" do funil. A empresa quer montar a promoção do seu jeito (ordem, textos, IA para dúvidas no meio), não só ligar uma caixa fechada. As regras de dinheiro e sorteio já estão em funções separadas: `registerCampaignEntry`, `registerReceipt` (leitura por IA + decisão por código), `getMemberCampaignSummary` e `listMemberLuckyCodes`.

Hoje o FlowAstro quebra a campanha se for ligado no número da promoção: lead dentro de um fluxo não passa por `runWhatsappAgent` (RF-18 da 0139), e com a entrada "Resposta padrão" até a foto do cupom vai para o fluxo.

## 2. Objetivo

A empresa monta a promoção no FlowAstro com blocos de encaixe (inscrever, registrar cupom, consultar) e um modelo pronto. As regras continuam as da 0102, e a campanha pela IA do funil não muda em nada.

### Não-objetivos

- Mudar regras da campanha: valor por número, leitura, duplicados, limite diário, conferência e sorteio continuam no código da 0102 (D-1 da 0102).
- O **Agente de IA** decidir cupom ou dar números (D-2). Dar ao Agente de IA a capacidade de ver imagens para conversar é outra entrega.
- Escolher no bloco qual campanha usar: vale a campanha ativa do número do lead (`findActiveCampaign`).
- Levar o menu guiado do funil para o FlowAstro. No fluxo, o menu é um bloco Enviar mensagem com lista.
- Foto de cupom enviada enquanto o lead está num bloco que não pede foto: ela é a resposta daquele bloco.
- Mudar `handleCampaign` (D-4).

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | **Pergunta** ganha o tipo de resposta **"Foto ou arquivo"**: aceita imagem ou PDF (figurinha não vale) e guarda na variável o id da mensagem. Texto no lugar da foto conta como resposta inválida (tentativas e mensagem de inválida de sempre). |
| RF-2 | Bloco **Inscrever na promoção**: pede o nome completo, envia o resumo das regras e o link do regulamento com "Aceito / Não aceito", espera a resposta e, no aceite, inscreve o lead com o aceite registrado na jornada (`consent_accepted`, como a 0102). O nome pode vir também do contato ou de uma variável do fluxo; perguntar é o padrão, porque o nome identifica o ganhador. |
| RF-3 | Saídas do Inscrever: **Inscrito**, **Já inscrito** (sem perguntar nada), **Recusou** (registra `consent_refused`), **Promoção fechada** (sem campanha, não começou ou acabou), **Outro assunto** e, com prazo, **Sem resposta**. |
| RF-4 | Bloco **Registrar cupom**: cadastra a foto da variável escolhida e as outras fotos que o cliente mandou junto (desde a última mensagem enviada, até 10), pelo `registerReceipt`. |
| RF-5 | Saídas do Registrar cupom, pelo resultado do último cupom: **Aceito**, **Repetido**, **Não vale** (outra loja, fora do período, não é cupom), **Ilegível** (inclui arquivo que não abriu), **Em conferência**, **Limite do dia**, **Não inscrito**, **Promoção fechada**, **Tente mais tarde**. |
| RF-6 | Variáveis do Registrar cupom: `numeros_da_sorte` (lista separada por vírgula), `qtd_numeros`, `valor_cupom` e `saldo_proximo_numero`, em reais formatados. |
| RF-7 | Opção do Registrar cupom **"Responder com a mensagem padrão da promoção"**, ligada por padrão: envia as mesmas respostas da 0102 para cada cupom. Desligada, o bloco não envia nada e a empresa escreve a mensagem com as variáveis em cada saída. |
| RF-8 | Bloco **Consultar promoção**: grava `qtd_cupons`, `total_compras`, `qtd_numeros`, `saldo_proximo_numero`, `numeros_da_sorte` e `stars`. Saídas: **Pronto**, **Não inscrito**, **Celular não confere**. |
| RF-9 | Opção do Consultar **"Pedir o celular antes"**, ligada por padrão: pergunta o celular cadastrado e compara com o do lead, como a 0102. Desligada, consulta direto. |
| RF-10 | No **Inscrever** e no **Consultar com celular**, "menu", "voltar", "cancelar" ou pedido de atendente saem por **Outro assunto**, e o fluxo segue. |
| RF-11 | **Modelo pronto "Promoção com cupom"** na criação do fluxo: Início → menu com lista (Promoção, Dúvidas) → Inscrever → Pergunta "Foto ou arquivo" → Registrar cupom → menu do inscrito (Cadastrar outro cupom, Ver pontos, Ver códigos), com Consultar e o Agente de IA nas Dúvidas. Faz a mesma conversa dos prints da campanha de 2026-11-05. |
| RF-12 | Foto ou PDF de **inscrito em campanha aberta**, enviada por um lead **fora de qualquer fluxo**, continua indo para a campanha pelo caminho de hoje, mesmo com fluxo de "Resposta padrão" ligado no número (D-3). |
| RF-13 | Os blocos ficam numa categoria nova **"Promoção"** do catálogo do FlowAstro. O painel de cada um mostra a campanha ativa ("Campanha 15 anos, de 01/11 a 30/11") ou "Nenhuma campanha ativa". |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | **Compatibilidade**: a campanha pela IA do funil não muda (mesmo código, mesmas mensagens). O único ponto compartilhado que muda é o roteador do FlowAstro (RF-12), e só age em número com fluxo do FlowAstro ligado. |
| RNF-2 | Nenhuma regra é copiada: os blocos chamam as funções da 0102. Os textos padrão (RF-7) saem da mesma função que a campanha usa. |
| RNF-3 | Stars: cada leitura de cupom cobra como hoje (`extract-receipt`). Os blocos não chamam modelo para decidir nada. |
| RNF-4 | Nenhuma função ou cron novo no Inngest: os blocos rodam dentro da execução do fluxo. |
| RNF-5 | Bloco montado fora de ordem não dá número indevido: Registrar cupom e Consultar recusam quem não é inscrito (saída "Não inscrito"); só o Inscrever inscreve, e só com o aceite. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado o modelo "Promoção com cupom" num número com campanha aberta, quando um cliente novo segue o caminho, então ele é inscrito com aceite registrado, manda o cupom e recebe os números da sorte com a mesma mensagem da 0102.
- [ ] **CA-2** — Dado um inscrito, quando passa pelo Inscrever, então sai por "Já inscrito" sem receber as regras de novo.
- [ ] **CA-3** — Dado um cupom já cadastrado, quando o cliente manda a foto de novo, então o Registrar cupom sai por "Repetido" e a mensagem padrão diz que o cupom já foi cadastrado.
- [ ] **CA-4** — Dado o Registrar cupom com a mensagem padrão desligada e uma Mensagem "Seus números: {{vars.numeros_da_sorte}}" na saída Aceito, quando o cupom vale, então só essa mensagem chega, com os números.
- [ ] **CA-5** — Dado o fluxo montado sem o Inscrever, quando um não inscrito chega ao Registrar cupom, então sai por "Não inscrito" e nenhum cupom é gravado.
- [ ] **CA-6** — Dado a Pergunta "Foto ou arquivo", quando o cliente manda texto, então recebe a mensagem de inválida; quando manda figurinha, também; quando manda foto ou PDF, segue por "Respondeu".
- [ ] **CA-7** — Dado o Consultar com "Pedir o celular antes", quando o cliente digita outro celular, então sai por "Celular não confere"; com o celular certo, sai por "Pronto" com as variáveis preenchidas.
- [ ] **CA-8** — Dado nenhuma campanha ativa, quando o fluxo chega ao Inscrever ou ao Registrar cupom, então sai por "Promoção fechada".
- [ ] **CA-9** — Dado um inscrito fora de qualquer fluxo e um fluxo de "Resposta padrão" ligado no número, quando ele manda só a foto do cupom, então a campanha cadastra o cupom pelo caminho de hoje e nenhum fluxo começa.
- [ ] **CA-10** — Dado o número sem fluxo do FlowAstro ligado, quando o cliente usa a promoção pelo menu do funil, então tudo funciona como antes (roteiro dos prints de 2026-11-05).
- [ ] **CA-11** — Dado o cliente que manda 3 fotos seguidas depois da Pergunta "Foto ou arquivo", então os 3 cupons são gravados uma vez cada e a mensagem padrão sai uma vez por cupom.
- [ ] **CA-12** — Dado o desligar do fluxo com leads no meio da promoção, então os leads saem do fluxo e a próxima mensagem volta para a campanha pela IA do funil.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Várias fotos seguidas | A caixa de entrada da 0139 entrega uma por vez. A Pergunta fica com a primeira; o Registrar cupom pega também as que chegaram depois da última mensagem enviada (RF-4). As que voltarem a ser vistas dão `already_processed` e não geram resposta repetida. |
| CB-2 | Registrar cupom sem variável de foto escolhida | Usa a última foto ou PDF que o cliente mandou depois da última mensagem enviada. Sem nenhuma, sai por "Ilegível" sem cobrar leitura. |
| CB-3 | Variável aponta para mensagem de outra conversa (id de outro lead) | Ignorada: o bloco só lê mensagem da conversa do próprio lead. |
| CB-4 | Campanha encerra entre o Inscrever e o Registrar | O Registrar sai por "Promoção fechada"; nada é gravado. |
| CB-5 | Inscrito em campanha encerrada usa o Consultar | Consulta normalmente (como a 0102: pontos e códigos continuam visíveis). |
| CB-6 | Pedido de compra do Catálogo em aberto | Os blocos não olham o pedido (a 0102 deixa a campanha de fora nesse caso porque a conversa é da venda guiada). No fluxo, quem decide o caminho é o desenho. |
| CB-7 | Lead sem telefone (Consultar com celular) | Sai por "Celular não confere" sem perguntar. |
| CB-8 | Reentrega do webhook da mesma foto | A 0139 já não roteia mensagem repetida; o cupom é idempotente por mensagem. |
| CB-9 | Foto de não inscrito fora de fluxo, "Resposta padrão" ligado | Abre o fluxo normalmente (RF-12 vale só para inscrito com campanha aberta). |
| CB-10 | Dois cupons na mesma vez, um aceito e um repetido | Saída pelo resultado do último; com a mensagem padrão ligada, cada cupom recebe a sua resposta. As variáveis somam os números de todos os aceitos. |
| CB-11 | Modelo criado numa empresa sem STAR FRIENDS | O modelo cria normalmente; os blocos mostram "Nenhuma campanha ativa" e saem por "Promoção fechada" até a empresa criar a campanha. |
| CB-12 | A foto chega, mas o arquivo não baixa (falha do R2 ou da Meta) | O fluxo acorda mesmo assim (D-6). A Pergunta "Foto ou arquivo" não aceita foto sem arquivo e manda a mensagem de resposta inválida; o Registrar cupom ignora a foto e, sem outra, sai por "Ilegível" sem cobrar leitura. |

## 6. Decisões de design

### D-1 — Blocos de encaixe em vez de um bloco fechado

- **Escolha**: três blocos (Inscrever, Registrar cupom, Consultar), o tipo "Foto ou arquivo" na Pergunta e um modelo pronto (RF-11).
- **Por quê**: a empresa decide a ordem, os textos e onde entra a IA; e o modelo evita começar do zero.
- **Alternativa descartada**: um bloco "Promoção" que faz a conversa inteira da 0102 (primeira versão desta spec). Simples de ligar, mas a empresa não muda nada do caminho, e exigia mudar `handleCampaign`.
- **Custo**: mais peças para montar errado. Mitigado pelo RNF-5 e pelo modelo.

### D-2 — A IA lê o cupom; o código decide

- **Escolha**: o Registrar cupom usa `registerReceipt`, onde a IA só transcreve o papel e o código decide validade, duplicado e números (0102, RNF-1).
- **Alternativa descartada**: o Agente de IA ver a foto e dar os números. Envolve prêmio: a IA pode aceitar cupom repetido ou ler o valor errado se o cliente insistir, e não há como auditar o porquê.

### D-3 — Foto de inscrito fora de fluxo continua indo para a campanha

- **Escolha**: antes de abrir um fluxo pela entrada (RF-6 da 0139), o roteador confere se a mensagem é foto ou PDF de inscrito em campanha aberta do número. Se for, não abre fluxo e deixa o caminho de hoje tratar (`runWhatsappAgent` → `handleCampaign`).
- **Por quê**: inscrito manda a foto direto, sem passar pelo menu. Sem isso, com "Resposta padrão", o cupom não seria cadastrado.
- **Alternativa descartada**: entrada nova "Foto de cupom" no Início. Mais uma regra de disputa entre fluxos (RF-5 da 0139).
- **Custo**: duas consultas (membro e inscrição) só quando a mensagem é imagem ou PDF, o lead está fora de fluxo e o número tem fluxo ligado.

### D-4 — `handleCampaign` não muda

- **Escolha**: os blocos chamam as funções de baixo (`registerCampaignEntry`, `registerReceipt`, `getMemberCampaignSummary`, `listMemberLuckyCodes`). Da campanha só sai, sem mudar, a função que monta o texto de resposta do cupom (`receiptReplyOf`), exportada para o RF-7.
- **Por quê**: a campanha está em uso; não mexer nela é a forma mais segura de garantir o RNF-1.

### D-5 — Tipos de bloco novos no enum

- **Escolha**: `NodeType` ganha `PROMO_ENROLL`, `PROMO_RECEIPT` e `PROMO_LOOKUP`, numa migration que só adiciona valores.
- **Alternativa descartada**: um tipo genérico com "modo" no `data`. O motor escolhe o executor pelo tipo; o modo esconderia o bloco das listas e do mapa de execuções.

### D-6 — Mídia que não baixou ainda acorda o fluxo

- **Escolha**: com o lead dentro de um fluxo do FlowAstro, a mensagem de mídia sem texto e sem arquivo salvo dispara o evento `agent-workflow/message-incoming` mesmo assim (`persist-canonical-inbound.ts`). Os blocos tratam a foto sem arquivo como inválida (CB-12).
- **Por quê**: antes, mídia sem legenda que não baixava era descartada antes do evento, e a execução ficava esperando para sempre, sem responder o cliente. Visto no teste local de 2026-11-13, com o R2 sem chave.
- **Compatibilidade**: só vale para lead dentro de fluxo, e os gatilhos de mensagem das automações antigas já ignoram esse lead (`agent-trigger-message-incoming`). Fora de fluxo nada muda.

## 7. Impacto

- [x] Schema / migration: `ALTER TYPE "NodeType" ADD VALUE` (3 valores; só adiciona; ritual da regra 11).
- [x] Procedures oRPC: `attendanceFlow.campaignStatus` (RF-13, só leitura, escopo da empresa); `attendanceFlow.create` aceita o modelo (RF-11).
- [ ] Realtime
- [ ] Automações (Inngest): nenhuma função nova (RNF-4).
- [ ] Env vars novas
- [ ] Breaking change: não (RNF-1).
- [x] Documentação: `docs/whatsapp-oficial-overview.md` §4.3 (roteador do FlowAstro e foto de inscrito, D-3); changelog da 0102 e da 0139.

**Arquivos previstos**: `attendance-flows/lib/nodes.ts` (tipo "Foto ou arquivo", saídas e dados dos blocos), `block-catalog.ts`, `attendance-flows/server/executors.ts` (executores), `route-inbound.ts` (D-3), painéis no editor, modelo do fluxo; em `campaign-handler.ts`, só o `export` do `receiptReplyOf`.

## 8. Plano de testes

Sem runner de teste no projeto (CLAUDE.md, regra 20): verificação manual no WhatsApp oficial, com uma campanha de teste numa empresa de teste, e log `[flowastro]`.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2 | manual | Modelo pronto; um número novo e um inscrito. Conferir `loyalty_campaign_entries` e o evento `consent_accepted`. |
| CA-3, CA-11 | manual | Reenviar a mesma foto; mandar 3 fotos seguidas e conferir `loyalty_receipts` (uma linha por foto). |
| CA-4, CA-5 | manual | Mensagem padrão desligada com variáveis; fluxo sem o Inscrever. |
| CA-6 | manual | Texto, figurinha, foto e PDF na Pergunta "Foto ou arquivo". |
| CA-7, CA-8 | manual | Celular certo e errado; campanha desativada. |
| CA-9 | manual | Inscrito fora de fluxo, "Resposta padrão" ligado, só a foto: cupom cadastrado, log `inbound.campaign_receipt`, sem `flow.started`. |
| CA-10, CA-12 | manual | Número sem FlowAstro: roteiro dos prints. Desligar o fluxo com lead no meio e mandar mensagem. |

## 9. Riscos e rollback

- **D-3 errar o lado**: foto de inscrito abrir fluxo (cupom perdido) ou foto qualquer ir para a campanha (a campanha devolve "não é cupom" e, sem passo pedido, não responde). O primeiro é o risco real; CA-9 cobre.
- **Empresa ligar o FlowAstro no número da promoção antes desta entrega**: a foto do cupom cai no fluxo. Até lá, combinar com o Mercadinho de não ligar fluxo nesse número.
- **Rollback**: desligar o fluxo do FlowAstro no número devolve tudo à IA do funil (CA-12). Os valores do enum ficam (Postgres não remove valor de enum sem recriar o tipo); bloco que sair do catálogo não aparece mais no editor.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-12 | João Gabriel | Criada a partir dos prints da "Campanha 15 anos" do Mercadinho Preço Baixo e da cópia de produção de 2026-11-10. |
| 2026-11-12 | João Gabriel | Revista: um bloco fechado virou blocos de encaixe (Inscrever, Registrar cupom, Consultar), Pergunta "Foto ou arquivo" e modelo pronto; `handleCampaign` não muda (D-4). |
| 2026-11-12 | João Gabriel | Implementada. Inscrever pergunta o nome completo por padrão (RF-2), como a campanha de sempre. Do `campaign-handler.ts` saem só `export`s (`receiptReplyOf`, `SAYS_YES`, `SAYS_NO`, `VALID_NAME`), sem mudar o comportamento. Os CA ainda não passaram pelo teste no WhatsApp. |
| 2026-11-13 | João Gabriel | Testada no WhatsApp: inscrição, cupom recusado (fora do período) e cupom aceito. D-6 e CB-12: foto que não baixa não trava mais o fluxo. |
