---
id: 0074
titulo: Publicar o mesmo conteúdo em várias contas do Instagram
dominio: nasa-planner
status: implementada
autor: João Gabriel
criada: 2026-10-07
atualizada: 2026-10-07
branch: feature/nasa-planner-varias-contas-e-limpeza-20261007
pr: # preenchido no /ship
peso: completa
---

# 0074 — Publicar o mesmo conteúdo em várias contas do Instagram

> Depende das specs [0057](0057-publicacao-confiavel-e-stories.md) (fluxo único de
> publicação), [0058](0058-planner-v2-calendario-aprovacao-multicliente.md)
> (aprovação), [0070](0070-kits-da-marca-por-conta.md) (kit da marca por conta) e
> [0071](0071-planner-publica-pelas-contas-dos-satelites.md) (contas dos Satélites).

---

## 1. Contexto

Uma empresa pode ter várias contas do Instagram conectadas nos Satélites (spec
0071), mas cada post do Planner sai em **uma** conta só: `targetIgAccountId`
guarda um único id, e o resultado da publicação mora na própria linha do post
(`externalIgPostId`, `externalIgPermalink`, `publishError`, `metrics*`).

Quem cuida de duas ou mais contas da mesma empresa (matriz e filiais, marca e
perfil do fundador) cria hoje o mesmo post N vezes, envia mídia N vezes, pede
aprovação N vezes e programa N vezes.

A leitura do código também achou dois defeitos que a multi-conta agrava:

1. **O criador mostra uma conta e grava outra coisa.** Em
   `composer-script-step.tsx`, quando o post não tem conta, a tela destaca a
   primeira (`values.targetIgAccountId ?? igAccounts[0]?.igUserId`), mas o
   criador salva `targetIgAccountId: undefined`. Com duas contas, o post sai sem
   conta e a publicação é recusada com "Este cliente tem mais de uma conta do
   Instagram".
2. **A conta só é conferida na hora de publicar.** `validatePostForPublishing`
   checa formato, não conta. Um post sem conta gravada, programado quando a
   empresa tinha uma conta só, falha no horário se alguém conectar a segunda
   conta nesse intervalo.

Limites da Meta que definem o desenho (não dependem do nosso código):

- Não há chamada que publique em várias contas: é um container e uma publicação
  por conta. O container pertence à conta que o criou e não é reaproveitado.
- Cada conta gera um post próprio no Instagram, com link, métricas e comentários
  separados.
- Reels e vídeos são processados por conta: não dá para garantir o mesmo segundo.

## 2. Objetivo

Ao criar um conteúdo no Planner, a pessoa escolhe uma ou mais contas do
Instagram da mesma empresa; o conteúdo é criado, aprovado e programado uma vez e
sai em todas as contas escolhidas, com o resultado de cada conta visível e
recuperável em separado.

### Não-objetivos

- **Contas de empresas diferentes no mesmo grupo.** Cruza permissões e kits de
  clientes distintos. Fica para depois.
- **Várias páginas do Facebook.** O Facebook segue com uma página por conteúdo
  (ver D-5).
- **Post em colaboração (Collab)**, que é um post só aparecendo em dois perfis.
  É outra funcionalidade.
- **Somar métricas das contas num número único.** Cada conta mostra as suas; a
  soma fica para a Fase 5 do roadmap (métricas).
- **Copiar a automação do Comments entre contas.** Cada conta configura a sua no
  passo Programação, como hoje.
- **Mudar o fluxo de publicação** (`publish-workflow.ts`) ou onde o resultado é
  gravado.
