---
id: 0085
titulo: Astro identifica o interesse do cliente, marca com tags e dispara o fluxo — e monta esse fluxo a pedido do usuário
dominio: tracking-chat-ai
status: parcial
autor: Weydson
criada: 2026-10-10
atualizada: 2026-10-10
branch: feature/W-form-fichas-proxima-data-20261009
pr: Act962/nasa.ex#453
peso: completa
---

# 0085 — Interesse do cliente, tags e fluxo criado pelo Astro

## 1. Contexto

Ideia do Weydson (10/10/2026), com dois exemplos:

- **Clínica.** Cliente: "Vocês têm algum convênio com ótica?" → interesse em óculos. O Astro envia a lista de parceiros com contato e código de desconto. Tags: ÓCULOS, NOVO LEAD.
- **Centro automotivo.** Cliente: "Vi o anúncio, queria fazer o polimento do meu carro." → interesse em um serviço. O Astro envia o menu de serviços com o agendamento. Tags: POLIMENTO, NOVO LEAD, TRÁFEGO, AGENDAMENTO.

Cada empresa tem um fluxo diferente, e montar esse fluxo tem de ser fácil: o usuário pergunta ao Astro ("qual o melhor fluxo de atendimento para um autônomo de manutenção de ar condicionado?") e o Astro cria o fluxo em **Gatilhos Automáticos**.

### O que já existe (levantado no código)

| Parte da ideia | Situação | Onde |
| --- | --- | --- |
| IA identifica o interesse e coloca a tag | **Pronto.** A IA aplica as tags que têm **descrição** preenchida; a descrição é a regra de quando aplicar | `tracking-chat-ai/server/tools/add-tags-to-lead.ts`, `lib/system-prompt.ts` |
| A tag dispara um fluxo | **Pronto.** Gatilho "lead recebeu tag" | `LEAD_TAGGED`, `tracking-chat-ai/lib/apply-tags-by-ai.ts` |
| Fluxo envia mensagem, botões, lista, agenda, formulário, mídia | **Pronto** | nós `SEND_MESSAGE`, `SEND_AGENDA`, `SEND_FORM` etc. |
| Menu de botões pronto, com tag por botão | **Pronto**, só em número não oficial | `AiButtonPreset`, `send_buttons` |
| Astro cria fluxo em Gatilhos Automáticos a partir de um pedido | **Pronto**, nasce desligado para revisão | `generate_workflow_from_intent`, Construtor rápido |
| Agendamento na conversa | **Em entrega** na spec 0084 | `tracking-chat-ai/server/tools/agenda.ts` |

### O que falta de verdade

1. **O elo entre o fluxo e a IA.** Quando o Astro cria um fluxo, as tags que ele cria nascem **sem descrição**. Sem descrição, a IA do atendimento nunca aplica a tag, e o fluxo nunca dispara. É o principal buraco.
2. **Tag de origem do anúncio.** O sistema já grava que o cliente veio de anúncio (dados do anúncio da Meta e UTM), mas não existe tag automática "TRÁFEGO". "NOVO LEAD" também não é automática.
3. **Lista de parceiros com contato e código de desconto.** Não existe. O Star Friends é programa de **pontos e prêmios** do cliente, não cadastro de convênios.
4. **Menu de botões na API oficial.** Os menus prontos da IA só saem em número não oficial.
5. **Recomendação por tipo de negócio.** O Astro monta um fluxo por pedido, mas não tem um roteiro por segmento nem monta o conjunto completo (tags com descrição + menus + fluxos).

## 2. Objetivo

O usuário descreve o negócio ao Astro e recebe um atendimento montado: as tags de interesse (com a regra de quando aplicar), os menus e os fluxos em Gatilhos Automáticos, tudo **desligado para revisão**. Depois de ligado, o Astro do atendimento reconhece o interesse do cliente, marca as tags e o fluxo certo responde.

### Não-objetivos

- App ou tabela nova de parceiros/convênios (ver RF-7).
- Ligar fluxo sozinho, sem revisão do usuário.
- Mudar o Star Friends.
- Anúncios ou campanhas (Meta Ads, trafeGO).

## 3. Requisitos

### Parte A — fechar o elo (fluxo criado pelo Astro já funciona com a IA)

| ID | Requisito |
| --- | --- |
| RF-1 | Toda tag criada pelo Astro ao montar um fluxo nasce **com descrição**: a frase que diz à IA quando aplicar ("cliente perguntou por óculos, lentes ou convênio com ótica"). |
| RF-2 | O Astro mostra as tags e as descrições no resumo do que criou, e o usuário pode ajustar o texto. |
| RF-3 | A tela de tags explica, junto do campo, que a descrição é o que permite à IA aplicar a tag sozinha. |
| RF-4 | Tag arquivada deixa de ser oferecida à IA (hoje continua). |

