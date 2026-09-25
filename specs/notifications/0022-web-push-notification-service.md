---
id: 0022
titulo: NotificationService genérico com adapter Web Push
dominio: notifications
status: implementada # rascunho | em-revisao | aprovada | implementada | descartada
autor: João Gabriel
criada: 2026-09-21
atualizada: 2026-09-21
branch: claude/trafego-improvements-58fa5b
pr:
peso: completa
---

# 0022 — NotificationService genérico com adapter Web Push

---

## 1. Contexto

A [spec 0021](../trafego/0021-trafego-captura-lead-e-notificacao-admin.md) entregou
popup em tempo real para lead novo do trafeGO. O popup só existe **enquanto a aba
está aberta**: o `AlertProvider` escuta Pusher no browser. Admin com o navegador
fechado não fica sabendo de nada — e o lead de campanha paga esfria.

Hoje há um único caminho de entrega, e ele é concreto de ponta a ponta. Em
[`notification-service.ts`](../../src/features/admin/lib/notification-service.ts),
`createNotification` grava `AdminNotification` **e** chama `pusherServer.trigger`
direto. Não existe ponto de injeção: acrescentar um canal significa editar essa
função e acoplar mais um vendor a ela.

O repositório já tem o desenho certo para isto em outro lugar:
[`src/lib/realtime/`](../../src/lib/realtime/types.ts) define portas
(`RealtimePublisher`, `RealtimeSubscriber`, `ChannelAuthorizer`), adapters Pusher
e um composition root que é o único arquivo que conhece a lib concreta. É esse
padrão que esta spec replica para notificações.

O overview de arquitetura ([§5.1](../../docs/arquitetura-evolucao-overview.md))
trava **Hexagonal seletivo**: porta + adapter onde falta *seam* de teste, sem
camada de use case sobre o que é CRUD ou infraestrutura. Entrega de notificação é
infraestrutura transversal, não domínio — por isso mora em `src/lib/`, como
`realtime`, e **não** em `src/modules/` (que ainda não existe; criá-lo aqui
abriria a Fase 0 sem autorização).

## 2. Objetivo

Qualquer módulo dispara notificação por `notificationService.send({...})` sem
saber qual canal entrega, e Web Push passa a ser um desses canais — com o lead do
trafeGO como primeiro consumidor.

### Não-objetivos

- **Não** substitui o popup nem o Pusher. Web Push é canal **adicional**; o
  `AlertProvider` continua igual.
- **Não** migra os outros 20 tipos de `NOTIF_TYPES` para push. A integração é só
  com `TRAFEGO_LEAD_CAPTURED` (spec 0021).
- **Não** implementa canal de e-mail nem SMS. As portas preveem, esta spec não entrega.
- **Não** transforma o app em PWA instalável. O Service Worker existe só para
  receber push; sem manifest, sem cache offline, sem estratégia de fetch.
- **Não** mexe em `UserNotificationPreference`. Preferência por tipo de push fica
  para depois; o opt-in do browser já é o controle do usuário.