- **Planner antigo** (`/nasa-planner/[plannerId]`): continua com uma conta por post.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | No criador (passo Roteiro), as contas do Instagram do cliente viram seleção múltipla. Com uma conta escolhida, nada muda em relação a hoje. |
| RF-2 | Com duas ou mais contas, o servidor cria um **grupo**: um post por conta ("irmãos"), todos com o mesmo `publishGroupId`, a mesma empresa, o mesmo tipo e o mesmo conteúdo (título, roteiro, objetivo, CTA, legenda, hashtags, pilar, momento, horário pretendido, slides e mídias). A criação é uma transação só com escritas de banco. |
| RF-3 | Num rascunho já existente, marcar mais contas cria os irmãos que faltam copiando o conteúdo atual; desmarcar uma conta apaga o irmão dela, desde que ele não esteja publicando nem publicado. |
| RF-4 | Editar o conteúdo de um irmão aplica a mesma mudança aos demais irmãos **em sincronia** (padrão). Vale para os campos de RF-2 e para toda procedure de mídia (imagem, slides, vídeo, capa). |
| RF-5 | A pessoa pode marcar um irmão como **"diferente nesta conta"**. A partir daí ele não recebe nem envia mudanças de conteúdo; continua no grupo para aprovação, programação e calendário. Dá para voltar a sincronizar: o irmão recebe de novo o conteúdo do grupo. |
| RF-6 | Irmão publicado ou publicando nunca é alterado por mudança vinda do grupo. |
| RF-7 | **Aprovação por grupo**: enviar para aprovação, aprovar e pedir ajustes agem sobre todos os irmãos que estão no status que a ação aceita. O histórico (`NasaPlannerPostReview`) continua uma linha por post. |
| RF-8 | O checklist da marca roda **por conta**, com o kit de cada conta (spec 0070). A tela de revisão mostra o resultado de cada conta e não deixa esconder uma conta reprovada atrás de outra aprovada. |
| RF-9 | Quem precisa agir recebe **um** aviso por grupo (sino, push e WhatsApp da spec 0064), não um por conta. Responder SIM no WhatsApp aprova o grupo. |
| RF-10 | Programar, reprogramar, desprogramar e "publicar agora" a partir de um irmão oferecem **"todas as contas"** (padrão) ou **"só esta"**. Cada irmão é programado pelo caminho atual (`schedulePlannerPost`), com a sua `scheduleVersion`. |
| RF-11 | Ao programar o grupo, a pessoa pode escolher um intervalo entre contas, de 0 a 30 minutos (padrão 0). O irmão de ordem _n_ sai em `horário + n × intervalo`. |
| RF-12 | Cada irmão publica, falha e tenta de novo sozinho. A falha de uma conta não muda o status das outras. "Tentar de novo" age só no irmão que falhou. |
| RF-13 | **Stars por conta publicada**: cada irmão publicado cobra `planner_post_publish` uma vez, como hoje. Antes de programar ou publicar, a tela informa quantas publicações serão cobradas. |
| RF-14 | No calendário (Semana, Mês, Kanban, Roteiro e agenda do celular), irmãos do mesmo grupo com o mesmo status e o mesmo dia aparecem como **um cartão** com o selo "N contas". Status ou dias diferentes separam os cartões. Com o filtro **Conta** ligado, aparece só o irmão da conta filtrada. |
| RF-15 | Abrir um cartão de grupo mostra as contas com o status de cada uma (programado, publicado com link, falhou com o motivo) e leva ao irmão escolhido. |
| RF-16 | Apagar um irmão pergunta "só esta conta" ou "todas as contas". Apagar todas não remove irmão publicado ou publicando. |
| RF-17 | O MCP (`create_draft`) e o Astro aceitam uma lista de contas e criam o grupo com as mesmas regras. Continuam sem aprovar, programar ou publicar. |
| RF-18 | **Correção de base**: o criador grava a conta que mostra como escolhida. Empresa com uma única conta ativa grava essa conta em todo post novo do Instagram, por qualquer origem (tela, Astro, WhatsApp, MCP). |
| RF-19 | **Correção de base**: programar e "publicar agora" recusam, já no pedido, post do Instagram cuja conta não está definida, não está mais conectada, está desativada ou não tem permissão de publicar — com as mesmas mensagens de `instagram-channels.ts`. |
| RF-20 | Um grupo tem de 2 a 10 contas, sem conta repetida. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Post sem grupo (`publishGroupId` nulo) se comporta exatamente como antes desta spec, em todas as telas e procedures. |
| RNF-2 | `publish-workflow.ts`, `resolve-targets.ts` e as funções do Inngest não mudam. |
| RNF-3 | Regra 18 do CLAUDE.md: criar o grupo, propagar conteúdo e aprovar o grupo fazem só escritas de banco dentro da transação; avisos, Inngest e Pusher saem depois do commit. |
| RNF-4 | Um grupo de 10 contas programado para o mesmo minuto publica todas as contas sem intervenção, respeitando o limite de 3 execuções simultâneas por empresa da função de publicação. |
| RNF-5 | Toda leitura e escrita de grupo confere a permissão pela empresa do post (`assertPostAccess`), como nas procedures atuais. |
| RNF-6 | Chamadas oRPC novas ficam em hooks (regra 9); botões novos ganham âncora de guia (regra 21). |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado um cliente com 3 contas ativas, quando crio um Reel escolhendo as 3, então existem 3 posts com o mesmo `publishGroupId`, um por conta, com legenda, hashtags e mídia iguais.
- [ ] **CA-2** — Dado um cliente com 3 contas, quando crio um post escolhendo 1, então existe 1 post com `publishGroupId` nulo e a conta escolhida gravada.
- [ ] **CA-3** — Dado um grupo de 3 em rascunho, quando troco a legenda em um irmão, então os outros 2 têm a legenda nova.
- [ ] **CA-4** — Dado um grupo de 3 com um irmão marcado "diferente nesta conta", quando troco a legenda em outro irmão, então o irmão diferente mantém a legenda dele; e quando troco a legenda do irmão diferente, os outros 2 não mudam.
- [ ] **CA-5** — Dado um grupo com um irmão publicado, quando edito o conteúdo de outro irmão, então o publicado não muda.
- [ ] **CA-6** — Dado um grupo de 3 em rascunho, quando envio para aprovação, então os 3 ficam "Aguardando aprovação" e o aprovador recebe 1 aviso.
- [ ] **CA-7** — Dado um grupo aguardando aprovação, quando aprovo, então os 3 ficam aprovados e cada um tem a sua linha no histórico.
- [ ] **CA-8** — Dado um grupo em que a legenda usa uma palavra proibida só no kit da conta B, quando abro a revisão, então a conta B aparece com o item reprovado e as outras não.
- [ ] **CA-9** — Dado um grupo aprovado, quando programo "todas as contas" para 10:00 com intervalo de 5 minutos, então os irmãos ficam programados para 10:00, 10:05 e 10:10.
- [ ] **CA-10** — Dado um grupo programado em que a conta B perde o token, quando chega o horário, então A e C ficam "Publicado" com link e B fica "Falhou" com o motivo; "Tentar de novo" em B não republica em A nem em C.
- [ ] **CA-11** — Dado um grupo de 3 publicado, então há 3 cobranças de `planner_post_publish`; dado um grupo em que 1 falhou, então há 2.
- [ ] **CA-12** — Dado um grupo de 3 programado para o mesmo dia, quando abro a Semana, então vejo 1 cartão com "3 contas"; quando ligo o filtro Conta em A, vejo o cartão do irmão de A.
- [ ] **CA-13** — Dado um rascunho com a conta A, quando marco também a conta B no criador, então surge o irmão de B com o mesmo conteúdo; quando desmarco B, o irmão de B é apagado e o post de A segue existindo.
- [ ] **CA-14** — Dado um post do Instagram sem conta num cliente com 2 contas, quando tento programar, então recebo "Este cliente tem mais de uma conta do Instagram…" e o post não muda de status.
- [ ] **CA-15** — Dado um cliente com 2 contas, quando crio um post no criador sem tocar no seletor, então a conta que a tela mostra marcada é a que fica gravada.
- [ ] **CA-16** — Dado um post criado antes desta spec, quando o edito, envio, aprovo, programo e publico, então tudo funciona como antes.
- [ ] **CA-17** — Dado o MCP com 2 contas informadas em `create_draft`, então o grupo é criado; com conta que não é do cliente, a chamada é recusada sem criar nada.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Conta escolhida é desconectada depois de criado o grupo | O irmão dela continua existindo; programar o grupo recusa esse irmão (RF-19) com a mensagem da conta e programa os demais, informando quais ficaram de fora. |
| CB-2 | Duas pessoas editam irmãos diferentes do mesmo grupo ao mesmo tempo | Vale a última escrita, como hoje num post só. A propagação copia o conteúdo do irmão editado por último. |
| CB-3 | Edição em irmão aprovado ou programado | Todo irmão em sincronia que recebeu a mudança volta a rascunho e sai do horário (`reopenPostAfterEdit`), com a linha "Editado depois de aprovado" no histórico de cada um. |
| CB-4 | Aprovar grupo em que um irmão já está aprovado | O já aprovado recebe só comentário (regra atual, spec 0058 CB-6); os demais são aprovados. |
| CB-5 | Pedir ajustes num grupo com irmão programado | O irmão programado é desprogramado e todos ficam "Ajustes pedidos". Irmão publicado não muda. |
| CB-6 | Programar grupo com irmãos em status diferentes (um aprovado, um rascunho) com aprovação obrigatória | Programa os que podem; devolve a lista dos que não puderam e o motivo. Nada é programado pela metade dentro de um irmão. |
| CB-7 | Intervalo entre contas empurra um irmão para depois de um Story expirar ou para outro dia | Aceito: o irmão aparece no dia dele no calendário, em cartão separado (RF-14). |
| CB-8 | Grupo reduzido a um irmão (os outros foram apagados) | O irmão restante vira post comum: `publishGroupId` volta a nulo. |
| CB-9 | Desmarcar no criador a conta de um irmão já publicado | A conta aparece travada no seletor, com "já publicado nesta conta". |
| CB-10 | Mesma conta escolhida duas vezes (chamada direta ou MCP) | Recusado na validação de entrada (RF-20). |
| CB-11 | Mais de 10 contas | Recusado com mensagem clara (RF-20). |
| CB-12 | Trocar o tipo (ex.: Feed → Reel) num irmão | Propaga aos irmãos em sincronia; irmão "diferente" mantém o tipo dele (o grupo deixa de exigir tipo igual depois de criado). |
| CB-13 | Kit da marca incompleto em uma das contas | "Gerar com o Astro" usa o kit da conta do irmão aberto; a regra de kit incompleto vale por irmão, como hoje. |
| CB-14 | Conteúdo com Facebook marcado e 3 contas do Instagram | Só o primeiro irmão leva a rede Facebook (D-5); os outros saem só no Instagram. |
| CB-15 | Post antigo sem conta gravada, já programado, em cliente que ganhou a 2ª conta | Não é corrigido por migration: falha no horário como hoje, com a mensagem de escolher a conta. A lista desses posts sai num script de conferência antes do deploy (seção 9). |
| CB-16 | Remover a mídia de um irmão em sincronia | Remove dos demais em sincronia. O arquivo no armazenamento não é apagado (as procedures de remoção só limpam a referência), então irmão "diferente" que usa o mesmo arquivo não quebra. |
| CB-17 | Metas de cadência e contadores do Dashboard | Contam publicações: um grupo de 3 conta 3. Ver pergunta em aberto P-1. |

