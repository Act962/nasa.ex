---
id: 0007
titulo: Acesso ao módulo financeiro por whitelist, sem senha própria
dominio: payment
status: aprovada
autor: João Gabriel
criada: 2026-08-26
atualizada: 2026-08-26
branch: claude/payment-feature-bug-3436e2
pr:
peso: completa
---

# 0007 — Acesso ao módulo financeiro por whitelist, sem senha própria

---

## 1. Contexto

Usuários em produção estão sendo **trancados fora do módulo financeiro**. O
sintoma relatado: a tela de desbloqueio devolve o toast **"Erro ao verificar
senha"**, e a única saída conhecida pelo time é pedir a um OWNER que **gere uma
senha nova** — que também não resolve. O caminho foi descrito pelo dono do
produto como "exaustivo e bastante precário".

### Diagnóstico

O toast "Erro ao verificar senha" **não significa senha incorreta**. Ele existe
num único lugar — o `catch` de `handlePinSubmit`
([payment-gate.tsx](../../src/features/payment/components/access/payment-gate.tsx)) —
e só dispara quando o servidor devolve **500**. Senha incorreta produz outra
mensagem ("Senha incorreta. Tentativa n/5").

Cadeia real da falha, com a senha **correta**:

| # | Passo | Arquivo |
| --- | --- | --- |
| 1 | Senha confere via bcrypt | [access.ts:196](../../src/app/router/payment/access.ts) |
| 2 | É o 10º desbloqueio (`otpEveryNSessions`, default 10) → exige OTP | [access.ts:207](../../src/app/router/payment/access.ts) |
| 3 | Tenta enviar OTP por WhatsApp | [access.ts:243](../../src/app/router/payment/access.ts) |
| 4 | Envio estoura — sem `UAZAPI_TOKEN` ou resposta não-2xx da uazapi | [access.ts:96](../../src/app/router/payment/access.ts), [client.ts:34](../../src/http/uazapi/client.ts) |
| 5 | Exceção não tratada → `INTERNAL_SERVER_ERROR` → toast enganoso | [access.ts:253](../../src/app/router/payment/access.ts) |

### Por que virou travamento permanente

No passo 3, `sessionCount` **não é incrementado** — por desenho, ele só avança
depois do OTP validado ([access.ts:232](../../src/app/router/payment/access.ts)).
Com o envio falhando, o contador congela num múltiplo de `otpEveryNSessions` e
**toda** tentativa seguinte cai no mesmo galho. Loop fechado.

E gerar senha nova **não abre o loop**: `grantPaymentAccess` não zera o
contador. Busca no projeto confirma que `sessionCount` é incrementado em três
pontos e **nunca zerado em nenhum**. A senha nova é válida, mas o servidor
estoura antes de ela ser sequer avaliada.

**Segunda porta do mesmo travamento**: se a pessoa não tem telefone, o
`if (phone)` da [access.ts:238](../../src/app/router/payment/access.ts) não envia
nada, mas o servidor ainda responde `requiresOtp: true`. A tela passa a pedir um
código que nunca foi enviado, e "Reenviar" responde `BAD_REQUEST`. Trava igual,
sem nem gerar 500.

### O achado que determina o desenho desta spec

O enforcement real de acesso é o middleware
[payment-access.ts](../../src/app/middlewares/payment-access.ts), aplicado em
`entries`, `accounts`, `categories`, `contacts`, `contracts` e `dashboard`. Ele
verifica **duas** coisas: `PaymentAccess.isAuthorized` e a permissão efetiva da
role.

**Ele nunca verifica se o PIN foi digitado.** Não existe token, cookie ou flag
de "desbloqueado" no servidor — o portão mora inteiro no `sessionStorage` do
navegador. Consequência verificável: qualquer pessoa já autorizada na whitelist
lê e escreve todo o financeiro sem PIN, chamando a API direto ou com uma linha
no console:

```js
sessionStorage.setItem("nasa_payment_unlocked", "1")
```

