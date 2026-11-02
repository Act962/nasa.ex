---
id: 0130
titulo: Pedido completo para publicar, prompt para a equipe e aprovação do cliente
dominio: trafego
status: implementada
autor: Weydson Lima (com Claude)
criada: 2026-11-02
atualizada: 2026-11-02
branch: feature/W-trafego-ux-20261031
pr:
peso: completa
---

# 0130 — Pedido completo para publicar, prompt para a equipe e aprovação do cliente

## 1. Contexto

Com a spec 0129, o passo a passo do `/trafego` começa pelo criativo e o Astro preenche os passos seguintes.
Ainda sobram três atritos:

- **O campo "Texto do anúncio" chega vazio.** As sugestões do Astro só aparecem depois que o criativo é
  enviado e analisado. Quem ainda não tem o arquivo, ou quer escrever antes, encara um campo em branco.
- **Falta informação para publicar.** A campanha de WhatsApp precisa também da mensagem que já vem escrita no
  WhatsApp do cliente (mensagem inicial), da cidade ou região e da página. Hoje a equipe descobre o que falta
  depois do pagamento e volta a perguntar ao cliente: é o "leva e traz" que o dono quer acabar.
- **A publicação é manual e sem registro de aprovação.** A equipe monta a campanha à mão. Quando muda algo
  (texto, público, verba), avisa pelo WhatsApp, e não fica registrado que o cliente concordou.

O dono quer que a equipe publique pelo Claude (com o MCP da Meta da própria equipe), colando um prompt pronto,
e que toda recomendação do Claude volte ao cliente pelo painel, com "Precisa de aprovação".

## 2. Objetivo

1. O passo Criativo mostra **textos sugeridos pelo Astro desde o início**, já seguindo as regras da Meta, e um
   **guia curto das regras** ao lado do campo.
2. O pedido sai do passo a passo **completo para publicar**: criativo, texto, título, mensagem inicial do
   WhatsApp, região, público, verba, datas e a orientação do Astro.
3. No admin, o pedido tem **"Copiar prompt para o Claude"**: um texto único que a equipe cola no Claude para
   montar a campanha, sem perguntar nada ao cliente.
4. A equipe envia ao cliente, pelo painel, a recomendação que o Claude fizer. O cartão da campanha mostra
   **"Precisa de aprovação"** até o cliente **aprovar** (a equipe segue com a publicação) ou responder.

### Não-objetivos

- Publicar sozinho, sem pessoa da equipe. O Claude roda no computador da equipe, com o MCP dela.
- Ligar o Claude da equipe ao Órbita por API. O caminho é copiar e colar, de propósito: nada de chave nova.
- Mudar o "Publicar e editar" do painel (spec 0124). Ele continua para quem publica sozinho.
- Cobrar a aprovação ou a recomendação em Stars.

## 3. Requisitos

### Funcionais

- **RF-1 — Textos sugeridos sem esperar o criativo.** Ao abrir o passo Criativo (membro com Meta conectada),
  o Astro sugere **duas opções** de texto e título a partir do negócio, do segmento e dos números da conta
  (spec 0129, RF-3), sem imagem. Quando o criativo chega, a análise refaz as opções olhando a imagem, como
  hoje. A primeira opção entra no campo se ele estiver vazio; o cliente troca à vontade.
- **RF-2 — Regras da Meta junto do campo.** Um guia curto e fixo (não é IA): oferta e convite ao WhatsApp nas
  primeiras linhas; até 125 caracteres antes do "Ver mais"; falar do serviço, nunca da condição de quem lê;
  sem promessa de resultado; sem "antes e depois" em saúde e estética. Os avisos por campo da spec 0129
  continuam.
- **RF-3 — Mensagem inicial do WhatsApp.** Campo novo no passo Criativo: o texto que já aparece escrito quando
  a pessoa toca no botão ("Olá! Vi o anúncio e quero saber da avaliação de catarata"). O Astro sugere junto com
  os textos. Até 160 caracteres.