## 6. Decisões de design

### D-1 — Um post por conta, ligados por grupo

- **Escolha**: escolher N contas cria N linhas em `NasaPlannerPost` com o mesmo `publishGroupId`.
- **Alternativas descartadas**: uma tabela de destinos (`post` = conteúdo, `destino` = conta + resultado). É o modelo mais limpo, mas obriga a tirar do post o id externo, o link, o erro, o status e as métricas — cerca de 24 arquivos leem esses campos — e a reescrever o fluxo de publicação, que acabou de estabilizar e ainda depende do App Review da Meta.
- **Consequência**: o fluxo de publicação, as métricas, os comentários, a automação do Comments e o kit por conta funcionam sem mudança, porque já são por post. O custo é manter o conteúdo dos irmãos igual (D-2).

### D-2 — Sincronia por cópia, com saída explícita

- **Escolha**: depois de cada escrita de conteúdo, uma função única do servidor copia os campos e os slides do irmão editado para os irmãos em sincronia. Um campo booleano no post marca o irmão "diferente nesta conta".
- **Alternativas descartadas**: (a) guardar o conteúdo num registro compartilhado — volta ao problema da D-1; (b) perguntar "aplicar a todas?" a cada edição — cansa e gera grupos meio sincronizados sem ninguém saber quais.
- **Consequência**: toda procedure que escreve conteúdo ou mídia precisa chamar a função de sincronia. É o ponto mais fácil de esquecer: o script de conferência cobre cada procedure (seção 8).

