# App COMMENTS — Automações de redes sociais

> **Regra de manutenção:** este documento é a fonte de verdade do domínio.
> Sempre que mexer em `src/modules/social/`, `src/app/router/comments/`,
> `src/app/api/social/webhook/`, `src/features/comments/` ou nos modelos
> `Social*` do `prisma/schema.prisma`, **atualize este arquivo na mesma sessão** —
> tabelas de arquivos, roadmap (✅/🚧/⬜) e changelog sincronizados com o código.
> Espelha as regras 10 (NASA Route) e 14 (WhatsApp Oficial) do CLAUDE.md.

Spec de origem: [`specs/comments/0024-comments-automacoes-instagram-nativas.md`](../specs/comments/0024-comments-automacoes-instagram-nativas.md).

---

## 1. O que é

Automatiza resposta a **comentários** e **directs** do Instagram: quando um
evento casa as regras de um gatilho, o app manda DM ao autor e, opcionalmente,
responde publicamente no comentário.

Substitui o **comments-app** (projeto Next.js separado, descontinuado) e o proxy
S2S que o NASA mantinha para falar com ele.

**O modelo é agnóstico de rede social.** Nada no schema cita Instagram: a rede é
o valor `SocialProvider`. Acrescentar Facebook, WhatsApp ou Telegram é escrever
um adapter — não alterar domínio nem migrar tabela.

## 2. Arquitetura — Ports & Adapters

Primeiro módulo em `src/modules/`, na forma definida em
[`arquitetura-evolucao-overview.md`](arquitetura-evolucao-overview.md) §5.2.

```
src/modules/shared/
├─ domain/    DomainError · TenantScope
├─ ports/     Clock · IdGenerator · RandomPicker · Logger
└─ infra/     systemClock · cryptoRandomPicker · consoleLogger

src/modules/social/
├─ domain/       types · text-normalizer · match-rule · trigger-selection
│                message-chunker · reply-picker · automation-readiness · errors
├─ ports/        channel-gateway · inbound-translator · repositories
│                ai-reply-generator
├─ application/  handle-inbound-event · connect-channel · activate-automation
├─ infra/        instagram/{graph-channel-gateway,webhook-translator}
│                prisma-{channel,automation,event}-repository
│                credential-cipher · schemas · stars-ai-reply-generator
└─ index.ts      composition root
```

| Arquivo | Papel |
| --- | --- |
| `domain/match-rule.ts` | Avalia INCLUDE/EXCLUDE/ANY_TEXT. **Exclusão vence sempre** |
| `domain/trigger-selection.ts` | Escolhe **um** gatilho: específico > mais termos > mais antigo |
| `domain/message-chunker.ts` | Limite em **caracteres**: 1000 sem botão, 640 com botão (vira template). Conta por code point |
| `domain/reply-picker.ts` | Sorteia a variação da resposta pública |
| `domain/automation-readiness.ts` | O que falta para ativar — alimenta botão e nó vermelho |
| `application/handle-inbound-event.ts` | Caso de uso central do webhook |
| `infra/instagram/*` | **Único** ponto do módulo que conhece o formato da Meta |
| `index.ts` | Composition root — único lugar que instancia adapter |

### Adapters primários

| Rota | Papel |
| --- | --- |
| `POST/GET /api/social/webhook/instagram/[token]` | Webhook, **um endpoint por conexão** |
| `src/app/router/comments/channel.ts` | Conectar, desconectar, status, listar publicações |
| `src/app/router/comments/automations.ts` | CRUD, salvar gatilho, ativar, histórico |

### UI

| Arquivo | Papel |
| --- | --- |
| `features/comments/components/channel-connect-card.tsx` | Credenciais + URL do webhook com copiar |
| `features/comments/components/automations-list.tsx` | Lista e criação |
| `features/comments/components/automation-editor.tsx` | Painel guiado em 3 passos |
| `features/comments/components/automation-canvas.tsx` | Canvas `@xyflow` derivado dos dados |
| `features/comments/components/runs-panel.tsx` | Histórico — responde "por que não respondeu?" |
| `features/comments/hooks/use-comments-*.ts` | Toda chamada oRPC (regra 9) |

Rotas: `/comments` e `/comments/automations/[id]`.

## 3. Banco

10 tabelas, 11 enums — migration `20260924120000_social_automations_channel_agnostic`.