- **RF-4 — Região obrigatória.** Sem cidade ou região no público, o passo Negócio avisa e não segue: anúncio de
  WhatsApp sem região gasta verba com quem não pode ser atendido. O Astro sugere a cidade do negócio quando a
  conta tem histórico de região.
- **RF-5 — Pedido completo.** O que o cliente escolheu vai para o pedido: a copy selecionada (já acontece), a
  mensagem inicial, o público com região e a orientação do Astro (`creativeDraft.guidance`, já acontece). A
  página e o WhatsApp da página vêm do "Testar conexão" dos Satélites, não do cliente.
- **RF-6 — "Copiar prompt para o Claude" no admin.** Botão no detalhe do pedido (`/admin/trafego/...`), só para
  admin do sistema. Gera, em regra fixa, um texto com:
  - instruções de trabalho: usar a conta `act_…` da integração do cliente, criar **tudo pausado**, campanha de
    mensagens com destino WhatsApp, nome `TG-NNNN — <negócio> — Mensagens`, nunca ativar;
  - os dados: negócio, segmento, página e WhatsApp, objetivo, público (idade, gênero, região, interesses),
    verba total e por dia, datas, texto, título, mensagem inicial, link do criativo (URL assinada de 24 h);
  - a orientação do Astro e os números da conta que ela usou;
  - um pedido final ao Claude: terminar com um bloco **"RECOMENDAÇÕES PARA O CLIENTE"** em linguagem simples,
    ou "Nenhuma" quando não houver.
  Quando falta algo essencial (criativo, texto, região), o botão avisa o que falta em vez de gerar.
- **RF-7 — Enviar recomendação para aprovação.** No admin, a equipe cola o bloco de recomendações num campo e
  envia. Vira uma mensagem do suporte do pedido marcada como **"precisa de aprovação"**, e o cliente recebe a
  notificação que o suporte já envia.
- **RF-8 — "Precisa de aprovação" no painel.** Enquanto houver recomendação sem resposta, o cartão da campanha na
  lista e o topo do detalhe mostram um selo de alerta "Precisa de aprovação". Clicar abre a recomendação com dois
  botões: **"Aprovar"** e **"Responder"** (abre o suporte).
- **RF-9 — Aprovar.** Só dono ou admin da organização aprova. Aprovar grava quem e quando, registra um evento
  visível no histórico do pedido ("Cliente aprovou a recomendação da equipe") e avisa a equipe. O texto do botão
  deixa claro: "Aprovo e autorizo a equipe a seguir com a publicação".
- **RF-10 — Uma recomendação aberta por vez.** Enviar outra substitui a anterior sem resposta (a antiga fica no
  histórico como "substituída").

### Não-funcionais

- **RNF-1 — Sem chave nova.** O prompt não leva token nem segredo; leva só o id da conta.
- **RNF-2 — Custo.** A sugestão de texto sem criativo (RF-1) custa 2 Stars (`trafego_copy_suggestion`); se o
  criativo for analisado depois, a análise cobra as 5 Stars de sempre. Sem saldo, o campo fica com o guia e o
  passo a passo segue.
- **RNF-3 — Sem cron e sem função Inngest.**

## 4. Critérios de aceite

- **CA-1** — Membro com Meta conectada abre o passo Criativo e, sem enviar arquivo, vê duas opções de texto do
  Astro em até ~10 s, e a primeira já está no campo.
- **CA-2** — Nenhuma opção sugerida passa com atributo pessoal ("Você tem…?") ou é reprovada pelo pré-filtro.
- **CA-3** — Sem região no público, o passo Negócio não segue e diz por quê.
- **CA-4** — Pedido criado pelo passo a passo tem copy selecionada, mensagem inicial e região.
- **CA-5** — No admin, "Copiar prompt" de um pedido completo copia um texto com conta, regras, dados, link do
  criativo e o pedido do bloco de recomendações; nada de token.