Portanto o PIN é **fricção sem proteção**. Removê-lo não reduz o nível de
segurança real do módulo: o nível permanece o que o middleware já garante.

## 2. Objetivo

Acesso ao módulo financeiro passa a ser determinado **exclusivamente pela
whitelist** (`PaymentAccess.isAuthorized` + role), com o owner da empresa
autoprovisionado no primeiro acesso — eliminando a senha própria do módulo, o
OTP por WhatsApp e os dois caminhos de travamento permanente.

### Não-objetivos

- **Não** implementa reconfirmação de identidade ("sudo mode" com a senha da
  plataforma). Foi avaliada e adiada deliberadamente — ver `D-5`.
- **Não** implementa biometria / WebAuthn. O código existente é preservado para
  a fase futura, sem ser ativado.
- **Não** altera o modelo de roles e permissões: `ROLE_DEFAULTS` e
  `resolveEffectivePermissions` ficam intactos.
- **Não** altera governança de valores (aprovações, thresholds, dunning).
- **Não** dropa colunas do banco. A migration apenas afrouxa — ver `D-4`.
- **Não** exige recadastro: quem já está autorizado continua entrando.
- **Não** apaga os arquivos das procedures desativadas — ver `D-3`.

## 3. Requisitos

### Funcionais

| ID | Requisito |
| --- | --- |
| RF-1 | Usuário com `PaymentAccess.isAuthorized = true` acessa `/payment` sem nenhum desafio de senha, código ou biometria. |
| RF-2 | Usuário que é owner da empresa (`Member.role === "owner"`) e **não** possui registro `PaymentAccess` é autoprovisionado no primeiro acesso: registro criado com `isAuthorized = true` e `role = "OWNER"`. |
| RF-3 | Usuário que é owner da empresa e possui registro com `isAuthorized = false` tem o acesso reativado, **preservando a role já gravada** (sem promover a OWNER). |
| RF-4 | Usuário que não é owner da empresa e não está autorizado vê tela de acesso restrito, **sem campo de senha**, orientando a procurar o responsável. |
| RF-5 | OWNER do módulo continua concedendo, alterando role/permissões e revogando acesso pelo painel existente. |
| RF-6 | `grantPaymentAccess` deixa de gerar PIN, deixa de gravar `passwordHash` e deixa de retornar `tempPassword`. |
| RF-7 | A notificação de acesso concedido (WhatsApp/e-mail) passa a ser aviso **sem segredo algum** no corpo, e é best-effort: falha no envio não invalida a concessão nem derruba a chamada. |
| RF-8 | `logActivity` é registrado em: autoprovisão de owner, concessão, revogação, alteração de role e alteração de permissões — identificando **quem executou** e **sobre quem**. |
| RF-9 | As procedures de senha/OTP (`verifyPaymentPin`, `verifyPaymentOtp`, `requestPaymentOtp`, `setupOwnerPaymentAccess`) são **desregistradas do router**, deixando de ser alcançáveis pela API. |
| RF-10 | O `PaymentGate` deixa de usar `sessionStorage`, contador de tentativas e etapas de senha/OTP; passa a renderizar apenas conforme `authorized`. |
| RF-11 | O backdoor `PAYMENT_MASTER_HASH` é removido do caminho de acesso. |
| RF-14 | Usuário que é owner da empresa mas está sem acesso (caso das contas barradas por `RF-13`) vê, no lugar da tela de restrição, um botão que libera o próprio acesso: vale para **uma** organização por clique e é registrado no log como ação deliberada (`payment.access.self_claimed`), distinta da autoprovisão automática. |
| RF-13 | Conta de staff da plataforma (`User.isSystemAdmin = true`) **nunca** é autoprovisionada, mesmo sendo `Member.role === "owner"`. Continua podendo receber acesso por concessão explícita no painel. Ver `CB-16` e a evidência em `D-2`. |
| RF-12 | Revogar acesso passa a exigir confirmação. Quando o alvo é owner da empresa, a confirmação **avisa** que a revogação não vai durar e diz o que fazer para tirar o acesso de vez (remover o papel de owner em Permissões). O botão continua disponível — decisão do dono do produto: avisar, não esconder. Ver `CB-4`. |