### D-3 — Grupo é só um id, sem tabela própria

- **Escolha**: `publishGroupId` é um cuid gerado na criação, sem model `Group`.
- **Alternativas descartadas**: tabela de grupo com dono, nome e contadores. Hoje não há nenhum dado que pertença ao grupo e não aos posts.
- **Consequência**: migration de duas colunas e um índice. Se o grupo ganhar dado próprio (ex.: intervalo padrão), a tabela entra depois sem quebrar nada.

### D-4 — Aprovação por grupo, cobrança por conta

- **Escolha**: definido pelo dono do produto em 2026-10-07. Uma ação aprova todos os irmãos; cada publicação cobra as suas Stars.
- **Alternativas descartadas**: aprovação por conta (N cliques para o mesmo conteúdo) e cobrança por grupo (exigiria mexer no ponto de cobrança dentro do fluxo de publicação e decidir quem paga quando só parte publica).
- **Consequência**: a cobrança não muda de lugar. A aprovação em grupo não dispensa o checklist por conta (RF-8).

### D-5 — Facebook fica em um irmão só

- **Escolha**: se o conteúdo também vai para o Facebook, só o primeiro irmão leva a rede Facebook e a página.
- **Alternativas descartadas**: todos os irmãos com Facebook — a mesma página receberia o post N vezes.
- **Consequência**: várias páginas do Facebook ficam fora desta spec. Quando entrarem, seguem o mesmo desenho de irmãos.

