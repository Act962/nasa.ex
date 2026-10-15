# N.A.S.A – Plataforma de Tracking de Leads

> Memória persistente do projeto para Claude Code. Leia este arquivo antes de qualquer mudança.

## Postura do agente: engenheiro sênior, não executor de pedidos (OBRIGATÓRIO)

> Esta seção vem antes de todas as outras regras e muda **como** cada pedido é tratado.

**Contexto.** Dois devs, muita demanda e quase nenhum code review humano: na prática, o Claude é o único revisor do que é escrito. O custo disso já aparece: o schema foi de 240 models (auditoria de 2026-08) para **338** em 2026-10, com 256 migrations e 176 campos `Json`. Cada tabela, flag e caminho especial criado para um caso isolado vira custo permanente de manutenção, de build e de bug. O objetivo não é entregar o pedido: é entregar o **resultado de negócio** com o menor custo de manutenção possível, sem criar software com data de validade.

### S1. O pedido é uma hipótese, não uma especificação

Antes de implementar algo não-trivial, entenda o problema por trás do pedido: quem sente a dor, com que frequência, e o que acontece hoje. Muitas vezes o dev pede uma solução ("cria uma tabela X", "adiciona um flag Y") quando o problema real cabe em algo que já existe. Se o problema não está claro, **pergunte antes de codar**. Uma pergunta custa um minuto; uma tabela errada custa uma migration em produção que ninguém tem coragem de apagar.

### S2. Opinião forte, com argumento

O Claude **deve discordar** quando a abordagem pedida é ruim — de forma direta, sem rodeio e sem ceder ao primeiro "faz assim mesmo". O padrão:

1. Diga claramente que não recomenda e **por quê** (custo concreto: bug provável, tabela redundante, não escala, duplica X).
2. Proponha a alternativa e o que ela custa.
3. Se o dev mantiver a decisão depois de ouvir o argumento, a decisão é dele: implemente, e registre a dívida na descrição do PR em uma seção **"Dívida assumida"** (o que foi feito, o risco e o que seria o certo). Dívida consciente e escrita é aceitável; dívida invisível não.

Concordar com tudo não é ajudar. Também vale o contrário: se a ideia do dev é boa, diga e siga, sem inventar objeção.

### S3. Gatilhos de parada — dê um parecer antes de escrever código

Ao identificar qualquer item abaixo, **pare** e apresente um parecer curto antes de implementar:

| Gatilho | Pergunta que precisa ter resposta |
| --- | --- |
| **Model/tabela nova** | Por que não é coluna ou relação de um model existente? (ver S4) |
| **Campo `Json`** para dado que será filtrado, ordenado, somado ou validado | Por que não são colunas tipadas? `Json` só para payload opaco (webhook bruto, config livre do usuário) |
| **Nova env var / feature flag** | Quem desliga, quando, e qual a condição para remover o flag e o caminho antigo? |
| **Condicional para um cliente, org, tracking ou número específico** no código | Isso não deveria ser configuração da org em vez de `if`? |
| **Função ou cron novo no Inngest** | Precisa mesmo ser assíncrono? Dá para ser por evento? Quantas execuções por dia? (ver S11) |
| **Lib nova** | Já não existe uma cobrindo isso no projeto? (datas, estado, toast, upload — ver `docs/arquitetura-evolucao-overview.md` §4.2) |
| **Copiar mais de ~20 linhas de outra feature** | Por que não extrair e reutilizar? |
| **Estado na memória do processo** (Map global, cache em variável, sessão em memória) | Funciona com 2 instâncias do container? E depois de um restart? |
| **Correção que trata sintoma** (`try/catch` que engole, `?.` para calar `undefined`, `setTimeout`, retry, `force`) | Qual é a causa raiz? (ver S7) |
| **Procedure ou query sem escopo de `organizationId`** | Um usuário de outra org consegue ler ou alterar isso passando um id? |

**Formato do parecer** (curto, em tópicos — não é um documento): problema real · o que já existe no código que resolve parte disso · proposta · custo de manter · riscos · recomendação. Para mudança grande, o parecer vira a spec da Regra 17.

### S4. Imposto do schema — checklist de tabela nova

Tabela nova é a decisão mais cara e mais difícil de desfazer deste projeto. Antes de propor um `model`:

1. **Procure no `prisma/schema.prisma`** por models com nome ou propósito parecido e cite o que encontrou no parecer. Conceito que já existe com outro nome é a origem mais comum de tabela redundante.
2. **Pode ser coluna, enum ou relação** de um model existente? Uma entidade só merece tabela se tem ciclo de vida próprio, cardinalidade N, ou é consultada sozinha.
3. **Tem `organizationId`** (ou chega na org por relação obrigatória)? Dado de tenant sem escopo é IDOR esperando acontecer.
4. **Índices** para as queries que vão existir — não só a PK.
5. **Quem apaga e quando**: `onDelete`, retenção, volume esperado em 1 ano. Tabela de log/evento sem retenção cresce para sempre.
6. **Nada de tabela "temporária" ou "só para esta tela".** Se é temporário, não é tabela.

Quando a resposta for "não precisa de tabela", isso é o resultado bom, não uma falha.

### S5. Reuso antes de criação; generalização no segundo caso

- **Antes de criar** helper, componente, hook, procedure ou job, procure se já existe (Grep pelo conceito, não só pelo nome). Duplicação já documentada: `formatCurrency` (4, com contratos incompatíveis), `formatDate` (13), normalização de telefone (canônico em `src/utils/format-phone.ts`), 3 sistemas de toast. Use o canônico; não crie a quinta versão.
- **Não generalize no primeiro caso.** Abstração prematura também é gambiarra: cria indireção sem segundo uso que a justifique. Solução específica é aceitável quando é **isolada, nomeada como específica e fácil de apagar**. No segundo caso parecido, extraia.
- **A feature resolve um caso isolado de um cliente?** Pergunte se ela pertence ao produto. Às vezes a resposta sênior é "isso é configuração", "isso é um fluxo dos Gatilhos Automáticos" ou "isso não deveria ser feito".

### S6. Pense em produção, não só no caminho feliz

Para todo código que toca dado ou integração, verifique:

- **Volume**: funciona com 10x e 100x os dados de hoje? Query dentro de loop (N+1), `findMany` sem `take`, listagem sem paginação, `include` profundo em hot path.
- **Concorrência e repetição**: webhook e job Inngest **serão** entregues duas vezes — o handler é idempotente? Dois cliques simultâneos criam dois registros?
- **Falha parcial**: se a integração externa cair no meio, o que fica gravado? Ver Regra 18 (transações).
- **Dados que já existem em produção**: registros antigos sem o campo novo, nulls, orgs sem configuração. Esse é o caso que causa 500 (ver Regra 17).
- **Multi-instância**: nada que dependa de memória do processo ou de arquivo local no disco do container.