### Não-funcionais

| ID | Requisito |
| --- | --- |
| RNF-1 | O caminho de entrada no módulo não faz **nenhuma** chamada de rede externa (uazapi, Resend). Indisponibilidade de terceiro não pode bloquear acesso. |
| RNF-2 | O acesso não depende de estado no navegador: sobrevive a fechar aba, recarregar e múltiplas abas. |
| RNF-3 | Zero recadastro e zero janela de indisponibilidade para os já autorizados no deploy. |
| RNF-4 | A migration é reversível sem perda de dados. |

## 4. Critérios de aceite

- [ ] **CA-1** — Dado usuário com `isAuthorized = true`, quando abre `/payment`, então vê o painel financeiro sem qualquer desafio de credencial.
- [ ] **CA-2** — Dado owner da empresa sem registro `PaymentAccess`, quando abre `/payment`, então entra e passa a existir registro com `isAuthorized = true` e `role = "OWNER"`.
- [ ] **CA-3** — Dado owner da empresa com registro `isAuthorized = false` e `role = "VIEWER"`, quando abre `/payment`, então entra e a role permanece `VIEWER` (não é promovido).
- [ ] **CA-4** — Dado usuário que não é owner e não está autorizado, quando abre `/payment`, então vê "acesso restrito" sem campo de senha, e chamadas à API do módulo continuam devolvendo `FORBIDDEN`.
- [ ] **CA-5** — Dado um OWNER concedendo acesso, quando a concessão conclui, então a resposta **não** contém `tempPassword` e a mensagem enviada **não** contém PIN nem qualquer segredo.
- [ ] **CA-6** — Dada qualquer concessão, revogação ou alteração de role/permissões, quando conclui, então existe registro em `SystemActivityLog` com `appSlug = "payment"` identificando executor e alvo.
- [ ] **CA-7** — Dada autoprovisão de owner, quando ocorre, então existe registro em `SystemActivityLog` marcando-a.
- [ ] **CA-8** — Dado `UAZAPI_TOKEN` ausente ou uazapi devolvendo erro, quando um usuário autorizado abre `/payment`, então o acesso ocorre normalmente (nenhuma chamada externa no caminho).
- [ ] **CA-9** — Dado usuário autorizado que entrou no módulo, quando fecha a aba e reabre `/payment`, então entra direto, sem novo desafio.
- [ ] **CA-10** — Dado usuário autorizado cujo registro tem `passwordHash` antigo, `sessionCount` travado em múltiplo de 10 e `pendingOtpHash` preenchido, quando abre `/payment`, então entra normalmente — nenhum desses campos afeta o acesso.
- [ ] **CA-11** — Dadas as procedures `verifyPaymentPin`, `verifyPaymentOtp`, `requestPaymentOtp` e `setupOwnerPaymentAccess`, quando chamadas pela API, então não são alcançáveis pelo router.
- [ ] **CA-12** — Dado usuário autorizado que é revogado por um OWNER, quando faz a chamada seguinte à API do módulo, então recebe `FORBIDDEN`.
- [ ] **CA-13** — Dado o painel de acesso, quando carregado, então não existe mais o diálogo que exibia a senha temporária nem as ações "Nova senha".
- [ ] **CA-14** — Dado um OWNER revogando o acesso de alguém que é owner da empresa, quando abre a confirmação, então vê o aviso de que a revogação não persiste e como tirar o acesso de vez; para quem não é owner da empresa, a confirmação aparece sem esse aviso.
- [ ] **CA-17** — Dado owner da empresa barrado por `RF-13`, quando abre `/payment`, então vê o botão "Sou owner desta empresa — liberar meu acesso" (não a tela de restrição); ao clicar, entra imediatamente e é gravado um log `payment.access.self_claimed` referente **apenas** àquela organização.
- [ ] **CA-18** — Dado usuário que **não** é owner da empresa, quando chama a procedure de auto-liberação diretamente, então recebe `FORBIDDEN` e nenhum registro é criado.
- [ ] **CA-16** — Dada uma conta com `isSystemAdmin = true` que é `Member.role = "owner"` de uma org e não tem `PaymentAccess`, quando abre `/payment`, então vê "acesso restrito" e **nenhum** registro é criado; a mesma conta entra normalmente se um OWNER conceder acesso pelo painel.
- [ ] **CA-15** — Dado que a consulta de acesso do próprio usuário falha (erro de rede/servidor), quando abre `/payment`, então vê "não foi possível verificar seu acesso" com botão de tentar novamente — e **não** a tela de acesso restrito.