### Parte B — tags de origem automáticas

| ID | Requisito |
| --- | --- |
| RF-5 | Cliente que chega por anúncio (dados do anúncio da Meta ou UTM de mídia paga já gravados no lead) recebe a tag **Tráfego** na criação, pelo mecanismo de tags automáticas que já existe (canal, catálogo). Desligável arquivando a tag, como as demais. |
| RF-6 | Tag **Novo lead** aplicada na criação, pelo mesmo mecanismo. |

### Parte C — lista de parceiros

| ID | Requisito |
| --- | --- |
| RF-7 | A lista de parceiros com contato e código de desconto é uma **mensagem de fluxo** (texto ou botões), disparada pela tag de interesse. O usuário edita em Gatilhos Automáticos. Sem cadastro novo. |
| RF-8 | O Astro, ao montar o fluxo de um negócio que tem parceiros, cria esse passo já com o texto de exemplo para o usuário preencher. |

### Parte D — menus na API oficial

| ID | Requisito |
| --- | --- |
| RF-9 | Os menus prontos da IA (`send_buttons`) passam a sair também na API oficial, pelos botões e listas da spec 0079 (até 3 botões ou lista de 10), mantendo a tag por opção. |

### Parte E — o Astro monta o atendimento do negócio

| ID | Requisito |
| --- | --- |
| RF-10 | Pedido do tipo "qual o melhor fluxo de atendimento para [tipo de negócio]?" faz o Astro **propor** um roteiro em texto: interesses a reconhecer, tags, menus e o que cada fluxo faz. Nada é criado ainda. |
| RF-11 | Com o "sim" do usuário, o Astro cria o conjunto no tracking escolhido: tags com descrição, menus e fluxos em Gatilhos Automáticos, **todos desligados**, e mostra o que precisa de revisão (agenda, formulário, textos). |
| RF-12 | O que já existe com o mesmo nome é reaproveitado, não duplicado. |
| RF-13 | Criar fluxos exige a mesma permissão da tela de Gatilhos Automáticos (spec 0082). |

### Parte F — ligar o interesse à Visão do Lead

A Visão do Lead (spec 0035) só lia mensagens, propostas do Forge, ganhos e perdas e a temperatura manual. Pedido do Weydson em 10/10/2026: incluir as quatro ligações.

| ID | Requisito |
| --- | --- |
| RF-14 | **Compras completas:** ficha paga e pedido pago do Catálogo NERP contam em "Compras" e no potencial, sem somar duas vezes com o "ganho" do histórico. |
| RF-15 | **Agendamento conta:** agendamento futuro não cancelado soma 15 pontos no potencial e conta como sinal comercial na confiança do cálculo. |
| RF-16 | **Tag de interesse conta:** cada tag de interesse no lead soma 5 pontos, até 10. Tag de interesse é a tag comum com descrição (a que a IA pode aplicar); as automáticas de canal e de atendimento não contam. |
| RF-17 | A Visão do Lead é recalculada quando: o cliente agenda ou cancela pelo Astro, uma ficha é marcada como paga, um pedido do catálogo é pago, uma tag é aplicada pela IA ou por tag automática. |
| RF-18 | **Gatilhos Automáticos:** o filtro de lead ganha a condição "Interesse do lead" (é exatamente / é pelo menos Baixo, Médio, Alto). Lead sem Visão do Lead calculada não passa no filtro. |
| RF-19 | **Astro da equipe:** "quais leads com interesse alto?" (ou médio, baixo) responde em código, do maior potencial para o menor, com a permissão do Tracking. |

### Segurança

| ID | Requisito |
| --- | --- |
| RS-1 | O Astro do atendimento só aplica tags do catálogo da empresa; não cria tag nem fluxo a pedido do cliente. |
| RS-2 | Texto do cliente nunca vira instrução: "me marque como VIP" não aplica tag nem desconto. |
| RS-3 | Código de desconto só sai se estiver no fluxo que a empresa escreveu. A IA não inventa código, valor nem parceiro. |
| RS-4 | Fluxo criado pelo Astro nasce desligado; ligar é ato do usuário com permissão. |

### Regras da Meta (conferidas em 10/10/2026)