- **CA-6** — Pedido sem criativo: "Copiar prompt" diz "Falta o criativo" e não copia.
- **CA-7** — Recomendação enviada: o cartão na lista e o detalhe mostram "Precisa de aprovação".
- **CA-8** — Membro comum não vê o botão "Aprovar"; dono aprova; o selo some e o histórico registra quem aprovou.
- **CA-9** — Usuário de outra organização não consegue aprovar passando o id da mensagem.
- **CA-10** — Segunda recomendação enviada sem resposta à primeira: a primeira fica "substituída" e só a nova
  pede aprovação.

## 5. Casos de borda

- **CB-1 — Pedido antigo, sem criativo nem copy no passo a passo.** O prompt sai com o que tiver e lista o que
  falta no topo, para a equipe pedir ao cliente uma vez só.
- **CB-2 — Integração Meta sem página no "Testar conexão".** O prompt diz "página: confirmar no Gerenciador" em
  vez de inventar.
- **CB-3 — Link do criativo expira.** A URL assinada vale 24 h; gerar o prompt de novo gera um link novo.
- **CB-4 — Criativo por link do Instagram.** O prompt leva o link do post e pede para impulsionar o post
  existente, em vez de subir arquivo.
- **CB-5 — Cliente aprova duas vezes (dois cliques, duas abas).** A segunda não faz nada: a aprovação só grava
  quando ainda está pendente.

## 6. Decisões de design

### D-1 — A recomendação é uma mensagem do suporte, não uma tabela nova

O suporte do pedido (`TrafegoSupportMessage`) já é a conversa entre equipe e cliente, com autor, data,
notificação e leitura. A recomendação é uma mensagem dessa conversa que pede resposta. Ganha três colunas:
`requiresApproval` (bool), `approvedAt` e `approvedByUserId`, mais `supersededAt` para a RF-10. Histórico,
notificação e "lido" vêm de graça. Uma tabela `TrafegoProposal` duplicaria tudo isso.

### D-2 — Prompt por regra fixa, não por IA

O texto é montado por uma função pura a partir do pedido. Mesmo pedido, mesmo prompt; dá para testar e não custa
token. Quem pensa é o Claude da equipe, que recebe tudo de uma vez.

### D-3 — Copiar e colar, não integração

Ligar o Órbita ao Claude da equipe exigiria chave, fila e tratamento de erro para um processo que ainda está
sendo desenhado. O copiar e colar valida o fluxo; se virar rotina com volume, a próxima etapa é o Órbita publicar
pelo próprio construtor (spec 0124) ou pelo MCP (spec 0125).

### D-4 — Aprovar é autorização registrada

O botão diz o que autoriza. O registro (quem, quando, qual texto) fica no histórico do pedido: é a prova de que o
cliente concordou com a mudança antes de a equipe publicar.

## 7. Impacto

- **Schema:** 4 colunas em `trafego_support_message` (`requires_approval` padrão `false`, `approved_at`,
  `approved_by_user_id` com `onDelete: SetNull`, `superseded_at`) e índice `(order_id, requires_approval,
  approved_at)`. Mensagens antigas ficam `false`: nada muda para elas.
- **Procedures:**
  - `trafego.creativeReview.suggestCopy` (RF-1);
  - `trafego.admin.orders.buildPublishPrompt` (RF-6, admin do sistema);
  - `trafego.admin.orders.sendForApproval` (RF-7);
  - `trafego.support.approve` (RF-9, dono/admin da org do pedido).
- **Libs:** `lib/publish-prompt.ts` (função pura do prompt), `lib/meta-ad-rules.ts` (guia da RF-2).
- **Telas:** passo Criativo (sugestões, guia, mensagem inicial), passo Negócio (região), admin do pedido
  (copiar prompt, enviar recomendação), cartão e topo do detalhe no painel (selo e aprovação).
- **Stars:** ação nova `trafego_copy_suggestion` (2 Stars) em `src/data/star-rules.ts`.
- **Docs:** `docs/trafego-overview.md` e `docs/trafego-playbook-gestor.md` (como usar o prompt e enviar
  recomendação).