## 5. Casos de borda

| # | Caso | Comportamento esperado |
| --- | --- | --- |
| CB-1 | Usuário já autorizado com `passwordHash` preenchido | Entra direto; o hash é ignorado e permanece no banco sem uso |
| CB-2 | Usuário com `sessionCount` congelado em múltiplo de `otpEveryNSessions` (o bug atual) | Entra direto; campo torna-se irrelevante |
| CB-3 | Usuário com `pendingOtpHash` / `pendingOtpExpiresAt` pendentes | Ignorados; nenhum fluxo de OTP é oferecido |
| CB-4 | OWNER revoga o acesso de alguém que é **owner da empresa** | A revogação é gravada, mas o acesso é restabelecido no próximo acesso dessa pessoa (`RF-3`). O diálogo de confirmação avisa isso antes, e o toast repete depois (`RF-12`). O log registra que o alvo era owner da empresa. Consequência aceita de `D-2` |
| CB-5 | Org com múltiplos owners | Cada um é autoprovisionado individualmente no seu primeiro acesso |
| CB-6 | Org sem nenhum `PaymentAccess` (bootstrap) | O primeiro owner que acessa vira OWNER do módulo; não há estado de "org trancada" |
| CB-7 | Owner da empresa que já tem registro `isAuthorized = true` com role `EDITOR` | Nada é alterado; a role gravada é respeitada (não promove nem rebaixa) |
| CB-8 | Duas abas do mesmo owner abrem `/payment` simultaneamente | `upsert` pela unique `(userId, organizationId)` é idempotente; não duplica registro. O log de autoprovisão só é emitido quando o registro é efetivamente criado ou reativado |
| CB-9 | Pessoa deixa de ser owner da empresa depois de autoprovisionada | O `PaymentAccess` **permanece** (acesso já concedido). Remoção exige revogação explícita pelo painel |
| CB-10 | Concessão para e-mail/ID inexistente | Mantém `NOT_FOUND` com a mensagem atual |
| CB-11 | uazapi e Resend indisponíveis no envio do **aviso** de concessão | Concessão é gravada e a chamada devolve sucesso, com `deliveryWarning`; aviso é best-effort |
| CB-12 | Usuário sem telefone cadastrado | Irrelevante — não há mais OTP nem entrega de segredo no caminho de acesso |
| CB-13 | Navegador com `nasa_payment_unlocked` órfão no `sessionStorage` | Inofensivo; o gate novo não lê essa chave |
| CB-14 | Usuário autorizado cuja role não permite `view` em nenhum recurso | Entra no módulo, e cada procedure segue devolvendo `FORBIDDEN` por recurso — comportamento atual do middleware, inalterado |
| CB-15 | Owner da empresa acessando org onde não é membro | `requireOrgMiddleware` já barra antes; autoprovisão nunca é alcançada |
| CB-16 | **Uma conta é `Member.role = "owner"` de muitas organizações** (conta de agência/setup, não dona do negócio) | Se `isSystemAdmin`, não é autoprovisionada em nenhuma delas (`RF-13`); precisa de concessão explícita por org. Se **não** for system admin, é autoprovisionada normalmente — o limiar por quantidade de orgs foi descartado por ser arbitrário |
| CB-17 | Conta de staff que **já tem** acesso autorizado antes desta spec | Mantida como está. `RF-13` só impede a autoprovisão silenciosa; nunca revoga acesso existente |
| CB-18 | Staff usa a auto-liberação (`RF-14`) em várias orgs | Cada clique vale para uma organização e gera seu próprio log. Não existe caminho que libere em lote — é o que separa `RF-14` de simplesmente desfazer `RF-13` |
| CB-19 | Usuário **não** owner chama a procedure de auto-liberação direto na API | `FORBIDDEN`; a checagem de `Member.role = "owner"` está no servidor, não na UI |

