# Comments e Planner pela conexão da Meta — o que falta para produção

> Checklist para o dono do app de produção da Meta (`985831321038815`, João). Objetivo: o cliente conecta a Meta **uma vez** nos Satélites e ganha publicação no Planner **e** comentários automáticos, sem token, chave ou webhook para configurar.
> Specs: [0057](../specs/nasa-planner/0057-publicacao-confiavel-e-stories.md) (publicar) e [0061](../specs/comments/0061-comments-conectar-pela-meta.md) (Comments). Teste local: [nasa-planner-teste-local-meta.md](nasa-planner-teste-local-meta.md).

## O que o cliente final precisa (só isto)

1. Instagram **profissional** (Empresa ou Criador) ligado a uma **Página do Facebook** que ele administra.
2. Conectar a Meta em **Satélites → Meta** (login do Facebook, marcando a página e o Instagram).
3. Comments: clicar **Usar @conta** em `/comments` (ou no painel "Comentários automáticos" do post no Planner).

Nada de criar app, gerar token, copiar chave secreta ou configurar webhook.

Depois de conectado, quem comenta ou manda DM vira conversa no **tracking-chat** (spec 0062), no tracking escolhido em Comments → Integrações.

## O que já está implementado ✅

| Item | Onde |
| --- | --- |
| Token por página guardado cifrado (`MetaPublishAccount`) | `oauth-finalize.ts` → `upsertPublishAccounts` |
| Publicar feed, carrossel, Story e Reel (Instagram e página) | `src/features/nasa-planner/server/publishing/` + Inngest `nasa-planner/post.*` |
| Comments conectado pelo token da página (`authMode: META_LOGIN`) | `src/features/social-accounts/server/meta-login-channel.ts` |
| Resposta privada (DM com botão) e resposta pública ao comentário | `src/modules/social/infra/instagram/meta-login-channel-gateway.ts` |
| Webhook único `/api/social/webhook/meta` (verify token + assinatura do app) | `src/app/api/social/webhook/meta/route.ts` |
| Webhook antigo do Instagram também entrega ao Comments | `src/app/api/integrations/instagram/webhook/route.ts` |
| Reconectar a Meta atualiza o token do Comments | `refreshMetaLinkedCommentsChannel` |
| Testado de ponta a ponta no app de teste (feed, Story, Reel, Comments) | 2026-10-04, @weydsonlima |

## O que o dono do app de produção faz (uma vez)

### 1. Permissões com Acesso Avançado (App Review)

| Permissão | Para quê | Já pedida no login? |
| --- | --- | --- |
| `instagram_content_publish` | Planner publicar no Instagram | só com `META_PUBLISH_SCOPES_ENABLED=true` |
| `pages_manage_posts` | Planner publicar na página | só com a flag acima |
| `instagram_manage_comments` | Comments e seção Comentários do Planner: ler, responder em público, ocultar e apagar | só com a flag acima |
| `instagram_manage_messages` | Comments: DM / resposta privada | sim |
| `pages_manage_metadata` | inscrever a página nos eventos (webhook) | sim |
| `pages_messaging` | DM pela página | sim |
| `instagram_basic`, `pages_show_list`, `pages_read_engagement` | ler contas | sim |

Sem Acesso Avançado, só quem tem papel no app (admin, desenvolvedor, testador) consegue usar — é o "modo de teste".

### 2. Webhook do Instagram no app (**uma URL para todos os clientes**)

Painel do app → **Webhooks** (ou caso de uso do Instagram → Configurar webhooks) → objeto **Instagram**:

- **URL de callback**: `https://<domínio de produção>/api/social/webhook/meta`
  - Se o app **já** tiver uma URL no objeto Instagram apontando para `/api/integrations/instagram/webhook` (DM vira lead), **pode manter** — ela também entrega ao Comments. Só não dá para ter as duas: a Meta aceita uma URL por objeto.
- **Verify token**: o valor de `META_WEBHOOK_VERIFY_TOKEN` do ambiente de produção.
- **Campos assinados**: `comments` **e** `messages`.