### D-6 — Conferir a conta ao programar, não só ao publicar

- **Escolha**: `loadSchedulablePost` passa a resolver a conta do Instagram (`resolveInstagramTarget`) e recusa o pedido se ela não serve.
- **Alternativas descartadas**: deixar como está e confiar no aviso de falha. Com grupos, uma conta mal definida viraria falha silenciosa no meio de várias publicações certas.
- **Consequência**: a conferência no horário de publicar continua (a conta pode cair depois de programado).

### Perguntas em aberto

- **P-1** — Um grupo de 3 conta 3 nas metas de cadência e nos contadores do Dashboard (comportamento natural, adotado aqui) ou deveria contar 1?
- **P-2** — Não medi se o Instagram reduz o alcance de conteúdo idêntico em contas diferentes. Vale um teste com contas reais antes de divulgar a funcionalidade; o intervalo entre contas (RF-11) e o "diferente nesta conta" (RF-5) existem em parte por isso.

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`)
- [x] Procedures oRPC (contrato de entrada/saída)
- [ ] Realtime (Pusher / event-bus)
- [ ] Automações (Inngest)
- [ ] Env vars novas
- [ ] Breaking change para clientes existentes
- [x] Documentação obrigatória (`docs/nasa-planner-overview.md`)

**Schema** — em `NasaPlannerPost`, só aditivo:

| Campo | Tipo | Papel |
| --- | --- | --- |
| `publishGroupId` | `String?` (`publish_group_id`), com índice | Liga os irmãos. Nulo = post comum. |
| `isGroupContentDetached` | `Boolean @default(false)` (`is_group_content_detached`) | "Diferente nesta conta" (RF-5). |

**Servidor** (`src/features/nasa-planner/server/`):

- `publish-group.ts` (novo): criar grupo, adicionar e remover irmão, sincronizar conteúdo, listar irmãos, desfazer grupo de um (CB-8).
- `approval.ts`: enviar, aprovar e pedir ajustes por grupo; um aviso por grupo.
- `scheduling.ts`: conferência da conta (RF-19) e programação do grupo com intervalo.

**Procedures** (`src/app/router/nasa-planner/`):

- `posts.createForClient`: aceita `targetIgAccountIds` (1 a 10). `targetIgAccountId` continua aceito.
- `posts.update` e as procedures de mídia (`uploadImage`, `updateSlide`, `addSlidesBatch`, `removeSlide`, `removeMedia`, `attachVideo`, `addVideoClip`, `saveEditedVideo`) e de geração (`generate`, `generateImage`, `generatePostImage`, `generateImageFromReference`, `generateVideoClip`): chamam a sincronia. A lista final sai da implementação: vale para toda procedure que grava conteúdo ou mídia do post.
- Novas: `posts.group.get`, `posts.group.setAccounts`, `posts.group.setDetached`.
- `posts.schedule`, `posts.unschedule`, `posts.publishNow`, `approval.*`, `posts.delete`: ganham o alcance (`scope: "group" | "post"`).
- `calendar.posts`, `calendar.board`, `calendar.drafts`: devolvem `publishGroupId`.

**Telas** (`components/v2/`): seletor de contas em `composer-script-step`; contas e checklist por conta em `review-panel`; alcance e intervalo em `composer-schedule-step`; cartão de grupo em `calendar-post-chip`, `kanban-view`, `script-table-view` e `mobile-agenda`.

**Fora do Planner**: `planner-mcp-tools.ts` (MCP), `astro/server/tools/planner` (Astro) e a aprovação pelo WhatsApp (`approval-whatsapp.ts`).

**Inngest**: nenhuma função muda. Cada irmão dispara o evento de programação que já existe.

## 8. Plano de testes

O projeto não tem runner de teste instalado (CLAUDE.md, item 20). Como nas specs
0070 e 0071, os critérios viram asserções num script de conferência
(`scripts/planner-publish-group-qa-check.ts`), cada uma citando o `CA-n`.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1, CA-2, CA-13, CA-17 | script | Cria por função do servidor e confere as linhas e o `publishGroupId`. |
| CA-3, CA-4, CA-5 | script | Edita por **cada** procedure de conteúdo e de mídia e compara os irmãos (cobre a D-2). |
| CA-6, CA-7, CA-8 | script | Status, linhas de histórico, quantidade de avisos e checklist por kit. |
| CA-9, CA-14 | script | Horários gravados por irmão; recusa sem mudança de status. |
| CA-11 | script | Conta as cobranças com a publicação simulada (publicador falso). |
| CA-16 | script + manual | Roteiro completo num post sem grupo, antes e depois. |
| CA-10 | manual | Duas contas reais; revogar o token de uma antes do horário. |
| CA-12, CA-15 | manual | Semana, Mês, Kanban, Roteiro e celular. |

`pnpm guides:check` precisa passar com as âncoras novas.

## 9. Riscos e rollback

- **Procedure de conteúdo que não chama a sincronia** deixa irmãos diferentes sem ninguém perceber. Mitigação: uma função única, chamada em todas, e o script que edita por cada uma delas.
- **Sincronia sobrescreve trabalho** de quem ajustou a legenda numa conta sem marcar "diferente". Mitigação: a marcação fica visível no criador sempre que o post está em grupo.
- **RF-19 passa a recusar pedidos que hoje são aceitos** (e falhariam no horário). É o efeito desejado, mas muda o momento do erro. Antes do deploy, rodar a conferência que lista posts programados do Instagram sem conta gravada em empresas com mais de uma conta (CB-15) e avisar os donos.
- **Custo de Stars multiplicado** sem a pessoa notar. Mitigação: o aviso de quantas publicações serão cobradas (RF-13).
- **Fila de publicação**: um grupo de 10 no mesmo minuto ocupa a empresa por alguns minutos (limite de 3 simultâneas). Posts de outros clientes não são afetados, porque o limite é por empresa.
- **Alcance reduzido por conteúdo repetido** (P-2): risco de produto, não medido.

**Rollback**: a migration só adiciona duas colunas e um índice, e é reversível.
Voltar o código deixa os irmãos como posts comuns, válidos e publicáveis um a
um: nada fica preso. As duas correções de base (RF-18 e RF-19) podem ir em PR
separado, antes do grupo, e não dependem dele.

**Ordem sugerida de entrega**: (1) RF-18 e RF-19; (2) schema, grupo no servidor
e criador; (3) aprovação e programação por grupo; (4) calendário; (5) MCP,
Astro e WhatsApp.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-10-07 | João Gabriel | Criada. Stars por conta e aprovação por grupo definidas pelo dono do produto. |
| 2026-10-07 | João Gabriel | Implementada na mesma branch da limpeza do Planner. Diferenças em relação ao texto: (1) o alcance da aprovação é `"group"` por padrão no servidor, então tela, MCP, Astro e WhatsApp aprovam o grupo sem mudança de chamada; em programar/publicar o padrão segue `"post"` e a tela envia `"group"`; (2) arrastar um cartão de grupo no calendário reprograma todas as contas para o mesmo horário, sem intervalo; (3) o aviso de cobrança (RF-13) aparece só quando há grupo; (4) transcrição e linha do tempo do editor de vídeo não entram na sincronia — só os campos de conteúdo, a mídia e os slides; (5) MCP e Astro recebem as contas pelo @, não pelo id; (6) o script de conferência cobre CA-1 a CA-8, CA-13, CA-14, CA-17 e os casos de borda de criação, e passou com 35 asserções no banco local; CA-9 a CA-12, CA-15 e CA-16 seguem manuais. |