## 6. Decisões de design

### D-1 — Acesso passa a ser determinado só pela whitelist

- **Escolha**: eliminar a senha própria do módulo. Acesso = `isAuthorized` + role, exatamente o que o servidor já enforça.
- **Alternativas descartadas**:
  - *Manter o PIN e apenas corrigir os três defeitos* — descartada porque o PIN não é lido pelo servidor em nenhum ponto do enforcement ([payment-access.ts](../../src/app/middlewares/payment-access.ts)) e é contornável com uma linha no console. Consertá-lo preservaria a fricção diária sem entregar proteção.
  - *Sudo mode agora* — ver `D-5`.
- **Consequência**: o nível de proteção real permanece o mesmo de hoje; somem os dois caminhos de travamento permanente e a dependência de terceiro no login.

### D-2 — Owner da empresa é autoprovisionado

- **Escolha**: quem é `Member.role === "owner"` nunca fica trancado fora do próprio financeiro; o registro é criado no primeiro acesso.
- **Alternativas descartadas**: *convite explícito para todo mundo, inclusive owner* — descartada porque é exatamente a situação que gerou a dor atual (owner sem acesso dependendo de alguém para destravá-lo).
- **Consequência**: **todo** owner da empresa passa a ver o financeiro. Decisão tomada conscientemente pelo dono do produto em 2026-08-26. Revogar um owner pelo painel não tem efeito duradouro — daí `RF-12` e `CB-4`. Se no futuro algum owner precisar ficar de fora, esta decisão precisa de nova spec.
- **Ressalva descoberta nos dados reais (2026-08-26)**, depois da aprovação e antes do deploy. Consulta somente leitura no banco de dev:

  | Medida | Valor |
  | --- | --- |
  | Vínculos `Member.role = "owner"` | 140 |
  | Pessoas distintas por trás deles | 57 |
  | Já com acesso financeiro autorizado | 3 |
  | Ganhariam acesso na versão original de `D-2` | 137 |
  | Vínculos concentrados em 5 contas `isSystemAdmin` | 68 (49%) |
  | Maior acumulador | 1 conta, **27 organizações** |

  O sinal "é owner da empresa" é mais ruidoso do que a decisão assumia: metade dos vínculos são contas de staff que fizeram o setup de orgs de clientes. Autoprovisionar todas daria a uma única conta acesso OWNER ao financeiro de 27 clientes. Daí `RF-13`: staff da plataforma sai da autoprovisão. Os 47 donos de exatamente uma org — o caso que motivou a spec — seguem entrando direto.

  *Esta ressalva existe porque a spec original enumerou `CB-5` (org com múltiplos owners) e não o inverso: uma pessoa dona de muitas orgs. A lacuna só apareceu ao cruzar a decisão com os dados de produção.*

### D-3 — Desativar por desregistro, não apagar arquivos

- **Escolha**: as procedures de senha/OTP saem do `index.ts` do router; os handlers permanecem no arquivo.
- **Alternativas descartadas**: *deletar o código* — descartada por reversibilidade e porque a fase de biometria vai reaproveitar parte da infraestrutura de credenciais.
- **Consequência**: reverter a decisão é reeditar o registro do router. O código morto fica sinalizado como desativado por esta spec.

