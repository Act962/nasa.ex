# Planner — testar publicação no seu Instagram (ambiente local)

> Guia para qualquer pessoa do time publicar de verdade no **próprio** Instagram a partir do ÓRBITA rodando em `localhost`, **sem mexer no app de produção da Meta** (que é do João). Testado em 2026-10-04 com o @weydsonlima: o post saiu em uma tentativa.
> Contexto técnico: [nasa-planner-overview.md](nasa-planner-overview.md) · specs 0057 a 0060.

## Por que um app de teste

- O app de produção (`985831321038815`) ainda **não tem aprovação da Meta** para publicar (`instagram_content_publish`, `pages_manage_posts`, `instagram_manage_comments`). Pedir essas permissões nele quebraria o login de clientes.
- Um app **seu**, em **modo de desenvolvimento**, deixa você (admin do app) usar todas as permissões **sem App Review**. Só funciona para contas de quem tem papel no app — perfeito para teste.

## Passo a passo

### 1. Ter um app de teste na Meta

Em [developers.facebook.com/apps](https://developers.facebook.com/apps), use um app seu (ou crie um do tipo "Empresa") ligado ao seu portfólio empresarial. Ele precisa ficar em **modo de desenvolvimento** (padrão de app novo).

### 2. Adicionar os casos de uso (o passo que mais trava)

Menu **Casos de uso → Adicionar casos de uso** e marque:

| Caso de uso | Para quê |
|---|---|
| **Gerenciar mensagens e conteúdo no Instagram** | publicar, comentários, insights e DMs do Instagram |
| **Gerenciar tudo na sua Página** | publicar na página, ler páginas e insights |
| **Interagir com os clientes no Messenger from Meta** | `pages_messaging` (o login do ÓRBITA pede) |
| **Criar e gerenciar anúncios com a API de Marketing** | `ads_management`, `ads_read` (o login do ÓRBITA pede) |

Depois, em cada caso de uso → **Personalizar → Permissões e recursos**, clique em **Adicionar** nestas permissões (status muda para "Pronto para teste"):

- Instagram: `instagram_basic`, `instagram_content_publish`, `instagram_manage_comments`, `instagram_manage_insights`, `instagram_manage_messages`
- Página: `pages_show_list`, `pages_read_engagement`, `pages_manage_posts`, `pages_manage_metadata`, `read_insights`
- Messenger: `pages_messaging`
- Já vêm prontas: `business_management`, `ads_management`, `ads_read`

### 3. Endereço de retorno do login

Menu **Login do Facebook para Empresas → Configurações**, campo **URIs de redirecionamento do OAuth válidos**: cole `http://localhost:3000/api/oauth/meta/callback`, aperte Enter e **Salvar alterações**. Em modo de desenvolvimento a Meta aceita `localhost` mesmo com "Forçar HTTPS" ligado.

### 4. Configurar o `.env.local`

Na raiz do projeto (`.env.local` começa com ponto — some no Finder; abra com `open -e .env.local`):

```
# Produção (João) — volte para usar o app de produção:
# META_APP_ID=985831321038815
META_APP_ID=<id do seu app de teste>
META_APP_SECRET=<App Secret do app de teste: Configurações do app → Básico → Mostrar>
META_OAUTH_REDIRECT_URI=http://localhost:3000/api/oauth/meta/callback
META_PUBLISH_SCOPES_ENABLED=true
```

`META_PUBLISH_SCOPES_ENABLED=true` faz o login pedir também publicar e comentários (`src/features/integrations/lib/oauth/meta-config.ts → resolveMetaScopes`). **Nunca** ligue isso em produção antes da aprovação da Meta.

Salve (⌘S) e **reinicie o servidor** (`pnpm dev`) — variável de ambiente só é lida na subida.

### 5. Seu Instagram

Precisa ser **profissional** (Empresa ou Criador) e estar **ligado a uma Página do Facebook** que você administra.

### 6. Conectar no ÓRBITA local

`http://localhost:3000/integrations` → **Meta Ads → Ativar → Conectar com Facebook**. Na tela da Meta:

1. **Continuar como você.**
2. Páginas: **"Aceitar apenas as Páginas atuais"** e marque só a sua página de teste.
3. Empresas: só o portfólio dono do app.
4. Contas do Instagram: só a sua.
5. Revise ("Carregar mídia e criar posts", "Gerenciar comentários" devem aparecer) → **Salvar → Entendi**.

De volta ao ÓRBITA, confirme a conta de anúncios, a página e o Instagram → **Conectar agora**. As contas de publicação ficam em `MetaPublishAccount` com token cifrado.

### 7. Ligar o Inngest local

Quem publica é o Inngest. Rode `pnpm inngest:dev` (ou a configuração "Inngest Dev Server" do `.claude/launch.json`) e sincronize: `curl -X PUT http://localhost:3000/api/inngest`. Sem isso o post fica "Programado" para sempre.

### 8. Publicar

No Planner (`/nasa-planner`): **Criar** → escolha o cliente e o seu Instagram → envie a imagem → **Revisão → Aprovar** → **Programação → Publicar agora** (ou programe um horário). O status passa por Publicando → **Publicado**, com link do post.

## Problemas que encontramos (e a saída)

| Sintoma | Causa | Saída |
|---|---|---|
| Tela da Meta: **"Invalid Scopes: ads_management, …"** | App sem os casos de uso — a Meta não reconhece nenhuma permissão | Passo 2 completo. Se sobrar uma permissão na lista, é o caso de uso dela que falta (ex.: `pages_messaging` → Messenger) |
| `pages_messaging` não aparece no caso de uso da Página | Ela mora no caso de uso do **Messenger** | Adicionar "Interagir com os clientes no Messenger" |
| Login abre mas pede para escolher tudo | Opção "atuais e futuras" vem marcada | Escolher "apenas as atuais" e marcar só a conta de teste |
| Post fica em "Programado" e nada sai | Inngest local desligado ou não sincronizado | Passo 7 |
| Login ainda usa o app de produção | `.env.local` antigo ou servidor não reiniciado | Conferir `META_APP_ID` e reiniciar `pnpm dev` |
| `META_APP_SECRET` vazio mesmo depois de colar | Arquivo colado mas **não salvo** no TextEdit | ⌘S; conferir com `awk -F= '/^META_APP_SECRET=/{print length($2)}' .env.local` (deve dar 32) |
| Envio de imagem pelo navegador falha (`Failed to fetch`) em localhost | CORS do bucket de testes não libera o `localhost` | Para provar a publicação, usar imagem de URL pública (a Meta baixa pela URL) ou liberar `http://localhost:3000` no CORS do bucket R2 |
| Script com as chaves locais devolve **Unauthorized** ao subir arquivo no R2 | As chaves do `.env.local` não têm escrita no bucket | Mesmo caso acima; ou usar uma chave de teste com escrita |
| Publicação falha com "precisa de uma imagem" | Validação por formato (`validate-post.ts`) | Feed precisa de imagem; Reel de vídeo; Story de imagem ou vídeo; carrossel 2–10 itens |
| Comments: botão "Usar @conta" não aparece | Empresa sem conta IG em `MetaPublishAccount` | Reconectar a Meta (passo 6) marcando o Instagram |
| Comments conectado, comentário não chega | Webhook do objeto Instagram não configurado no app, túnel caiu ou comentário de conta sem papel no app | Seção "Comments pela Meta", passos 2, 3 e 6 |
| Webhook verificado, comentário real não chega | App de teste **não publicado**: a Meta só manda webhooks de teste do painel | Publicar o app de teste (seção Comments, passo 6) |
| MCP da Meta não assina o webhook | O agente não envia o verify token a serviço externo sem autorização | Configurar no painel (passo 3 da seção Comments) |
| Meta recusa a imagem | Proporção fora de 4:5 a 1,91:1 ou URL que não é imagem direta | Usar JPG quadrado (1080×1080) ou 4:5 |
| "Nenhuma conta do Instagram conectada" com a conta conectada | `targetIgAccountId` recebeu o id interno da `MetaPublishAccount` | O campo guarda o **id do Instagram** (`igUserId`, ex. `1784…`); a tela já manda certo — o erro só aparece em chamadas manuais |
| Reel/vídeo não sobe em localhost | Vídeo precisa de URL pública e as chaves locais do R2 não escrevem | Usar uma chave do R2 com escrita no `.env.local` ou servir o arquivo por túnel (ngrok) só durante o teste |

## Story e Reel

- **Story** (testado em 2026-10-04): imagem 9:16 publicada no @weydsonlima em uma tentativa; o link do Story fica gravado no post.
- **Link no Story**: a API de publicação da Meta **não aceita figurinhas** (link, enquete, menção). Saídas: (1) link escrito na própria arte + "link na bio"; (2) **Comentários automáticos** do post do feed/Reel mandando DM com botão de link (painel "Comentários automáticos" na Programação); (3) adicionar a figurinha à mão no app do Instagram depois de publicado.
- **Reel** (testado em 2026-10-04): vídeo 9:16 de 11 s publicado no @weydsonlima em uma tentativa. Precisa de MP4 em URL pública (3 s a 15 min). O Inngest cria o container, espera o processamento (`step.sleep`) e publica.
- **Como o vídeo chega à Meta**: em produção o navegador sobe o arquivo direto no R2 (`/api/s3/upload` → URL assinada) e a Meta baixa pelo domínio público do bucket (`NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL`). Em localhost, sem chave com escrita, sirva o arquivo por túnel só durante o teste: `python3 -m http.server 8765` na pasta do vídeo + `ngrok http 8765`, e use a URL `https://<túnel>/<arquivo>.mp4` como vídeo do post. Desligue o túnel depois.

## Comments pela Meta (spec 0061)

Sem app próprio nem token: o Comments usa o Instagram já conectado na Meta.

1. No `.env.local`, gere `META_WEBHOOK_VERIFY_TOKEN` (`openssl rand -hex 24`) e reinicie o `pnpm dev`. `META_APP_SECRET` já é o do app de teste.
2. Suba um túnel para o `localhost:3000` (`ngrok http 3000`) — a Meta precisa de HTTPS público para entregar os comentários.
3. No app de teste → **Webhooks** → objeto **Instagram**: URL `https://<túnel>/api/social/webhook/meta`, verify token = o do passo 1, campos `comments` e `messages`. (Confira antes: `curl "https://<túnel>/api/social/webhook/meta?hub.mode=subscribe&hub.verify_token=<token>&hub.challenge=ok"` deve responder `ok`.)
4. `localhost:3000/comments` → **Usar @sua-conta** (ou no post do Planner → Programação → Comentários automáticos).
5. No post publicado, abra **Comentários automáticos**, preencha palavras, DM e botão → **Salvar automação**.
6. Comente a palavra-chave **com outra conta**. ⚠️ **App não publicado não recebe nenhum webhook real** — nem de administradores e testadores; só os de teste enviados pelo botão "Testar" do painel (aviso da própria Meta na tela de Webhooks). Para o teste real, publique o app de teste (Configurações → Básico: URL de privacidade + categoria → **Publicar**). Publicado, sem Acesso Avançado, ele continua funcionando só para contas com papel no app.
7. Veja a DM, a resposta pública e o registro em **Comments → Execuções**.

Testado em 2026-10-04: conexão em um clique, app de teste publicado, comentário real de @joanaa__saless no Reel do @weydsonlima → DM com botão e resposta pública enviadas (execução levou ~11 s, quase tudo na resposta da Meta).

## Ferramenta útil: MCP de Tecnologias Sociais da Meta

Conectado ao Claude Code (`claude mcp add --transport http meta-devtools https://mcp.facebook.com/devtools` → `/mcp` → autenticar), ele lê a configuração dos apps a que você deu acesso, o status do App Review, permissões aprovadas, uso da API, avisos de versão e webhooks. **Não** cria app, não adiciona caso de uso nem envia App Review — isso continua no painel da Meta.

## Para produção (João)

Quando o app de produção tiver Advanced Access em `instagram_content_publish`, `pages_manage_posts` e `instagram_manage_comments`: ligar `META_PUBLISH_SCOPES_ENABLED=true` no ambiente de produção, fazer deploy, **Resync** no Inngest Cloud e pedir aos clientes que reconectem a Meta (para o token ganhar as permissões novas). Contas conectadas antes podem ser cadastradas com o evento `nasa-planner/backfill-publish-accounts`.