| Regra | Como a spec atende |
| --- | --- |
| Fora da janela de 24 h só template | Os fluxos disparados por tag respondem a uma mensagem do cliente, dentro da janela. Passos com espera longa usam o template reserva que já existe (spec 0077) |
| Categoria do template e opt-in | Lista de parceiros com desconto é oferta: só como **resposta** ao interesse do cliente. Nunca como disparo frio; fora da janela, só por template de marketing e para quem autorizou |
| Qualidade do número | Um fluxo por interesse por conversa; a mesma tag não redispara o mesmo fluxo em seguida |
| Mensagens interativas: 3 botões, lista de 10 | RF-9 respeita os limites da spec 0079 |
| Saúde | Na clínica, o interesse reconhecido é comercial (óculos, convênio, agendar), nunca clínico |

## 4. Critérios de aceite

- [ ] **CA-1** — Fluxo criado pelo Astro com a tag "Óculos": a tag tem descrição, e a conversa "vocês têm convênio com ótica?" faz a IA aplicar a tag e o fluxo disparar.
- [ ] **CA-2** — Cliente que chega por anúncio recebe **Tráfego** e **Novo lead** na criação; cliente que chega sem anúncio recebe só **Novo lead**.
- [ ] **CA-3** — Tag arquivada não é mais aplicada pela IA.
- [ ] **CA-4** — "Queria fazer o polimento do meu carro": tags Polimento e Agendamento, e o cliente recebe o menu de serviços com o caminho para agendar.
- [ ] **CA-5** — Menu pronto da IA chega com botões num número da API oficial, e o clique aplica a tag da opção.
- [ ] **CA-6** — "Qual o melhor fluxo para um autônomo de manutenção de ar condicionado?": o Astro propõe o roteiro sem criar nada; com o "sim", cria tags com descrição, menus e fluxos desligados, e lista o que revisar.
- [ ] **CA-7** — Repetir o pedido não duplica tags nem fluxos.
- [ ] **CA-8** — "Me dá um código de desconto" sem fluxo que o contenha: a IA não inventa código.
- [ ] **CA-9** — Membro sem permissão em Gatilhos Automáticos recebe a recusa da spec 0082.
- [x] **CA-10** — Marcar uma ficha como paga aumenta "Compras" em 1 e o potencial do lead.
- [x] **CA-11** — Agendamento futuro soma 15 no potencial; tag de interesse soma 5, até 10.
- [ ] **CA-12** — Fluxo com o filtro "Interesse é pelo menos Médio" só segue para leads nessa faixa.
- [x] **CA-13** — "Quais leads com interesse alto?" é respondido pela consulta em código.

## 5. Abordagem (o que se reaproveita)

- **RF-1/RF-2:** `findOrCreateTags` e o prompt de geração de fluxo (`workflows`, `BLUEPRINT_GENERATION_PROMPT`): cada tag sugerida já traz um motivo (`reason`), que passa a ser gravado em `Tag.description` e ligado ao tracking. Sem tabela nem coluna nova.
- **RF-4:** filtro `archivedAt` na carga de tags do agente (`tracking-chat-ai/lib/context.ts`).
- **RF-5/RF-6:** `applyInboundAutoTags` (`org-defaults/lib/auto-tags.ts`), lendo os campos que o lead já tem (`metaAdId`, `ctwaClid`, `utm*`).
- **RF-7/RF-8:** nó `SEND_MESSAGE` de sempre.
- **RF-9:** `provider.sendInteractive` (spec 0079) dentro de `send-buttons.ts`, guardando o mesmo mapa botão → tag; o clique na API oficial passa a resolver a tag como já faz na Uazapi.
- **RF-10 a RF-12:** `generate_workflow_from_intent` e o Construtor rápido (`router/workflow/quick-builder.ts`, que já confere duplicados), mais o formato `TrackingPreset`, que já descreve tags com descrição, prompt e fluxos num pacote só.

- **RF-14 a RF-17:** `leads/lib/metrics/compute-lead-metrics.ts` e `purchase-potential.ts` (mesma tabela `lead_metrics`, nenhuma coluna nova) e o pedido de recálculo que já existe (`requestLeadMetricsRecompute`).
- **RF-18:** nó `FILTER_LEAD` (`tracking-executions/components/filter-lead/`).
- **RF-19:** `astro/queries/lead-interest.ts`.

## 6. Ordem de entrega

1. **A** (elo das tags) e **B** (tags de origem): pequenas, e já fazem os dois exemplos funcionarem com fluxos montados à mão.
2. **D** (menus na API oficial).
3. **E** (Astro monta o atendimento) e **C** (passo de parceiros).

## 7. Decisões tomadas sem resposta do Weydson

1. Parceiros como **mensagem de fluxo**, sem cadastro novo. Se virar necessidade recorrente (muitos parceiros, relatório de uso do código), avalia-se um cadastro, de preferência como Ficha.
2. **Tráfego** e **Novo lead** pelo mecanismo de tags automáticas, que hoje só vale para empresas novas; empresas antigas ligam criando a tag.
3. Tudo o que o Astro cria nasce **desligado**.