### D-4 — Migration só afrouxa, não dropa

- **Escolha**: `passwordHash` passa a ser opcional. `sessionCount`, `lastOtpAt`, `pendingOtpHash`, `pendingOtpExpiresAt` e `webauthnCredentials` permanecem no schema.
- **Alternativas descartadas**: *dropar as colunas* — descartada porque dropar não é reversível sem perda e não há ganho operacional.
- **Consequência**: rollback é possível sem restore de backup. Limpeza dessas colunas fica para uma spec posterior, depois da fase de biometria.

### D-5 — Risco de sessão esquecida aberta: aceito, com mitigação em fase futura

- **Escolha**: não introduzir reconfirmação de identidade nesta fase.
- **Alternativa descartada por ora**: *sudo mode* — reconfirmar com a senha da própria plataforma (better-auth, `emailAndPassword` já habilitado), enforçado no servidor por uma sessão financeira. Tecnicamente superior ao estado atual, mas adiado por decisão de escopo do dono do produto em 2026-08-26 ("por enquanto vamos ignorar e depois implementar futuramente").
- **Consequência**: uma máquina logada e deixada aberta expõe o financeiro a quem senta na cadeira. Hoje o PIN barra esse caso específico — é a **única** proteção efetivamente perdida por esta spec. Mitigação prevista para a fase seguinte: biometria/passkey como confirmação e step-up nas ações sensíveis (aprovar acima de X, alterar conta bancária, exportar, revogar acesso).

### D-7 — Staff entra por clique, não por automatismo

- **Escolha**: manter `RF-13` (staff fora da autoprovisão) e dar a essas contas um botão de auto-liberação, uma org por vez, registrado como ação deliberada (`RF-14`).
- **Origem**: teste manual em 2026-08-26, logo depois de `RF-13` entrar. O dono do produto abriu `/payment`, foi barrado — a conta dele é `isSystemAdmin` e owner de 12 organizações — e a saída encontrada foi **se inserir na whitelist manualmente**. A tela dizia "procure o responsável pelo financeiro", sendo que ele *é* o responsável: beco sem saída, a mesma classe de problema que originou esta spec.
- **Alternativas descartadas**:
  - *Autoprovisionar staff também* — desfaria `RF-13` e devolveria o problema de uma conta ganhar 12 financeiros de clientes de uma vez.
  - *Só corrigir o texto da tela* — resolveria a confusão, não o trabalho manual a cada org nova.
- **Consequência**: staff continua sem acesso automático, mas nunca mais fica sem saída. O log distingue os dois caminhos — `payment.access.self_provisioned` (automático) e `payment.access.self_claimed` (deliberado) —, então uma auditoria consegue responder "quem se liberou sozinho, em qual empresa e quando".

### D-6 — Log de atividade como controle compensatório

- **Escolha**: instrumentar `logActivity` em toda mudança de acesso e na autoprovisão.
- **Alternativas descartadas**: *seguir sem log* — descartada porque hoje `logActivity` não é chamado nenhuma vez no `access.ts`: não há como responder "quem liberou o financeiro para quem, e quando". Sem senha, o histórico passa a ser o controle disponível.
- **Consequência**: mudanças de acesso ficam auditáveis em `SystemActivityLog`, no mesmo padrão já usado em [entries.ts:315](../../src/app/router/payment/entries.ts).

## 7. Impacto

- [x] Schema / migration (`prisma/schema.prisma`)
- [x] Procedures oRPC (contrato de entrada/saída)
- [ ] Realtime (Pusher / event-bus)
- [ ] Automações (Inngest)
- [x] Env vars novas _(remoção, não adição)_
- [x] Breaking change para clientes existentes
- [x] Documentação obrigatória