| Tabela | Papel |
| --- | --- |
| `social_channels` | Conexão por org. `credentials` cifrado; `webhook_path_token` roteia o webhook |
| `social_contacts` | Quem interage. `last_inbound_at` = janela de 24h; `lead_id` = ponte futura |
| `social_automations` | Nome, ativo, canal |
| `social_triggers` | Tipo de evento, escopo de conteúdo, lógica de match |
| `social_trigger_targets` | Conteúdo observado (post/reel/vídeo) |
| `social_match_rules` | `kind` × `operator` × `terms` |
| `social_flow_steps` | Passos. `parent_step_id`/`branch_key` prontos para fluxo encadeado |
| `social_inbound_events` | Idempotência: `@@unique([provider, external_event_id])` |
| `social_automation_runs` | Execução — espelha `WorkflowRun` |
| `social_step_runs` | Passo executado — espelha `WorkflowNodeRun` |

Sem contadores denormalizados: `sentCount` é derivado dos runs.

## 4. Segurança

| Ponto | Decisão |
| --- | --- |
| Credenciais | `accessToken`, `appSecret`, `verifyToken` cifrados (AES-256-GCM, `AI_SECRETS_KEY`). UI só vê `••••1234` |
| Assinatura | `x-hub-signature-256` sobre o **raw body**, `timingSafeEqual`, fail-closed |
| Handshake | `hub.verify_token` comparado ao da conexão daquele token de URL |
| Tenancy | `findByWebhookPathToken` é a **única** leitura sem escopo; dela nasce o `TenantScope` |
| Conta duplicada | `@@unique([provider, external_account_id])` impede duas orgs na mesma conta |
| Papel | Conectar/desconectar exige owner ou admin |
| Desconectar | **Desativa, não apaga.** `SocialAutomation`/`SocialContact`/`SocialInboundEvent` cascateiam do canal — deletar a linha destruía a configuração do usuário. Também preserva o `webhook_path_token`, mantendo válida a URL já registrada na Meta |
| Uma conexão por organização | Invariante do módulo (spec 0024 D-13): `connect` **reaproveita a linha existente**, inclusive ao trocar de conta. Criar uma segunda linha fazia as leituras (`findFirst` pela mais antiga) continuarem devolvendo a conta anterior. A linha mais antiga é a canônica — é ela que automações, contatos, histórico e a URL registrada na Meta referenciam |

## 5. Configuração pelo usuário

1. Criar App na Meta com Instagram habilitado.
2. Em `/comments`, informar Instagram Account ID, Access Token, App Secret e um Verify Token à escolha. O token é conferido contra a Graph API antes de salvar.
3. Copiar a URL do webhook exibida e colar no App da Meta (Webhooks → Instagram), com o mesmo verify token.
4. Assinar os campos `comments` e `messages` no painel do App.

> ⚠️ Assinar os campos no painel diz apenas **quais** eventos o app quer — não faz a
> conta entregar nada. É preciso inscrever o app na conta
> (`POST /{ig-user-id}/subscribed_apps?subscribed_fields=comments,messages`). O
> `connectChannel` faz isso automaticamente desde 2026-09-24; conexões anteriores
> se resolvem com o botão **Reativar recebimento** no card da conta. Sintoma de
> quem está sem inscrição: a verificação da URL responde 200 e **nenhum POST**
> chega depois. Mesmo papel de `src/http/whats-oficial/subscribe-app.ts`.

Env: nenhuma nova. Usa `AI_SECRETS_KEY` e, para montar a URL do webhook,
`NEXT_PUBLIC_BASE_URL` (ou `NEXT_PUBLIC_APP_URL`).

> A URL mostrada na tela resolve nesta ordem: **env** → **headers da requisição**
> (`x-forwarded-host`/`x-forwarded-proto`, preenchidos pelo proxy) → `localhost`.
> `NEXT_PUBLIC_*` é congelada no build: se o deploy não receber a variável como
> build arg, o valor sai `undefined` no bundle e variável de runtime não
> conserta. O fallback por header garante a URL correta mesmo nesse caso. A env
> tem precedência porque é o único jeito de apontar o webhook para um túnel
> enquanto se navega em `localhost`.

## 6. Coexistência com a integração Instagram existente

`/api/integrations/instagram/webhook` (DM → Lead no Tracking) **não foi tocado**.
São mundos separados: aquele usa o App Meta central do NASA via OAuth; este usa
o App do próprio cliente. Se a mesma conta estiver nos dois, ambos agem — um
cria lead, o outro responde. Sem dedupe entre sistemas nesta fase.

## 7. Roadmap