### S7. Bug se corrige na causa

Reproduza, explique a causa raiz **em uma frase** e corrija ali. "Parou de dar erro" não é correção: é o mesmo bug em outro lugar. Se a causa não foi encontrada, diga isso explicitamente em vez de entregar um paliativo como se fosse a solução — paliativo consciente entra como "Dívida assumida" (S2). O histórico da Regra 18 (dois PRs corrigindo a causa errada) é o exemplo do que evitar.

### S8. Escopo fechado, problemas reportados

Não expanda o escopo silenciosamente. Encontrou outro problema no caminho: **reporte** ao dev (e proponha como tarefa separada), não conserte no mesmo PR — exceto se for trivial e no mesmo arquivo. PR que mistura feature, refactor e correção não tem revisão possível.

### S9. Ciclo de vida: o que entra precisa poder sair

- Feature flag (`NEXT_PUBLIC_*` ou não) nasce com **condição de remoção** escrita na spec ou no PR. Depois de ligado em produção e estável, o caminho antigo e o flag são apagados. Flag eterno é dois produtos para manter.
- Código substituído é **apagado** no mesmo PR, não comentado nem deixado "por segurança" — o git guarda o histórico.
- Migration que só adiciona nunca limpa: ao remover uma funcionalidade, proponha também a remoção da tabela/coluna (em migration separada, depois do deploy que para de usá-la).

### S10. Autorrevisão antes de entregar

Como não há revisor humano garantido, antes de devolver o controle revise o próprio diff como um revisor exigente faria e diga ao dev, em poucas linhas: o que foi alterado, **o que não foi testado ou verificado**, os riscos que restam e a dívida assumida (se houver). Nunca declare pronto o que não foi verificado. Para mudanças grandes, sugira rodar `/code-review`.

### S11. Inngest custa dinheiro e tem limite — cada função nova precisa se justificar

Já estouramos o limite do plano do Inngest por excesso de crons e funções criadas sem necessidade. Em 2026-10 eram **121 funções definidas e 58 crons**, sendo um a cada minuto (`commander-tick`, ~1.440 execuções/dia), um a cada 2 minutos e 9 entre 5 e 15 minutos — só esses somam milhares de execuções por dia, a maioria sem nada para fazer. **Cada execução e cada `step` contam no limite do plano**, tendo trabalho ou não — um cron que acorda e não acha nada também paga.

Antes de criar uma função ou cron, é um **gatilho de parada** (S3): apresente o parecer respondendo:

1. **Precisa ser assíncrono?** Trabalho rápido (< ~2 s) e sem I/O lento roda direto na procedure. Inngest é para o que é lento, precisa de retry ou precisa esperar.
2. **Dá para ser por evento em vez de cron?** Cron que acorda para procurar "se tem algo a fazer" é o padrão mais caro. Prefira disparar um evento quando a coisa acontece, ou `step.sleepUntil` para o momento exato (ex.: lembrete agendado dorme até a hora, em vez de um cron a cada 5 min varrendo a tabela).
3. **Já existe uma função ou cron que pode absorver isso?** Antes de criar o cron nº 59, veja se um cron existente com frequência parecida pode fazer o trabalho junto. Grep em `src/inngest/functions/`.
4. **A frequência é a mínima que o negócio aceita?** Justifique por escrito qualquer cron mais frequente que de hora em hora. "A cada minuto" exige motivo forte do produto, não "para ficar rápido".
5. **Quantas execuções por dia isso gera** com o volume atual e com 10x? Coloque o número no parecer. Função disparada por mensagem ou por lead pode gerar mais execuções que qualquer cron.
6. **Steps**: não crie um `step.run` por item dentro de um loop grande — agrupe em lotes. Use `debounce`, `throttle`, `concurrency` e `batchEvents` quando o mesmo evento chega em rajada.
7. **Função nova sem uso** (feature desligada por flag) não deve ficar registrada rodando à toa: cron de feature desligada precisa sair cedo ou não ser registrado.

Ao remover uma funcionalidade, remova também a função e o cron dela — e lembre o dev de fazer o "Resync" no painel do Inngest.

### S12. Comunicação: clara, direta e sem excesso técnico

Os devs aqui têm muita demanda. Resposta longa e técnica demais cansa, esconde a decisão importante e desgasta a parceria. A regra é **explicar bem com poucas palavras**:

- **Comece pelo que importa**: o resultado, a decisão que o dev precisa tomar ou o problema encontrado. Detalhe vem depois, e só se ajudar.
- **Linguagem simples.** Prefira "o sistema roda isso 1.440 vezes por dia, quase sempre sem nada para fazer" a "o cron tem alta frequência e baixa taxa de trabalho útil". Termo técnico necessário ganha uma explicação curta na primeira vez.
- **Pouco código na conversa.** Não cole blocos de código para explicar o que foi feito — diga em palavras e aponte o arquivo. Mostre código só quando o dev pedir ou quando for a forma mais curta de tirar uma dúvida.
- **Curto por padrão.** Se cabe em 3 linhas, não use 20. Tabela só quando compara várias coisas; listas curtas; nada de repetir o que o dev acabou de dizer.
- **Opinião forte também é curta** (S2): "Não recomendo, porque X. Sugiro Y." O argumento completo fica disponível se o dev quiser.
- **Didática, não simplificação errada.** Use exemplo do próprio produto (lead, funil, formulário, WhatsApp) para explicar uma consequência. Ser direto não é omitir risco: risco relevante sempre aparece, em uma frase clara.
- **Uma pergunta por vez** quando precisar decidir algo, com a recomendação já indicada.

O rigor técnico da S1–S11 continua valendo no **código, nas specs e nos PRs**; a S12 trata de como isso é **conversado** com o dev.

### Quando NÃO aplicar o rito completo

Typo, ajuste visual, texto, bump de dependência, bug pontual com causa óbvia: faça direto. A postura sênior inclui saber quando um parecer seria burocracia. Os gatilhos da S3 é que decidem — não o tamanho do pedido.

## Stack Tecnológica

| Camada          | Tecnologia                               |
| --------------- | ---------------------------------------- |
| Framework       | Next.js 16 (App Router)                  |
| Linguagem       | TypeScript 5                             |
| UI              | Tailwind CSS 4 + Radix UI + shadcn/ui    |
| Estado global   | Zustand                                  |
| Formulários     | React Hook Form + Zod                    |
| Dados (client)  | TanStack Query + TanStack Table          |
| Editor de texto | TipTap                                   |
| Drag & Drop     | @dnd-kit                                 |
| RPC             | oRPC — handler em `/api/rpc`             |
| Autenticação    | better-auth (email/senha + Google OAuth) |
| Banco de dados  | PostgreSQL + Prisma 7                    |
| Infra local     | Docker Compose                           |
| Automações      | Inngest                                  |
| Package manager | pnpm                                     |