**Schema**: `PaymentAccess.passwordHash` passa a `String?`. Migration versionada
via `pnpm db:migrate`, seguida do ritual do CLAUDE.md item 11 (`db:generate`,
bump de `SCHEMA_VERSION`, touch nos catch-all, validação por `curl`).

**Procedures**: quatro procedures desregistradas (`RF-9`). `grantPaymentAccess`
muda o contrato de saída — `tempPassword` deixa de ser retornado.

**Env vars**: `PAYMENT_MASTER_HASH` deixa de ser lido. `UAZAPI_TOKEN` continua
usado no resto do produto, mas sai do caminho de acesso ao financeiro.

**Breaking change**: o front do módulo é o único consumidor dessas procedures e
é atualizado no mesmo PR. Nenhum cliente externo.

**Documentação**: atualizar
[`docs/arquitetura-evolucao-overview.md`](../../docs/arquitetura-evolucao-overview.md)
— o item 5 da tabela de auditoria rastreia `PAYMENT_MASTER_HASH` como "não
verificado" e passa a resolvido, marcando o PR sem apagar o item (CLAUDE.md
item 19).

## 8. Plano de testes

> **Limitação registrada**: o projeto **não tem runner de teste instalado** —
> `package.json` não declara script `test` nem vitest/jest/playwright, conforme
> a deriva conhecida no CLAUDE.md item 20. Portanto os critérios são verificados
> **manualmente** nesta entrega, e cada um cita seu `CA-n`. Quando o runner da
> Fase 0 entrar, estes critérios são os primeiros candidatos a automação.

| Critério | Tipo | Como verificar |
| --- | --- | --- |
| CA-1 | manual | Usuário autorizado abre `/payment` — painel carrega sem desafio |
| CA-2 | manual | Owner sem registro abre `/payment`; conferir registro criado no Prisma Studio (`isAuthorized`, `role = OWNER`) |
| CA-3 | manual | Setar `isAuthorized = false` e `role = VIEWER` num owner via Studio, acessar, conferir role preservada |
| CA-4 | manual | Usuário comum não autorizado abre `/payment` — tela restrita sem input; chamada à procedure devolve `FORBIDDEN` |
| CA-5 | manual | Conceder acesso pelo painel; inspecionar resposta da procedure e o corpo da mensagem enviada |
| CA-6, CA-7 | manual | Executar concessão, revogação, troca de role e autoprovisão; conferir 4 linhas em `SystemActivityLog` com `appSlug = "payment"` |
| CA-8 | manual | Rodar sem `UAZAPI_TOKEN` no ambiente e acessar o módulo |
| CA-9 | manual | Entrar no módulo, fechar a aba, reabrir `/payment` |
| CA-10 | manual | Preparar registro com `passwordHash` antigo + `sessionCount = 10` + `pendingOtpHash` via Studio e acessar |
| CA-11 | manual | Chamar as 4 procedures desregistradas — não alcançáveis |
| CA-12 | manual | Revogar um usuário e refazer uma chamada com a sessão dele |
| CA-13 | manual | Abrir o painel de acesso e confirmar ausência do diálogo de senha e das ações "Nova senha" |
| CA-14 | manual | Revogar um owner da empresa e um usuário comum; conferir presença/ausência do aviso no diálogo |
| CA-15 | manual | Derrubar o servidor (ou bloquear a rota no devtools) e abrir `/payment` |
| CA-16 | manual | Entrar com conta `isSystemAdmin` que é owner de uma org sem `PaymentAccess`; conferir que **não** há registro novo criado sozinho |
| CA-17 | manual | Com a mesma conta, conferir o botão de auto-liberação, clicar, entrar e achar o log `payment.access.self_claimed` só daquela org |
| CA-18 | manual | Chamar `payment/access/claimOwner` com usuário não-owner — esperar `FORBIDDEN` |

## 9. Riscos e rollback