### Segurança de dados

- O prompt é só para admin do sistema e não leva token, segredo nem dado de lead.
- O link do criativo é assinado e expira em 24 h.
- Aprovar confere que a mensagem é de um pedido da organização de quem aprova e que a pessoa é dona ou admin
  (CA-9).

### Regras da Meta

- Textos sugeridos passam pelo pré-filtro de políticas antes de aparecer (atributos pessoais, promessas,
  saúde).
- O prompt manda criar tudo **pausado** e nunca ativar: quem ativa é a equipe, depois da aprovação do cliente.
- Mensagem inicial curta e neutra, sem dado sensível.

## 8. Plano de testes

- `scripts/trafego-0130-qa-check.ts`: prompt completo (CA-5), prompt sem criativo (CA-6), pedido antigo (CB-1),
  link do Instagram (CB-4), sem token no texto.
- No navegador, logado: CA-1, CA-3, CA-7 e CA-8.

## 9. Riscos e rollback

- **Equipe esquece de enviar a recomendação.** Mitigação: o prompt termina pedindo o bloco, e o admin mostra o
  campo de envio logo abaixo do botão de copiar.
- **Cliente não aprova e a campanha trava.** Mitigação: o selo fica no cartão e a notificação do suporte avisa;
  a equipe vê no admin quantos dias a aprovação está parada.
- **Rollback:** as colunas novas têm padrão e não mudam mensagens antigas; tirar os botões volta ao fluxo de hoje.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-11-02 | Weydson Lima (com Claude) | Criação. |
| 2026-11-02 | Weydson Lima (com Claude) | Aprovada com ajuste do dono: os textos não aparecem sozinhos; o botão **"Gere com IA"** surge quando o criativo ou o link é adicionado (`trafego.creativeReview.suggestCopy`, 2 Stars) e devolve duas opções e a mensagem inicial. A análise do criativo deixou de gerar texto (só objetivo, tipo e público). |
| 2026-11-02 | Weydson Lima (com Claude) | Implementada. Divergências: (1) **D-1 mudou**: as mensagens novas do suporte vão para a conversa do lead e `TrafegoSupportMessage` ficou como legado, então a recomendação é um **evento do histórico do pedido** (`TrafegoOrderEvent`) com as 4 colunas (`requires_approval`, `approved_at`, `approved_by_user_id`, `superseded_at`) — o histórico já é o registro visível ao cliente; (2) a mensagem inicial fica no rascunho do briefing (`creativeDraft.initialMessage`), sem coluna nova; (3) região: sem sugestão do Astro (a conta não tem quebra por cidade no resumo); o formulário abre sozinho quando falta; (4) prompt: só criativo e texto barram; região, mensagem inicial e página entram como "Falta confirmar com o cliente" (une CA-6 e CB-1); (5) "avisa a equipe" ao aprovar = evento "Cliente aprovou…" no histórico, visível no admin; o cliente é avisado por WhatsApp quando a recomendação chega. |
| 2026-11-02 | Weydson Lima (com Claude) | IA de reserva: análise do criativo, "Gere com IA" e correção de anúncio escolhem o modelo em `server/lib/review-model.ts`. Principal: Claude Haiku (chave da agência ou `ANTHROPIC_API_KEY`). Sem chave da Anthropic: `gpt-4.1-mini` da OpenAI (chave da agência nos Satélites ou `OPENAI_API_KEY`). Nunca a chave da empresa cliente, porque o uso é cobrado em Stars. O uso fica registrado com o provedor real. |
| 2026-11-02 | Weydson Lima (com Claude) | A checagem de política do texto do pedido (`compliance-check.ts`) passou a usar o mesmo modelo (`review-model.ts`): Claude Haiku ou, sem chave da Anthropic, a OpenAI de reserva. O que as regras fixas já marcaram não se repete pela IA. |