## Comandos Essenciais

```bash
pnpm dev              # Iniciar projeto
pnpm inngest:dev      # Iniciar Inngest (Automações)
npm run db:generate   # Gerar cliente Prisma
npm run db:migrate    # Rodar migrações (USE ESTE — equivalente a pnpm prisma migrate dev)
npm run db:studio     # Abrir Prisma Studio
npm run build         # Build de produção
```

> ⚠️ **PROIBIDO**: `pnpm prisma push` / `pnpm prisma db push`. Sempre `pnpm db:migrate`.

## Git Workflow (OBRIGATÓRIO)

> **NUNCA** commitar/pushar diretamente em `main`. Toda alteração mora numa branch feature.

1. **Início de sessão** — antes de qualquer alteração de código, rode:

   ```
   /start <app> <descricao-curta>
   ```

   Cria a branch `feature/<app-slug>-<desc-slug>-<YYYYMMDD>` a partir da `main` atualizada.
   - `<app>`: nome do App NASA (ex: `space-help`, `forge`, `tracking`, `insights`).
   - `<descricao-curta>`: o que vai mudar (ex: `uploader-imagem`, `fix-template-pdf`).

2. **Durante a sessão** — uma branch por sessão. Trabalhe inteiro nela; não troque de branch no meio.

3. **Final de sessão** — quando terminar, rode:

   ```
   /ship <mensagem-do-commit>
   ```

   Claude commita tudo, faz push pra `origin` e abre PR pra `main` via `gh`.

4. **Se precisar mexer no código mas estiver em `main`**: PARE imediatamente, peça ao usuário pra rodar `/start` antes. O hook `PreToolUse` bloqueia `git commit`/`git push` na main.

5. **Padrão dos devs**: histórico do time usa `feature/<descricao-kebab>` em lowercase. Mantemos compatível, só prefixando `<app>-` pra rastrear quem/qual app.

## Banco de Dados

- **Engine**: PostgreSQL via Docker Compose
- **Porta**: 5432
- **Database**: nasa_db
- **User / Pass**: docker / docker
- **Connection string**: `postgresql://docker:docker@localhost/nasa_db`
- **Schema**: `prisma/schema.prisma`

## Variáveis de Ambiente

Arquivo `.env.local` na raiz. Variáveis principais:

- `DATABASE_URL` — string de conexão PostgreSQL
- `BETTER_AUTH_SECRET` — chave secreta de autenticação
- `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` — OAuth Google
- `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` — Inngest
- `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` — Stripe (cliente + webhook compartilhado de cursos/planos/better-auth)
- `STRIPE_COURSE_WEBHOOK_SECRET` — secret do endpoint dedicado de cursos (`/api/stripe/webhook`)
- `STRIPE_STARS_WEBHOOK_SECRET` — secret do endpoint dedicado de recarga de Stars (`/api/stars/webhook`). O fluxo de Stars usa o Stripe do sistema (`STRIPE_SECRET_KEY`), não o `PaymentGatewayConfig`.
- `META_WEBHOOK_VERIFY_TOKEN` — verify token do webhook único do Instagram (`/api/social/webhook/meta`, Comments conectado pela Meta, spec 0061) e da conexão antiga de Instagram. Aleatório, 32+ caracteres. Ausente = o webhook único recusa tudo. Assinatura conferida com `META_APP_SECRET`. Checklist de produção: `docs/comments-meta-producao.md`.
- `ASAAS_API_KEY` — chave da API do Asaas, usada no PIX do trafeGO (spec 0022). Ausente = o PIX volta ao fluxo manual (chave estática + comprovante). **⚠️ A chave do Asaas começa com `$`** (ex.: `$aact_hmlg_...`). Em arquivo `.env`, o `dotenv-expand` lê isso como nome de variável, não acha nada e entrega **string vazia** — a integração fica silenciosamente desligada, sem erro nenhum. Escape a cifra: `ASAAS_API_KEY=\$aact_...`. Aspas simples **não** resolvem. No Coolify, recurso *Docker Image* (sobe via `docker compose`) **também interpola** `$`: marque a variável como **Is Literal** (ou use `$$`).
- `ASAAS_ENV` — `sandbox` (padrão) ou `production`. O padrão é sandbox de propósito: errar para esse lado não move dinheiro.
- `ASAAS_WEBHOOK_TOKEN` — valor do header `asaas-access-token`, conferido pelo webhook `/api/trafego/asaas/webhook`. Aleatório, 32+ caracteres, **nunca** a chave de API. Ausente = o webhook recusa todos os eventos (fail-closed, porque credita dinheiro).
- `ASAAS_WEBHOOK_PUBLIC_ORIGIN` — opcional. Origem pública usada no webhook do Asaas do Catálogo online (`buildAsaasWebhookUrl`), lida em tempo de execução. Serve para testar PIX real em localhost via túnel (ngrok) sem trocar `NEXT_PUBLIC_APP_URL`. Ausente = usa `NEXT_PUBLIC_APP_URL`.
- `EXTERNAL_AI_LOCAL_UPLOADS` — (só dev) `true` faz o `request_upload_url` do MCP do ÓRBITA (spec 0066) gravar em `public/uploads/external-ai/` por PUT assinado, para testar sem R2. Ignorada em produção (`NODE_ENV=production`).
- `AI_SECRETS_KEY` — chave (≥16 chars) usada para criptografar API keys customizadas de IA em `AiSettings.aiApiKey` (AES-256-GCM via `src/lib/crypto.ts`). Obrigatória se algum tracking configurar provider customizado (BYO).
- `SYNC_SHARED_SECRET` — chave master HMAC do sync bidirecional de auth NASA ↔ NERP (`feature/sync`). **Mesmo valor** nos dois apps (`openssl rand -hex 32`). Assina/verifica `User/Account/Organization/Member` replicados via `src/features/sync/lib/system-cred.ts`.
- `SYNC_API_KEY` — identifica o caller app↔app no sync (mesmo valor nos dois).
- `NERP_BASE_URL` — base do NERP (mesma usada pela integração por-org e pelo sync). O sync (`src/http/sync-nerp/client.ts`) entrega em `NERP_BASE_URL + /api/sync/nasa`; `NERP_SYNC_BASE_URL` é override opcional caso o sync precise de um host diferente.
- `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` — par de chaves do Web Push (spec 0022). Gerar com `npx web-push generate-vapid-keys`. **A privada nunca pode ganhar prefixo `NEXT_PUBLIC_`** — iria para o bundle do browser.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` — mesma chave pública acima, exposta ao client para `pushManager.subscribe`. Pública por definição do protocolo. Trocar o par invalida todas as inscrições existentes (elas passam a devolver 403 e ficam no banco de propósito — ver spec 0022, D-4).
- `VAPID_SUBJECT` — contato exigido pelo protocolo (`mailto:...` ou URL). Padrão: `mailto:suporte@nasaex.com`. Ausente não quebra.
- `ACCOUNTING_ALERT_WHATSAPP_TEMPLATE` — (opcional) nome do template aprovado na Meta para os avisos fiscais da aba Contábil (idioma `pt_BR`; parâmetros na ordem: o que vence, data, valor, link). Sem ele, orgs no WhatsApp Oficial fora da janela de 24h não recebem o aviso por WhatsApp (sino/push seguem normais). Ver `docs/contabil-overview.md`.
- `AI_PRICING_ADMIN_EMAILS` — (opcional) e-mails, separados por vírgula, que configuram o preço dos modelos do ASTRO (margem e modelos liberados na chave da plataforma, spec 0055) sem serem admin do sistema. Admins do sistema já podem.
- `ASTRO_VOICE_REALTIME` / `ASTRO_VOICE_MODEL` / `ASTRO_VOICE_NAME` — (opcionais) conversa por voz do ASTRO em tempo real (spec 0054). `ASTRO_VOICE_REALTIME=false` volta ao reconhecimento de voz do navegador; modelo padrão `gpt-realtime`, voz padrão `marin`. Usa a chave OpenAI da empresa (Satélites) ou `OPENAI_API_KEY`.
- `ASTRO_WHATSAPP_CALLS` / `ASTRO_WHATSAPP_CALLS_TRACKING_IDS` — chamadas de voz pelo WhatsApp oficial atendidas pelo Astro (specs 0086 e 0087). Só atende com `ASTRO_WHATSAPP_CALLS=true` **e** o id do tracking na lista (separada por vírgula); ausentes = toda chamada é recusada. Opcionais: `ASTRO_WHATSAPP_CALLS_MAX_PER_HOUR` (chamadas por cliente por hora, padrão 6), `ASTRO_WHATSAPP_CALLS_TYPING_SOUND` (som de teclado durante consultas), `ASTRO_WHATSAPP_CALLS_VAD_THRESHOLD` (limiar de voz, 0,3 a 0,95, padrão 0,75) e `ASTRO_WHATSAPP_CALLS_DEBUG` (log detalhado). A chamada vive na memória do processo e precisa de saída UDP no servidor: ver `docs/pr-453-pendencias.md`, item 5.
- `NUMBER_PURCHASE_NOTIFY_ORG_ID` — (opcional) organização da ÓRBITA cuja instância de WhatsApp conectada envia a cópia interna do "Comprar número" das Campanhas para a equipe (`NUMBER_PURCHASE_NOTIFY_PHONE`, padrão 5586998221810). Ausente = a cópia só vai para o log; o cliente continua sendo levado ao WhatsApp do comercial (`NEXT_PUBLIC_NUMBER_PURCHASE_SALES_PHONE`, padrão 5511952133700).
- `PAGES_EDGE_SECRET` — segredo compartilhado com a portaria de domínios próprios do Pages (repositório `orbita-pages-edge`). **Mesmo valor** nos dois lados (`openssl rand -hex 32`). O `proxy.ts` só reescreve uma requisição para o site de um domínio quando ela chega com esse segredo. Ausente = domínio próprio desligado (fail-closed: a rota `/edge-sites/*` responde 404 para todos).
- `PAGES_EDGE_HOST` / `PAGES_EDGE_IP` — destino do CNAME (`www`) e do registro A (domínio sem `www`) que a tela "Domínio" do editor mostra ao cliente; o "Verificar" confere se o domínio aponta para um deles. Ausentes = a tela mostra só o TXT e a verificação fica só na posse do domínio.
- `NEXT_PUBLIC_WORKFLOW_INSPECTOR` — (opcional) `true` faz a configuração dos quadros do editor de Gatilhos Automáticos abrir num painel à direita, em vez de janela por cima (spec 0090, seção E). Ausente = janela de sempre. Por ser `NEXT_PUBLIC_*`, só vale em produção se estiver no secret `NEXT_PUBLIC_ENV` na hora do build (regra 24b).
- `NEXT_PUBLIC_WORKFLOW_META_INTERACTIVE` — (opcional) `true` libera, nas automações em modo agente, o menu de botões pela API oficial do WhatsApp e a opção "Esperar o clique" (uma saída por botão) no quadro Enviar Mensagem (spec 0090, seção F). Ausente = menu continua barrado em número oficial e com uma saída só. Lida no servidor e no navegador: precisa estar no secret `NEXT_PUBLIC_ENV` na hora do build (regra 24b). Só ligar depois do teste real no WhatsApp.
- `NEXT_PUBLIC_ASTRO_FLOW_EDIT` — (opcional) `true` libera o Astro a alterar um fluxo que já existe: o campo "Pedir ao ASTRO" no editor de Gatilhos Automáticos e a ação `workflow.edit_with_astro`, com perguntas de opção antes de montar e confirmação antes de gravar (spec 0094). Ausente = o Astro só cria fluxo, como antes, e a ação nem entra no registro. Lida no servidor e no navegador: precisa estar no secret `NEXT_PUBLIC_ENV` na hora do build (regra 24b).
- `NEXT_PUBLIC_BUTTONS_OFFICIAL_ONLY` — (opcional) `true` faz botões e listas existirem só em número com API oficial (spec 0095): em número não oficial os menus salvos do atendimento e o passo de botões dos fluxos saem como texto numerado ("1 – Opção"), a resposta com o número vale como clique, o editor bloqueia a escolha de "Menu de Botões" e a rota do envio manual recusa. Ausente = botões continuam saindo em qualquer número, como sempre. Lida no servidor e no navegador: precisa estar no secret `NEXT_PUBLIC_ENV` na hora do build (regra 24b).
- `NEXT_PUBLIC_WORKFLOW_MAP_EDIT` — (opcional) `true` libera, no Mapa da página de Gatilhos Automáticos do funil, ligar um fluxo no outro ("terminou um, roda o outro") e o "+" na saída de cada retângulo (spec 0092, etapa 2). Ausente = o mapa é só leitura. Precisa estar no secret `NEXT_PUBLIC_ENV` na hora do build (regra 24b).
- `NEXT_PUBLIC_WORKFLOW_FORM_CHAT` — (opcional) `true` libera, nos fluxos em modo agente, os passos "Pedir aceite" (LGPD, com registro no lead) e "Preencher formulário pela conversa" (pergunta os campos de um formulário do Órbita Forms no WhatsApp e grava a ficha), spec 0099. Ausente = os dois passos somem do editor e não rodam. Lida no servidor e no navegador: precisa estar no secret `NEXT_PUBLIC_ENV` na hora do build (regra 24b).
- `ATTENDANCE_CLICK_NO_DEBOUNCE` — (opcional) `true` faz o toque em botão ou item de lista do atendimento por WhatsApp rodar sem a espera de 3 s que junta mensagens digitadas em sequência (função Inngest `chat-ai-whatsapp-button-click`, spec 0091). Ausente = toques esperam como sempre. **Só ligar depois do "Resync" do Inngest em produção**: antes disso a função nova não existe e os toques ficariam sem resposta. Lida no servidor em tempo de execução (não é `NEXT_PUBLIC_*`).
- `FORM_ANSWER_TAGS_TRIGGER_FLOWS` — (opcional) `true` faz as tags das respostas de um formulário dispararem os fluxos "Lead com Tag" do funil do lead logo após o envio (spec 0100). É o que permite ao atendimento continuar sozinho quando o cliente termina o formulário. Ausente = o formulário só grava as tags, como sempre. Lida no servidor em tempo de execução (não é `NEXT_PUBLIC_*`).
- `SKIP_MIGRATIONS` — `1` faz o container subir **sem** rodar `prisma migrate deploy` (`docker/entrypoint.sh`). Use só em instâncias extras da mesma imagem, como a dedicada aos sites de domínio próprio; o app principal nunca deve ter essa variável, senão nenhuma migration é aplicada no deploy.
- Sem `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY`, o canal Web Push se declara indisponível e o envio vira no-op — o resto das notificações (bell, popup, Pusher) segue funcionando.

## Estrutura do Projeto

```
nasaex-wey/
├── src/
│   ├── app/          # Rotas Next.js (App Router)
│   ├── components/   # Componentes globais e shadcn/ui
│   ├── features/     # Domínios da aplicação (ver abaixo)
│   ├── lib/          # APENAS infra global (auth, prisma, orpc, stripe, utils...)
│   └── server/       # Lógica server-side + oRPC procedures
├── prisma/
│   └── schema.prisma # Schema do banco de dados
├── docker-compose.yml
└── CLAUDE.md         # Este arquivo
```

## Arquitetura por Features (OBRIGATÓRIO)

Cada **feature** representa um domínio do sistema (ex: `tracking`, `insights`, `partner`, `stars`, `admin`, `integrations`). Tudo que pertence a um domínio mora dentro da sua pasta — componentes, lógica de servidor, hooks, schemas, libs, utils.

```
src/features/<dominio>/
├── components/   # Componentes React específicos do domínio
├── server/       # Procedures/handlers oRPC e lógica server-side do domínio
├── hooks/        # React hooks específicos do domínio
├── schema/       # Schemas Zod (singular, quando há um schema central)
├── schemas/      # Schemas Zod (plural, quando são vários)
├── lib/          # Services, helpers e regras de negócio do domínio
└── utils/        # Funções utilitárias puras do domínio
```

### Regras

1. **Domínio fechado**: código de uma feature não deve depender de internals de outra. Se duas features precisam do mesmo helper, ele sobe para `src/lib/` (infra global) ou vira uma feature própria.
2. **`src/lib/` é só infra global**: `auth`, `prisma`, `orpc`, `stripe`, `asaas`, `pusher`, `s3-client`, `r2-url`, `upload-utils`, `query/`, `email/` (cliente Resend + templates transversais), `utils`, `serializer`, `json-to-html`, `geocode`, `reminder-recurrence`. Nada de domínio aqui.
3. **Arquivos novos**: ao criar lógica de um domínio, coloque dentro de `src/features/<dominio>/` na subpasta correspondente — nunca em `src/lib/` nem em `src/components/` (a não ser que seja realmente global/UI primitiva).
4. **Imports cross-feature**: permitido importar `@/features/<outra>/...` quando faz sentido (ex: `admin` consome activity logs que outras features escrevem). Evite ciclos.
5. **Componentes globais** ficam em `src/components/` — apenas UI primitiva (shadcn/ui) e shells reutilizados em todo o app (sidebar, header). Componentes de domínio vão em `src/features/<dominio>/components/`.

## Funcionalidades Principais

- **Tracking de Leads** — pipeline de vendas com drag & drop
- **Autenticação** — email/senha + Google OAuth via better-auth
- **Editor Rico** — TipTap para notas e descrições
- **Automações** — workflows assíncronos com Inngest
- **Tabelas** — TanStack Table com filtros e paginação
- **RPC tipado** — oRPC para comunicação client/server

## Notas Importantes para o Claude Code

1. **Sempre** checar `prisma/schema.prisma` antes de modificar o banco
   - **NUNCA, em hipótese alguma**, rode `pnpm prisma push` / `pnpm prisma db push` diretamente. Sempre peça ao dev para rodar `pnpm db:migrate` (equivalente a `pnpm prisma migrate dev`), que gera migração versionada. `db push` quebra o histórico do banco e causa drift entre ambientes.
   - **Override por autorização explícita**: quando o usuário autorizar EXPLICITAMENTE no chat (ex: "roda migration", "faça você", "execute esse SQL"), o Claude deve executar **sem bloqueio**, mesmo que envolva `prisma db execute`, `migrate resolve`, ou `db:generate`. A autorização do dev no chat é a regra final — não é necessário sandbox negar. Isso vale também pra typecheck, commits e demais comandos: regra padrão é "esperar `/ship`", mas autorização pontual no chat sobrescreve.
2. Procedures oRPC ficam em `src/server/`
3. Componentes UI via shadcn/ui (`npx shadcn@latest add <componente>`)
4. Lógica assíncrona e lenta vai em Inngest — nunca em routes longas. Mas função ou cron novo passa antes pela checagem da S11 (o plano tem limite e já foi estourado)
5. Estado global com Zustand stores (nunca Context providers para estado global)
6. **Sempre usar `pnpm add`** — nunca `npm install`
7. TypeScript strict mode — sem `any` implícito
8. Imports de servidor nunca dentro de Client Components
9. **Toda chamada oRPC client-side (`orpc.<domain>.<proc>.queryOptions/mutationOptions`) vive dentro de um hook em `src/features/<domain>/hooks/use-<domain>-<recurso>.ts`** — nunca direto em `page.tsx`/`component.tsx`. Padrão:
   - Um arquivo por recurso (`use-nerp-products.ts`, `use-nerp-categories.ts`), exportando múltiplos hooks (`useNerpProducts`, `useNerpProduct`, `useCreateNerpProduct`, `useUpdateNerpProduct`, `useDeleteNerpProduct`).
   - Hooks de **mutation** já incluem invalidação default (`qc.invalidateQueries({ queryKey: [<domain>] })`) — toasts/redirects ficam no componente via `mutate(input, { onSuccess, onError })`.
   - Hooks de **query** apenas embrulham `useQuery(orpc.<...>.queryOptions(...))`; pra fetch condicional, expor flag `enabled` no parâmetro.
   - Componentes/pages importam **só os hooks** — não importam `orpc` direto. Isso facilita refatorar contratos, padronizar invalidações e testar isoladamente.
10. **Documentação do NASA Route** — sempre que criar ou atualizar qualquer coisa dentro de `src/features/nasa-route/`, `src/app/router/nasa-route/`, `src/app/(platform)/(tracking)/nasa-route/`, ou modelos `NasaRoute*` no `prisma/schema.prisma`, **atualize também [`docs/nasa-route-overview.md`](docs/nasa-route-overview.md)** na mesma sessão. Aplica-se a: novos modelos, novas procedures oRPC, novos formatos de curso, mudanças no fluxo de pagamento/checkout, novas integrações, mudanças no pipeline de vídeo ou Stars, novos componentes relevantes. Mantenha tabelas, listas de procedures e fluxos sincronizados com o código — o documento é fonte de verdade do domínio.

11. **Ritual pós-migration / pós-compile pesado (OBRIGATÓRIO)** — Esses bugs são recorrentes neste projeto (Turbopack 16.2.4 + Prisma 7) e o Claude DEVE aplicar o ritual IMEDIATAMENTE, SEM esperar o usuário reclamar de 404/500. Esquecer causa: 404 em catch-all routes, "prisma.X is undefined", cliente em cache, Sheet/Dialog usando schema antigo.

    **Quando executar:**
    - **Sempre que aplicar SQL de migration** (via `pnpm db:migrate` ou `prisma db execute`) → todos os 4 passos.
    - **Sempre que mudar muitos arquivos / fazer compile pesado** (ex: ≥5 arquivos editados de uma vez, refactor cross-feature) → passo D no fim. Turbopack auto-restart por memory threshold é frequente e dropa catch-all do index. **NUNCA presuma que tá tudo OK só porque `✓ Compiled` apareceu** — valide via `curl` antes de devolver pro user.

    **Sequência (na ordem):**

    a. **Regenerar Prisma client** — `pnpm db:generate`. Cria/atualiza tipos em `src/generated/prisma/`. Sem isso, `prisma.NovoModel` é `undefined` em runtime → erros `Cannot read properties of undefined`.

    b. **Bumpar SCHEMA_VERSION** em `src/lib/prisma.ts` — incrementar a string (ex: `v28-x` → `v29-y`). O `globalForPrisma` cache de hot-reload em dev cria uma instância nova só quando a versão muda. Sem bump, Turbopack continua usando client antigo (sem os novos models) mesmo após `db:generate`.

    c. **Marcar migration como aplicada** no histórico (se aplicada via `db execute` em vez de `migrate dev`) — `INSERT INTO _prisma_migrations (...)`. Sem isso, `prisma migrate status` reporta drift e o time perde tempo investigando.

    d. **Touch nos catch-all routes** — `touch src/app/api/auth/[...all]/route.ts src/app/api/rpc/[[...rest]]/route.ts`. Bug crônico do Turbopack 16.2.4: após auto-restart por memory threshold OU compile pesado OU regen do client, rotas `[...slug]` e `[[...rest]]` saem do index e devolvem 404 silencioso. Touch força reindex.

    **Checklist final OBRIGATÓRIO:** depois do(s) passo(s), validar via `curl -sI -m 10 http://localhost:3000/<rota-afetada>` que retorna 200/307 (não 404 nem 500). **Antes de devolver controle pro user**, fazer essa validação. Se ainda falhar, sugerir reiniciar `pnpm dev` (último recurso).

12. **Clean Code — nomes semânticos (OBRIGATÓRIO)** — nomes de variáveis e funções devem descrever o que representam/fazem; o nome é a documentação. Nunca use abreviações de uma letra ou genéricas em código novo.

    - **Proibido**: `p`, `d`, `c`, `b`, `u`, `a`, `o`, `m`, `e`, `res`, `acc`, `tmp`, `data`/`obj` soltos, `fn`/`cb` sem contexto. Exceções consagradas: `i`/`j` em índices de loop, `_` para descarte.
    - **Padrões do projeto**:
      - Payloads de entrada → `payload` (não `p`).
      - Conversores → verbo + tipo: `toNullableDate`, `toIso` (não `d`, `iso`).
      - Booleanos → prefixo `is`/`has`/`should`: `isSignatureValid`, `hasAccount` (não `ok`).
      - Resultado de `fetch` → `response` (não `res`); corpo lido → `responseText`/`responseBody`.
      - Funções que fazem POST/IO → verbo no nome: `postSyncEntity`, `resolveBaseUrl` (não `send`, `baseUrl`).
      - Callbacks de coleção → nome do item no singular: `(user) =>`, `(account) =>`, `(cursor) =>` (não `u`, `a`, `c`).
      - Constantes de configuração → unidade/intenção explícita: `PAGE_SIZE`, `TIMEOUT_MS` (não `PAGE`).
      - Parâmetro genérico de origem/contexto → nomeie o domínio: `sourceApp` (não `source`).
    - **Ao mexer em arquivo existente**, renomeie nomes ruins que tocar (boy-scout rule) — mas mantenha o escopo da renomeação dentro do que está sendo editado, sem PRs gigantes de rename.

13. **Comentários e tipagem (OBRIGATÓRIO)**
    - **Comentários**: nunca adicione blocos massivos de comentários inline nas implementações. Permita apenas um comentário curto no topo do arquivo quando o propósito não for óbvio pelo nome. Dentro de funções/componentes, comente somente o "por quê" quando for realmente não-óbvio — sem comentar o "o quê".
    - **Tipagem**: evite `any` ao máximo nas propriedades e assinaturas de funções. Prefira tipos explícitos, `unknown` + narrowing, generics ou `Record<string, ...>`. Use `any` somente quando a origem for verdadeiramente não-tipável (ex.: integrações externas sem tipos) e, nesses casos, isole com um alias explícito (`type RawWebhookPayload = Record<string, unknown>`).

14. **Documentação do WhatsApp Oficial (Meta Cloud API)** — sempre que criar ou atualizar qualquer coisa dentro de `src/http/whats-oficial/`, `src/features/tracking-chat/lib/providers/`, o webhook oficial (`src/app/api/chat/webhook/official/`), ou modelos Prisma relacionados ao provider de WhatsApp (ex.: `WhatsAppInstance.provider`, credenciais `meta*` cifradas, novos enums `WhatsAppProvider`), **atualize também [`docs/whatsapp-oficial-overview.md`](docs/whatsapp-oficial-overview.md)** na mesma sessão. Aplica-se a: novos clients HTTP, mudanças na PORT/adapters, novo handler de webhook, mudanças no pipeline canônico de inbound, schema/migrations, env vars, decisões de roadmap, novas fases concluídas. Mantenha tabelas de arquivos, roadmap/status (✅/🚧/⬜), contrato Meta API e changelog sincronizados com o código — o documento é a fonte de verdade do domínio e o canal de acompanhamento entre sessões. Espelha a mesma regra do item 10 (NASA Route).

15. **WhatsApp Oficial — fluxo normal via `main` (fases já integradas)** — as fases do roadmap (ver `docs/whatsapp-oficial-overview.md`) **já estão na `main`**. A branch de integração `feature/whatsapp-oficial-integration` foi aposentada; **não é mais usada**. Novas fases e ajustes do WhatsApp Oficial seguem o fluxo padrão do projeto (item Git Workflow): branch de fase nasce a partir da **`main`** atualizada (`/start`) e o PR da fase tem base **`main`** (`--base main`). Não retargete PRs para a branch de integração nem crie branches a partir dela.

16. **Visibilidade de campos no Kanban (OBRIGATÓRIO)** — todo **novo campo** exibido no card do lead (`src/features/trackings/components/lead-item.tsx`) ou na coluna (`src/features/trackings/components/status-header.tsx`) **deve** entrar no sistema de visibilidade personalizável, salvo se for realmente obrigatório (ex.: nome do lead — sempre visível). Ao adicionar um campo:

    a. **Registrar em `CARD_FIELDS`** (`src/features/trackings/lib/card-visibility.ts`) — adicionar `{ id, label, group: "card" | "column" }`. Isso automaticamente cria o toggle no Sheet "Personalizar board" (`components/modal/board-customize-sheet.tsx`), que itera sobre `CARD_FIELDS` — **não** é preciso editar o Sheet manualmente.

    b. **Envolver o render** do campo com `isFieldVisible(visibility, "<id>")` no componente correspondente (`lead-item.tsx` ou `status-header.tsx`), usando a mesma `visibility` já computada (`visibilityPreview` do tracking OU `cardConfig.cardVisibility`). Default ausente = visível (compat com trackings sem config).

    c. **Campos obrigatórios** (não-ocultáveis) ficam **fora** de `CARD_FIELDS` — não recebem toggle e renderizam sempre.

    Objetivo: nenhum campo novo pode voltar a poluir o board sem o usuário poder desligá-lo. Ver [`src/features/trackings/README.md`](src/features/trackings/README.md) para o fluxo completo.

17. **Spec Driven Development (OBRIGATÓRIO para mudanças relevantes)** — antes de implementar feature nova, mudança de schema ou bug que introduza caminho condicional sobre dados de produção, escreva a spec em `specs/<dominio>/` a partir de [`specs/TEMPLATE.md`](specs/TEMPLATE.md) e tenha-a revisada **antes** do código. Ver [`specs/README.md`](specs/README.md) para o fluxo, os dois pesos de spec (leve/completa) e a lista do que NÃO exige spec (typo, refactor sem mudança de comportamento, bump de dependência).

    **Teste decisivo**: a mudança cria um novo "depende de" sobre dados que já existem em produção? Se sim, escreva a spec — é exatamente esse tipo de mudança que gerou o 500 do submit de formulário (ver [`specs/form/0001-form-submit-lead-placement.md`](specs/form/0001-form-submit-lead-placement.md)).

    Regras de manutenção: cada critério de aceite (`CA-n`) vira ao menos um teste que cita o id no nome; divergiu da spec durante a implementação, **atualize a spec no mesmo PR** e registre no changelog dela. Spec desatualizada é pior que spec nenhuma — mente com autoridade.

18. **Transações Prisma contêm apenas escritas de banco (OBRIGATÓRIO)** — dentro de `prisma.$transaction(async (tx) => ...)` é proibido:

    - Chamar helper que usa o **cliente Prisma global** em vez do `tx` (ex.: `trackLeadEvent`, `recordLeadEvent`, `logActivity`). Rodando em outra conexão, uma query que toque linha travada pela própria transação espera por ela — que por sua vez espera a query. Espera circular resolvida só pelo timeout de 5s, virando **500**.
    - Fazer I/O de rede: `fetch`, Pusher, Inngest, envio de e-mail.

    **Padrão correto**: colete os efeitos numa lista dentro da tx (`pendingLeadEvents`, `pendingJourneyEvents`) e execute **após o commit**, best-effort — falha em efeito colateral não pode invalidar a submissão já persistida. Ver `src/app/router/form/public/submut-response.ts` como referência.

    Esse bug já custou dois PRs de correção que miravam a causa errada. Ao mexer em qualquer procedure com `$transaction`, confira essa regra antes de commitar.

19. **Documentação da evolução arquitetural** — sempre que criar ou alterar qualquer coisa em `src/modules/`, nas regras de fronteira (`.dependency-cruiser.js`), no CI (`.github/workflows/`), na configuração de testes (`vitest.config.*`, `playwright.config.*`, `docker-compose.test.yml`), ou ao concluir/reordenar uma fase do roadmap, **atualize também [`docs/arquitetura-evolucao-overview.md`](docs/arquitetura-evolucao-overview.md)** na mesma sessão — tabela de status, roadmap, decisões e changelog sincronizados com o código. Espelha as regras 10 (NASA Route) e 14 (WhatsApp Oficial).

    Documentos satélite, com a mesma obrigação: [`docs/seguranca-auditoria-2026-08.md`](docs/seguranca-auditoria-2026-08.md) (ao corrigir um item da auditoria, marque o status e registre o PR — **não apague o item**) e [`docs/testes-estrategia.md`](docs/testes-estrategia.md) (ao mudar runner, pipeline ou quality gate).

    **Antes de propor arquitetura, teste ou CI neste projeto, leia o overview.** Ele registra decisões já travadas — arquitetura alvo (Hexagonal seletivo, não Clean Architecture ampla), escopo (piloto `form`, não migração ampla) e o que foi deliberadamente descartado, com o porquê. Repropor algo já descartado sem novo argumento custa tempo do time.

20. **Deriva conhecida entre este arquivo e o código** — auditoria de 2026-08-18 encontrou divergências ainda não corrigidas. Enquanto não forem, **confie no código, não neste documento**, nestes pontos: procedures oRPC estão em `src/app/router/` (não em `src/server/`, que não existe); a Regra 9 tem 518 violações; a Regra 5 convive com Jotai além de Zustand; a Regra 17 é **inexequível** (não há runner de teste instalado); `.claude/settings.json` não existe (o hook `PreToolUse` descrito no Git Workflow não está ativo); `.env.example` e `prisma/migrations/MANUAL_*.sql` referenciados em `docs/DEPLOYMENT.md` não existem — `scripts/apply-prod-migrations.sh` quebra por causa disso. Lista completa em [`docs/arquitetura-evolucao-overview.md`](docs/arquitetura-evolucao-overview.md) §3.5. Corrigir a deriva é item da Fase 0.

21. **Guias do Astro na tela (OBRIGATÓRIO)** — o Astro ensina a usar a plataforma destacando botões e campos reais (spec [0046](specs/astro/0046-astro-guia-na-tela.md)), em vez de prints que envelhecem. Para isso continuar funcionando sozinho:

    a. **Botão ou campo relevante de tela nova** ganha âncora: registre em `GUIDE_ANCHORS` (`src/features/astro-guides/lib/anchors.ts`) com uma descrição curta e use `data-guide={GUIDE_ANCHORS.<chave>.id}` no componente.

    b. **Funcionalidade nova** ganha guia em `ASTRO_GUIDES` (`src/features/astro-guides/lib/registry.ts`): passos apontando para as âncoras, `topicPattern` com o assunto do pedido e, se houver artigo no Space Help, `spaceHelp` para o botão "Me mostre na tela" aparecer nele.

    c. **Ao mover, renomear ou remover** um componente com `data-guide`, rode `pnpm guides:check` — ele falha se algum guia ficou apontando para âncora que não existe mais.

    d. **Ação que termina um guia** (salvar lead, criar tracking) chama `emitTourResult({ kind: GUIDE_RESULT_KINDS.<tipo>, href? })` de `@/features/tour/store` no `onSuccess`. O `kind` diz o que foi feito: sem ele, qualquer ação encerraria qualquer guia (spec [0048](specs/astro/0048-astro-guia-em-outros-apps.md)). `pnpm guides:check` falha se um passo espera um tipo que nenhuma tela emite.

    e. **Guias por app** moram em `src/features/astro-guides/lib/guides/<app>.ts`. No `ASTRO_GUIDES`, assuntos mais específicos vêm antes (enviar/publicar antes de criar; Forge e Chat antes do Tracking).

22. **Tipo do cliente Prisma em parâmetros (OBRIGATÓRIO)** — função que aceita "cliente global ou transação" recebe `Prisma.TransactionClient` (ou `Pick<Prisma.TransactionClient, ...>`); se precisa de `$transaction`, recebe `AppPrismaClient` de `@/lib/prisma`. **Proibido**: o tipo público `PrismaClient` em anotações, união com o cliente, `Omit`/`Pick` de `typeof prisma`. Esses padrões fazem o TypeScript comparar os ~300 models estruturalmente — um único arquivo custava 63 s e a checagem de tipos passava de 12 GB, derrubando o build. O ESLint barra; os genéricos fixos em `src/lib/prisma.ts` não podem ser removidos. Ver [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §0.1.

23. **Documentação da aba Contábil** — sempre que criar ou alterar qualquer coisa em `src/features/accounting/`, `src/app/router/accounting/`, `src/inngest/functions/accounting/`, nos modelos contábeis do `prisma/schema.prisma` (seção "ABA CONTÁBIL") ou nas tabelas de alíquotas (`lib/tax/seed/default-tax-rates.ts`), **atualize também [`docs/contabil-overview.md`](docs/contabil-overview.md)** na mesma sessão. Espelha as regras 10, 14 e 19. Regras do domínio: alíquota **nunca** fixa em código de cálculo (vem de `TaxRate`, versionada por vigência); a contabilidade é **derivada** do `PaymentEntry` (nunca escriturada em paralelo); toda explicação de termo técnico vem do glossário (`lib/glossary/terms.ts`) — novo rótulo técnico na aba exige `FiscalTermHint`; mudança em motor fiscal exige caso novo em `scripts/accounting-qa-check.ts` citando o `CA-n` da spec 0051.

24. **Build leve e deployável (OBRIGATÓRIO)** — o `next build` roda **fora da VPS**, sem banco e sem segredos: no CI de PR (`next build` direto no runner) e na imagem Docker do deploy (GitHub Actions → GHCR → Coolify). Em 2026-09-30 a checagem de tipos chegava a 12,8 GB e derrubava o deploy; hoje fica em ~6 GB e 96 s. Para não regredir:

    a. **Nada que exija variável de ambiente ou rede no import do módulo.** Na coleta de páginas o build carrega os módulos das rotas; cliente criado no topo do arquivo que lança erro sem chave (Resend) ou sem config (Pusher sem cluster) quebra o build. Crie sob demanda ou com placeholder, como `src/lib/stripe.ts` e `src/lib/email/resend.ts`.

    b. **`NEXT_PUBLIC_*` nova** é embutida no bundle **no build**: adicione ao secret `NEXT_PUBLIC_ENV` do GitHub (senão chega `undefined` no browser em produção, sem erro). Se ela for lida no import de algum módulo, adicione também um placeholder em `.github/ci-public.env` — o CI de PR não recebe secrets.

    c. **Página que consulta o banco no build** (`generateStaticParams`, `revalidate` com prerender) envolve a consulta em `try/catch` e degrada (ex.: `generateStaticParams` devolve `[]`). O build não tem banco.

    d. **Scripts e seeds avulsos** ficam em `scripts/` ou `prisma/`, que estão fora da checagem de tipos (rodam via `tsx`). Em `src/` eles entram no build — um seed sozinho custava 65 s.

    e. **Tipos do Prisma**: regra 22. É a causa principal de memória na checagem de tipos.

    f. **Lib pesada só de servidor** (SDK de IA, AWS, parsers, binários nativos) entra em `serverExternalPackages` no `next.config.ts`.

    g. **Medir antes de aceitar regressão.** O log do CI mostra `Finished TypeScript in Ns` (referência: ~96 s frio, ~18 s com cache). Passou de ~3 min, ou o build pediu mais memória: rode **Actions → Typecheck diagnostics**, que aponta os arquivos mais caros, antes de aumentar heap ou runner.

    h. **Migration nova roda no boot do container** (`docker/entrypoint.sh`) a cada deploy. Migration quebrada impede o container novo de subir (a versão anterior segue no ar, mas o deploy trava) — revise o SQL antes do merge.

    Detalhes, números e armadilhas do Coolify em [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) §0 e §0.1; pipeline em [`docs/testes-estrategia.md`](docs/testes-estrategia.md) §8.0.

## Obsidian

Vault: `NASA Agents` em `/Users/weydsonlima/Documents/NASA Agents/`
Nota principal: `CLAUDE.md` no vault (cópia desta documentação + contexto extra)