| Risco | Probabilidade | Mitigação |
| --- | --- | --- |
| Owner que não deveria ver o financeiro passa a ver | Média | Decisão explícita de `D-2`. Mitigado em parte por `RF-13`, que tira staff da plataforma da autoprovisão (68 dos 140 vínculos). Restam contas não-admin donas de muitas orgs — a maior tem 12; vale o time conferir quem é antes do deploy |
| Sessão logada esquecida aberta expõe o financeiro | Baixa | Aceito em `D-5`; mitigação na fase de biometria |
| Alguém perde acesso no deploy | Muito baixa | Nenhum dado é apagado e `isAuthorized` não é tocado nos registros existentes (`RNF-3`) |
| Autoprovisão dispara em loop / duplica registro | Muito baixa | `upsert` pela unique `(userId, organizationId)` (`CB-8`) |
| Front referenciando `tempPassword` quebra | Baixa | Diálogo removido no mesmo PR (`CA-13`) |

**Rollback**: reversível em dois passos, sem restore de backup.

1. **Código** — revert do PR. As procedures desativadas voltam ao router por
   reedição do `index.ts` (`D-3`), já que os handlers nunca foram apagados.
2. **Schema** — a migration apenas relaxa `passwordHash` para opcional. Voltar a
   `NOT NULL` só é possível se nenhum registro novo tiver ficado com o campo
   nulo; registros criados após o deploy (concessões e autoprovisões) terão
   `passwordHash` nulo e precisariam de um PIN gerado antes do revert. Por isso
   o revert de código é a via primária e o de schema é dispensável — a coluna
   opcional é inerte para o código antigo.

**Sinal de que deu certo**: zero ocorrências de `[payment/access/verify]` no log
do servidor e nenhum pedido de "gerar senha nova" no suporte.

## 10. Changelog da spec

| Data | Autor | Mudança |
| --- | --- | --- |
| 2026-08-26 | João Gabriel | Criada. Decisões `D-2` (todo owner acessa), `D-6` (log de atividade) e `D-5` (risco de sessão aberta adiado) tomadas em conversa na mesma data |
| 2026-08-26 | João Gabriel | Aprovada e implementada. `RF-12` fechado na variante **avisar, não esconder** o botão de revogar. Durante a implementação surgiram dois critérios novos: `CA-14` (o aviso em si) e `CA-15` — falha ao consultar o próprio acesso não pode renderizar "acesso restrito", porque mandaria a pessoa procurar o financeiro por um problema de rede. `getMyPaymentAccess` também deixou de expor `canSelfSetup`, `hasPhone`, `hasWebauthn` e `sessionTimeoutMinutes`, que só o gate antigo consumia; `orgHasAnyAccess` foi mantido porque a aba de Permissões depende dele |
| 2026-08-26 | João Gabriel | Migration aplicada (`20260826204056_payment_access_password_hash_optional`). Consulta somente leitura no banco revelou **140 vínculos de owner em 57 pessoas, 68 deles concentrados em 5 contas de staff, a maior com 27 orgs** — lacuna da spec, que enumerou `CB-5` (muitos owners numa org) mas não o inverso. Daí `RF-13`, `CB-16` e `CB-17`: staff da plataforma (`isSystemAdmin`) sai da autoprovisão, sem perder acesso já concedido. Limiar por quantidade de orgs foi considerado e descartado por ser arbitrário. Evidência registrada em `D-2` |
| 2026-08-26 | João Gabriel | Teste manual em `localhost:3000` validou o acesso sem senha, **mas revelou um beco sem saída**: a conta do dono do produto (`isSystemAdmin`, owner de 12 orgs) foi barrada por `RF-13` e a única saída foi entrar na whitelist manualmente, com a tela dizendo "procure o responsável" para quem é o responsável. Daí `RF-14`, `CA-17`, `CA-18`, `CB-18`, `CB-19` e `D-7`: botão de auto-liberação, uma org por clique, logado como `payment.access.self_claimed`. `getMyPaymentAccess` ganhou `canClaimAsOrgOwner` |