- **Não** cria `src/modules/`. Ver [D-1](#d-1--notificação-é-infra-transversal-mora-em-srclibnotifications).
- **Não** suporta iOS < 16.4 nem Safari fora de PWA instalado. Limitação da
  plataforma, tratada como "push indisponível".

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | `notificationService.send(input)` aceita destinatários, conteúdo e canais, e devolve o resultado por canal. |
| RF-2 | O serviço não conhece nenhum caso de uso: a assinatura é genérica (título, corpo, url, dados). |
| RF-3 | Canais são registrados num composition root; acrescentar canal não altera quem chama. |
| RF-4 | O adapter Web Push usa `web-push` com VAPID e entrega para **todas** as subscriptions ativas do usuário. |
| RF-5 | Um usuário pode ter N subscriptions (um registro por browser/dispositivo). `endpoint` é único globalmente. |
| RF-6 | `push.subscribe` grava a subscription do usuário logado; repetir o mesmo endpoint atualiza em vez de duplicar. |
| RF-7 | `push.unsubscribe` remove a subscription **do próprio usuário** — nunca a de outro. |
| RF-8 | Subscription que o push service reporta como morta (404/410) é apagada automaticamente no envio. |
| RF-9 | O Service Worker exibe a notificação e, no clique, foca uma aba existente ou abre a `url`. |
| RF-10 | O SW trata `pushsubscriptionchange` re-inscrevendo e reenviando ao backend. |
| RF-11 | Uma camada de client reutilizável cobre registrar SW, pedir permissão, assinar e cancelar — sem citar trafeGO. |
| RF-12 | Sem VAPID configurado, o canal se declara indisponível e o envio é no-op — nada quebra. |
| RF-13 | O lead novo do trafeGO passa a disparar push, além do popup. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | Falha de push **nunca** propaga para quem chamou: entrega é best-effort, como já é o Pusher. |
| RNF-2 | Envio a N subscriptions é paralelo e isolado — uma falha não impede as outras. |
| RNF-3 | Funciona em `http://localhost` (contexto seguro por definição) e em produção HTTPS. |
| RNF-4 | `notificationService.send` não roda dentro de `$transaction` (CLAUDE.md regra 18). |
| RNF-5 | Chaves VAPID privadas nunca chegam ao bundle do client. |

## 4. Critérios de aceite

- [x] **CA-1** — Dado VAPID configurado e usuário com subscription ativa, quando `notificationService.send` é chamado com canal `web-push`, então o browser exibe a notificação com título e corpo enviados.
- [ ] **CA-2** — Dado usuário com duas subscriptions (dois browsers), quando envia, então as duas recebem.
- [ ] **CA-3** — Dado `push.subscribe` chamado duas vezes com o mesmo endpoint, então existe **uma** linha, com `lastUsedAt` atualizado.
- [ ] **CA-4** — Dado subscription cujo endpoint responde 410, quando envia, então a linha é apagada e o resultado marca a entrega como falha sem lançar.
- [ ] **CA-5** — Dado usuário A autenticado, quando tenta `push.unsubscribe` de endpoint do usuário B, então nada é apagado.
- [ ] **CA-6** — Dado `VAPID_PRIVATE_KEY` ausente, quando envia, então retorna `skipped` e nenhum erro sobe.
- [ ] **CA-7** — Dado lead novo do trafeGO capturado, quando a notificação é criada, então admins com subscription recebem push **e** popup.
- [ ] **CA-8** — Dado clique na notificação, quando já existe aba do app aberta, então ela é focada em vez de abrir outra.
- [x] **CA-9** — Dado usuário que nega a permissão, quando a camada de client roda, então ela reporta `denied` e não tenta assinar.
- [ ] **CA-10** — Dado `notificationService.send` para usuário sem nenhuma subscription, então retorna sucesso vazio, sem erro.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Browser sem suporte a `serviceWorker`/`PushManager` | Camada de client devolve `unsupported`; nenhuma UI de opt-in aparece. |
| CB-2 | Permissão já `denied` | Não chama `requestPermission` de novo (o browser não reexibe); reporta estado. |
| CB-3 | `endpoint` já existe, mas pertence a **outro** usuário | Reassocia ao usuário atual. É o mesmo browser depois de troca de conta. |
| CB-4 | Push service devolve 404 ou 410 | Apaga a subscription (RF-8). |
| CB-5 | Push service devolve 413 (payload grande) | Não apaga; loga. Corpo é truncado antes de enviar. |
| CB-6 | Push service devolve 429 | Não apaga; loga. Não há retry nesta fase. |
| CB-7 | `pushsubscriptionchange` disparado pelo browser | SW re-inscreve com a mesma chave e reenvia ao backend (RF-10). |
| CB-8 | Usuário limpa dados do site | Subscription morre silenciosamente; o próximo envio cai em CB-4 e limpa. |
| CB-9 | VAPID trocado depois de haver subscriptions | Envios passam a falhar com 403; **não** apagamos por 403, para não perder a base num erro de config. Loga alto. |
| CB-10 | Dois envios concorrentes para a mesma subscription morta | Ambos tentam apagar; o `delete` é idempotente (`deleteMany`). |
| CB-11 | Usuário logado em aba anônima | Subscription nasce e morre com a sessão do browser; CB-4 limpa depois. |
| CB-12 | Service Worker antigo em cache | `updateViaCache: "none"` no registro, para não servir SW velho. |
| CB-13 | App servido em HTTP não-localhost | `isSecureContext` é falso; camada reporta `unsupported` sem estourar. |
| CB-14 | Envio com `userIds` vazio | Retorna resultado vazio sem tocar o banco. |

## 6. Decisões de design

### D-1 — Notificação é infra transversal: mora em `src/lib/notifications/`

- **Escolha**: espelhar `src/lib/realtime/` — `types.ts` (portas), adapters por
  canal, `index.ts` como composition root.
- **Alternativas descartadas**: (a) `src/modules/notifications/` com
  `domain/application/ports/infra`. Descartada porque entrega de notificação não
  tem invariante de negócio — é I/O. O overview §5.1 chama isso de "cerimônia
  sobre CRUD", e `src/modules/` é entregável da Fase 0, que não começou; criá-lo
  aqui forkaria o roadmap. (b) Estender `features/admin/lib/notification-service.ts`.
  Descartada porque amarra infra genérica a uma feature — qualquer módulo que
  quisesse push passaria a importar `features/admin`.
- **Consequência**: a regra 2 do CLAUDE.md (`src/lib/` só infra global) é
  respeitada, e a direção de dependência fica feature → lib.

### D-2 — `send` recebe userIds, não subscriptions

- **Escolha**: `send({ userIds, notification, channels })`. Resolver destino é
  responsabilidade do canal.
- **Alternativas descartadas**: quem chama passa endpoints. Descartada porque
  vazaria detalhe de Web Push para todo consumidor, e e-mail/SMS futuros teriam
  outra forma de endereçar.
- **Consequência**: o canal Web Push faz uma query própria. Custo aceitável.

### D-3 — Sem fila nem retry nesta fase

- **Escolha**: envio direto, best-effort, no mesmo request.
- **Alternativas descartadas**: job Inngest por notificação. Descartada por ser
  cedo — o volume é baixo (spec 0021: um evento raro, ~6 admins) e a fila
  acrescenta peça de operação antes de haver problema que a justifique.
- **Consequência**: push perdido em indisponibilidade do push service não é
  reenviado. O registro `AdminNotification` continua no bell, que é o fallback.
  Migrar para fila depois é trocar o corpo de `send`, sem mexer em quem chama.

### D-4 — 403 não apaga subscription; 404/410 apagam

- **Escolha**: só remove no que o protocolo define como "foi-se" (`Gone`/`Not Found`).
- **Alternativas descartadas**: apagar em qualquer 4xx. Descartada porque um VAPID
  trocado por engano devolve 403 em **todas** as subscriptions — e apagaríamos a
  base inteira por erro de configuração (CB-9).
- **Consequência**: subscription com 403 persistente fica ocupando linha. Preferível
  a perda irreversível.

### D-5 — Service Worker escrito à mão em `public/sw.js`

- **Escolha**: arquivo estático, servido da raiz, sem `next-pwa`.
- **Alternativas descartadas**: `next-pwa`/Serwist. Descartada porque traz cache
  offline, precache e estratégias de fetch que ninguém pediu, num app com 925
  procedures — risco de servir HTML velho. Só precisamos de `push` e
  `notificationclick`.
- **Consequência**: sem build step para o SW. Ele é pequeno e não importa nada.

### D-6 — Chave pública VAPID via `NEXT_PUBLIC_`

- **Escolha**: `NEXT_PUBLIC_VAPID_PUBLIC_KEY` no bundle.
- **Alternativas descartadas**: procedure para buscar a chave. Descartada por ser
  um round-trip para servir um valor que é público por definição do protocolo.
- **Consequência**: trocar a chave exige rebuild. É operação rara e já quebraria
  as subscriptions de qualquer forma (CB-9).

## 7. Impacto

- [x] Schema / migration — model `PushSubscription`
- [x] Procedures oRPC — `push.subscribe`, `push.unsubscribe`, `push.listMine`
- [x] Realtime — nenhum canal Pusher novo; push é caminho paralelo
- [ ] Automações (Inngest)
- [x] Env vars novas — `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
- [ ] Breaking change para clientes existentes
- [x] Documentação obrigatória — esta spec + CLAUDE.md (env vars)

## 8. Plano de testes

> ⚠️ Sem runner de teste instalado (CLAUDE.md item 20). Verificação manual, cada
> passo citando o `CA-n`.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual | Ativar push no app, disparar envio, ver a notificação do SO. |
| CA-2 | manual | Assinar em dois browsers, disparar, conferir nos dois. |
| CA-3 | manual | Chamar `push.subscribe` duas vezes; `select count(*)` = 1. |
| CA-4 | manual | Adulterar endpoint no banco, disparar, conferir que a linha some. |
| CA-5 | manual | Chamar `unsubscribe` com endpoint alheio; conferir que a linha continua. |
| CA-6 | manual | Remover `VAPID_PRIVATE_KEY`, disparar, conferir `skipped` e ausência de erro. |
| CA-7 | manual | Captura de lead do trafeGO com admin inscrito: push + popup. |
| CA-8 | manual | Com aba aberta, clicar na notificação; a aba é focada. |
| CA-9 | manual | Negar permissão; a camada reporta `denied`. |
| CA-10 | manual | Enviar para usuário sem subscription; sem erro. |

## 9. Riscos e rollback

**Migration** — cria tabela nova, não toca em nada existente. Reversível com
`DROP TABLE`. Sem VAPID configurado o sistema segue idêntico ao de hoje (RF-12).

**Risco 1 — permissão negada é irreversível pelo app.** Um pedido de permissão no
momento errado queima a chance para sempre naquele browser. Mitigação: o opt-in é
explícito, por clique, nunca automático no load.

**Risco 2 — `public/sw.js` no escopo raiz.** Um SW na raiz intercepta o site
inteiro. Mitigação: D-5 — o SW não registra `fetch`, então não tem como servir
conteúdo velho.

**Risco 3 — vazamento de chave privada.** Mitigação: RNF-5; só a pública leva
prefixo `NEXT_PUBLIC_`; o adapter é `server-only`.

**Risco 4 — notificação com dado sensível na tela de bloqueio.** O corpo do push
carrega nome/telefone do lead. Aceito: é o mesmo dado do popup, e o destinatário é
admin do sistema. Registrado para revisão de LGPD junto com a spec 0021.

**Rollback**: remover `web-push` dos canais no composition root desliga tudo sem
migration reversa.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-09-21 | João Gabriel | Criada |
| 2026-09-22 | João Gabriel | Infraestrutura implementada e build verde. **Migration ainda NÃO aplicada** — nenhum CA de entrega pôde ser verificado. Verificado: SW servido em `/sw.js` com os três handlers e sem `fetch`; as três procedures respondem 401 a anônimo. |
| 2026-09-22 | João Gabriel | Entrega confirmada ponta a ponta. CA-1 e CA-9 verificados. Dois bugs corrigidos: `navigator.serviceWorker.ready` pendurava quando não havia SW registrado (botão nunca aparecia), e o cache do Turbopack servia chunk compilado sem a `NEXT_PUBLIC_VAPID_PUBLIC_KEY`. A ausência de notificação na tela era o Chrome desativado nas notificações do Windows — fora do código. Acrescentada a página `/push-test`. |
| 2026-09-22 | João Gabriel | Removidas a página `/push-test`, o `PushTestPanel` e a procedure `push.sendTest`, a pedido. Serviram para isolar as três falhas distintas do push durante a entrega; com o fluxo funcionando, o botão do cabeçalho do admin basta. `subscribe`, `unsubscribe` e `listMine` seguem. |