### 3. Variáveis de ambiente de produção

| Variável | Valor |
| --- | --- |
| `META_APP_SECRET` | App Secret do app de produção (já existe) |
| `META_WEBHOOK_VERIFY_TOKEN` | aleatório, 32+ caracteres (`openssl rand -hex 24`). Se já existir, reutilize — é o mesmo da URL antiga |
| `META_PUBLISH_SCOPES_ENABLED` | `true` **só depois** da aprovação do App Review |

### 4. Depois do deploy

1. **Resync** no Inngest Cloud (funções novas do Planner).
2. Pedir aos clientes que **reconectem a Meta** nos Satélites — o token antigo não tem as permissões novas.
3. Conferir num cliente: `/comments` mostra **Usar @conta**; conectar; comentar a palavra-chave num post com outra conta; ver a DM e a resposta em **Comments → Execuções**.

## Erros conhecidos e a saída

| Sintoma | Causa | Saída |
| --- | --- | --- |
| Botão **Usar @conta** não aparece | Empresa sem Instagram na conexão da Meta, ou conectou antes da spec 0057 | Reconectar a Meta nos Satélites marcando o Instagram |
| Aviso "A plataforma ainda não recebe comentários pela Meta" | Falta `META_APP_SECRET` ou `META_WEBHOOK_VERIFY_TOKEN` no ambiente | Passo 3 |
| Conecta, mas nenhum comentário dispara | Webhook do objeto Instagram não configurado ou sem o campo `comments` | Passo 2 |
| Webhook verificado, mas nenhum evento real chega | App **não publicado** (modo desenvolvimento): a Meta só envia webhooks de teste do painel | Publicar o app (o de produção já é publicado) |
| Dispara só para comentários de quem tem papel no app | App sem Acesso Avançado (modo de teste) | Passo 1 |
| DM sai, resposta pública falha com erro de permissão | Falta `instagram_manage_comments` no token | Aprovar no App Review, ligar a flag, cliente reconecta |
| Canal fica "Reconectar" | Token da página invalidado (senha trocada, app removido da página) | Cliente reconecta a Meta nos Satélites — o Comments é atualizado sozinho |
| Comentário do próprio dono da conta não dispara | Comportamento esperado (evita responder a si mesmo) | Testar com outra conta |
| "Esta conta já está conectada em outra organização." | A mesma conta IG está no Comments de outra org | Desconectar na outra org |
| Comentário/DM não aparece no tracking-chat | Empresa sem tracking, tracking sem etapa, ou conta conectada pelo passo a passo manual (só a conexão pela Meta alimenta o chat) | Criar tracking com etapa; conectar pela Meta |
| Resposta pelo chat falha "O Instagram recusou" | Comentário apagado, DM fora da janela de 24 h (ou resposta privada fora de 7 dias), ou falta `instagram_manage_comments`/`instagram_manage_messages` | Responder no post (comentário selecionado) ou esperar o cliente escrever de novo |
| Webhook responde 401 | Assinatura não bate: `META_APP_SECRET` de outro app | Usar o secret do mesmo app que está no login |

## Permissões do app do Instagram (spec 0071)

Para a conta conectada pelo passo a passo servir ao Comments e ao Planner, o caso de uso do Instagram no app da Meta precisa de três grupos de permissão: comentários e mensagens (`instagram_business_manage_comments`, `instagram_business_manage_messages`), publicação (`instagram_business_content_publish`) e métricas (`instagram_business_manage_insights`). O cartão da conta em Satélites › Instagram mostra o que o token atual permite; depois de liberar uma permissão, gere um token novo e troque a credencial.

O Instagram baixa a mídia do post por URL pública: em `localhost` a publicação só funciona se os arquivos estiverem num bucket público.

## Teste local (app de teste)

Ver [nasa-planner-teste-local-meta.md](nasa-planner-teste-local-meta.md), seção "Comments pela Meta".