## 9. Changelog

- 2026-10-10 — criada a partir da ideia do Weydson e do levantamento do que já existe.
- 2026-10-10 — aprovada pelo Weydson, com a Parte F incluída a pedido dele ("pode incluir as 4 na spec e seguir"). **Implementadas as Partes A, B e F. Partes C, D e E não iniciadas.**
  - **A:** tags sugeridas ao gerar um fluxo ganharam `aiDescription` (esquemas em `router/workflow/create-from-blueprint.ts`, `quick-builder.ts` e `astro/server/tools/workflows/index.ts`; instrução no prompt de geração); `findOrCreateTags` grava em `Tag.description` e preenche a descrição de tag reaproveitada que estava vazia, sem trocar a que a empresa escreveu. Tag arquivada sai do catálogo da IA. A tela de tags explica para que serve a descrição. O resumo do Astro com as descrições (RF-2) **não foi feito**: a descrição é gravada, mas o texto de resposta do Astro não a lista.
  - **B:** tags automáticas "Novo lead" e "Tráfego" (`org-defaults/lib/default-org-template.ts`, `auto-tags.ts`), aplicadas nos 10 primeiros minutos do lead; tráfego = dados do anúncio da Meta ou UTM de mídia paga. Empresa nova já nasce com as duas; empresa antiga liga criando a tag com o identificador `novo-lead` ou `trafego`.
  - **F:** conforme a tabela da Parte F. Pesos: agendamento 15; tag de interesse 5 cada, até 10. "Compras" = o maior entre (propostas pagas + fichas pagas + pedidos pagos) e ganhos no histórico.
  - **Verificado** (script contra o banco de desenvolvimento; dados de teste desfeitos): os pesos novos do potencial; ficha paga vira compra (0 → 1) e o potencial do lead de teste foi de 8% para 28% com ficha paga e agendamento; tag de interesse nasce com descrição e a de controle sem; a consulta do Astro por interesse é a que responde.
  - **Não verificado:** a IA aplicando a tag e o fluxo disparando de ponta a ponta (CA-1 completo, CA-4), as tags automáticas numa chegada real de lead (CA-2), tag arquivada (CA-3), o filtro de interesse num fluxo em execução (CA-12), a tela do filtro e a de tags no navegador, e o recálculo automático (depende do Inngest, desligado no ambiente local). A consulta do Astro respondeu "nenhum lead com a Visão do Lead calculada" porque a org de teste não tem métricas gravadas; a lista em si não foi vista.
- 2026-10-10 — segunda rodada ("continue implementando o que falta"). **Implementadas as Partes C, D e E, e o RF-2.**
  - **RF-2:** o retorno da criação de fluxo traz a regra (`aiDescription`) de cada tag criada, com a instrução para o Astro listá-las ao usuário.
  - **D:** `send_buttons` envia os menus prontos pela API oficial (`provider.sendInteractive`, até 10 opções) guardando o mesmo mapa botão → tag; o clique é tratado em `tracking-chat-ai/lib/button-reply-tag.ts`, chamado do caminho comum de entrada só para a API oficial (a Uazapi segue com o tratamento que já tinha). Clique repetido não reaplica a tag.
  - **E e C:** são orientação ao Astro, sem tabela nem ferramenta nova. A descrição de `generate_workflow_from_intent` manda propor o roteiro por tipo de negócio antes de criar e criar um fluxo por vez depois do "sim"; o prompt de geração ganhou o padrão "fluxo que responde a um interesse", com o passo de parceiros como mensagem-modelo marcada para revisão e a proibição de inventar parceiro, contato ou código.
  - **Divergência:** RF-12 (não duplicar) vale para tags, que já eram reaproveitadas; para fluxos, só o Construtor rápido confere duplicados — pelo chat do Astro um segundo pedido igual cria outro fluxo desligado. O envio de menu com botões pelos Gatilhos Automáticos (nó de mensagem) continua só em número não oficial; esta entrega cobre o menu enviado pela IA.
  - **Verificado** (script, dados de teste removidos): o clique aplica a tag da opção, botão sem tag não aplica nada, clique repetido não reaplica, e sem o id da mensagem respondida o menu recente é encontrado.
  - **Não verificado:** o menu chegando com botões num número oficial e o clique real voltando pelo webhook; o Astro propondo o roteiro e criando os fluxos numa conversa real (CA-6, CA-7, CA-8), que é comportamento de IA e só se confirma conversando.