| Fase | Item | Status |
| --- | --- | --- |
| 1 | Modelo agnóstico + migration | ✅ |
| 1 | Núcleo hexagonal (domain/ports/application/infra) | ✅ |
| 1 | Webhook com assinatura e idempotência | ✅ |
| 1 | Conexão por credenciais manuais | ✅ |
| 1 | Match contém / não contém / qualquer | ✅ |
| 1 | Alvo todas as publicações ou específicas | ✅ |
| 1 | DM com até 3 botões + resposta pública sorteada | ✅ |
| 1 | Resposta por IA cobrada em Stars | ✅ |
| 1 | Editor painel + canvas derivado | ✅ |
| 1 | Histórico de execuções | ✅ |
| 1 | Job de limpeza de `social_inbound_events` | ⬜ |
| 1 | Resposta com IA fora do request (Inngest) | ⬜ |
| 2 | Canvas editável, passos encadeados, delay, condição | ⬜ |
| 2 | Quick replies (postback) | ⬜ |
| 3 | OAuth substituindo credencial manual | ⬜ |
| 3 | Rate limit por automação · cooldown por autor | ⬜ |
| 3.5 | Facebook, WhatsApp, Telegram | ⬜ |
| 4 | Comentário vira Lead no Tracking | ⬜ |

## 8. Dívidas conhecidas

- **`SocialInboundEvent` cresce sem limite** — o job de limpeza ainda não existe.
- **IA roda dentro do request do webhook.** A spec previa Inngest para esse
  caminho (D-4); ficou como dívida para não segurar a entrega. Com prompt longo,
  pode passar do tempo confortável de resposta à Meta.
- **`social_contacts.lead_id` não é FK** e ninguém escreve nele ainda.
- **Alvo de publicação não é validado contra a conta conectada.** Na troca de
  conta, as automações com alvo específico são desativadas e o usuário é avisado
  (D-13), mas nada impede reativá-las sem reescolher os posts — e aí o gatilho
  não casa, porque o id do post é de outra conta. A validação na ativação exige
  uma consulta ao provider e ficou para depois.
- O proxy antigo segue no repo, desregistrado, em `src/app/router/comments-remote/`
  e `src/http/comments/`.

## 9. Changelog

| Data | Mudança |
| --- | --- |
| 2026-09-24 | **Trocar de conta passou a funcionar.** `connect` criava uma linha nova quando o `external_account_id` mudava — o unique é `(provider, account)`, então não havia colisão — e as leituras, que pegam a linha mais antiga da organização, seguiam devolvendo a conta anterior: a UI dizia "conectada" e mostrava a conta errada, sem como sair dela. Agora a troca reaproveita a linha canônica (preserva automações, histórico e a URL na Meta), remove linhas órfãs de tentativas anteriores e desativa as automações que apontavam para publicações da conta antiga, informando quantas |
| 2026-09-24 | Credencial recusada passou a ser sinalizada pelo `DispatchResult.authError` do gateway (status 401/403) em vez de regex sobre o texto do erro, que marcaria a conexão como quebrada em qualquer mensagem contendo "token" |
| 2026-09-24 | Publicação escolhida volta a mostrar miniatura: o editor descartava `contentType`/`mediaUrl` ao carregar e gravava o vazio por cima no save seguinte. `TriggerTarget` passou a carregar os campos de apresentação, e a miniatura cai para ícone por tipo quando a URL da Meta expira |
| 2026-09-24 | Limite de texto passou de bytes (950) para **caracteres** (1000 sem botão / 640 com botão) — medir bytes roubava caracteres em português. Botões deixaram de ser descartados em silêncio no salvar: viraram lista clicável com diálogo de edição, validação de título e URL, e `https://` automático |
| 2026-09-24 | `disconnect` passou a **desativar** (`status = DISABLED`) em vez de deletar: a cascata do canal apagava automações, gatilhos, respostas e histórico, e trocava o `webhook_path_token`, invalidando a URL na Meta. Novo `channel.reactivate` religa e reinscreve |
| 2026-09-24 | `connectChannel` passou a inscrever o app nos eventos da conta (`subscribed_apps`) e o card ganhou **Reativar recebimento**. Sem isso a conta nunca entregava evento — descoberto no primeiro teste real |
| 2026-09-24 | Criado. Migração do comments-app para módulo nativo: 10 tabelas, núcleo hexagonal em `src/modules/social`, webhook por conexão, editor com canvas derivado. Proxy S2S desregistrado |
