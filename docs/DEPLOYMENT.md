# NASA — Deployment Guide

Passos pra colocar em produção tudo que está nas PRs mergeadas
(Astro Command + Alerts + Voz Piper).

---

## 0. Deploy por imagem Docker (Coolify + GHCR)

O build **não roda na VPS**. Fluxo:

1. Push na `main` → `.github/workflows/deploy-image.yml` builda o `Dockerfile` no runner do GitHub
   e publica `ghcr.io/act962/nasa.ex:latest` (e `:sha-<commit>`).
2. O último passo chama o webhook de deploy do Coolify, que só faz `pull` e troca o container.
3. No boot, `docker/entrypoint.sh` roda `prisma migrate deploy` e sobe o servidor. Migration
   falhou → o container não fica healthy e o Coolify mantém a versão anterior.

**CI de PR:** `.github/workflows/ci.yml` roda o mesmo build (com checagem de tipos) em todo PR para a
`main`, sem publicar. Deixe-o como check obrigatório na proteção da branch. O `deploy-image.yml` também
roda por `workflow_dispatch` em qualquer branch, mas só a `main` recebe a tag `latest`.

### Configuração única

**GitHub → Settings → Secrets and variables → Actions:**

| Secret | Valor |
| --- | --- |
| `NEXT_PUBLIC_ENV` | Todas as `NEXT_PUBLIC_*` de produção, uma por linha (`CHAVE=valor`). São embutidas no bundle do browser em tempo de build — mudar uma exige novo build. |
| `COOLIFY_WEBHOOK` | URL do webhook de deploy do recurso no Coolify (opcional; sem ele o passo é pulado). |
| `COOLIFY_TOKEN` | Token de API do Coolify (Keys & Tokens). |

**Coolify:** recurso do tipo *Docker Image* → `ghcr.io/act962/nasa.ex`, tag `latest`, com credencial de
registry (usuário do GitHub + PAT com `read:packages`). Porta `3000`, healthcheck já está na imagem
(`/api/health`). As variáveis **de runtime** (`DATABASE_URL`, segredos, etc.) continuam no painel do
Coolify. Desligue o build por Nixpacks (`.nixpacks.toml` fica só como legado).

### Notas

- O repositório é público: se o pacote no GHCR também for público (Package settings → Change visibility),
  o Coolify puxa sem credencial. A imagem não carrega segredos — só as `NEXT_PUBLIC_*`, que já vão para o browser.
- "Mantém a versão anterior se a migration falhar" depende do healthcheck estar ativo no recurso do Coolify.
- Push só de `docs/`, `specs/` ou `.md` não dispara deploy.

- A checagem de tipos roda dentro do `next build` no GitHub, não mais na VPS.
- O build não precisa de banco: `generateStaticParams` do calendário degrada para `[]`.
- Rollback: aponte a tag no Coolify para um `sha-<commit>` anterior.

---

### 0.1 Checagem de tipos — custo e como manter baixo

A checagem de tipos é a etapa mais pesada do build. Medida em 2026-09-30 (antes da correção abaixo):
12,8 GB de memória, 236 s de checagem, 52 milhões de instanciações de tipo — e um único arquivo
(`create-lead.ts`) respondendo por 63 s.

**Causa:** o cliente Prisma global e o `tx` de `$transaction` tinham tipos diferentes. `new PrismaClient({ log })`
inferia `PrismaClient<"error", PrismaClientOptions['omit']>`, enquanto o `tx` é `PrismaClient<never, undefined>`.
Com o parâmetro de `omit` invariante, cada vez que um encontrava o outro (união `PrismaClient | Prisma.TransactionClient`,
`Omit<typeof prisma, ...>` feito à mão, passar o global onde se espera o `tx`) o TypeScript comparava os ~300 models
estruturalmente — e ainda mantinha duas famílias de tipos para cada query.

**Regra:**
- `src/lib/prisma.ts` fixa os genéricos do cliente global (`new PrismaClient<Prisma.PrismaClientOptions, never, undefined>`).
  Não remova.
- Parâmetro que aceita "cliente global ou transação" é `Prisma.TransactionClient` (ou `Pick<Prisma.TransactionClient, ...>`).
  Nunca união com `PrismaClient`, nunca `Omit`/`Pick` de `typeof prisma`/`PrismaClient`. O ESLint (`no-restricted-syntax`)
  barra os dois padrões.

**Medir:** Actions → *Typecheck diagnostics* → Run workflow. O resumo do run traz memória, tempo, instanciações e os
arquivos/expressões mais caros (`scripts/ci/typecheck-hotspots.cjs`). O deploy da `main` pula a checagem
(`SKIP_TYPECHECK=1`) porque o CI do PR já é o portão.

---

## 1. Variáveis de ambiente

Copie `.env.example` → `.env.local` (dev) ou seta no host de produção
(Vercel / Fly / Railway / VPS). Os vars críticos pra o Astro + alerts:

```env
# Voz Astro (Piper TTS)
NEXT_PUBLIC_PIPER_ENABLED=true
PIPER_HTTP_URL=https://piper.SEU-DOMINIO.com    # ou IP interno se same-VPC

# AI
OPENAI_API_KEY=sk-...

# Realtime (alertas críticos + Astro orb)
PUSHER_APP_ID=...
PUSHER_SECRET=...
NEXT_PUBLIC_PUSHER_APP_KEY=...
NEXT_PUBLIC_PUSHER_CLUSTER=us2
```

Sem essas, o Astro cai em modos degradados (TTS = Web Speech,
notificações = polling 30s sem real-time).

---

## 2. Database migrations

3 migrations manuais ficaram pendentes desde os PRs deste ciclo. Rode
NA SEGUINTE ORDEM no DB de produção:

```bash
# 1. Foundation do sistema de alertas (AlertRule, AlertDispatch,
#    AdminNotification.severity, etc)
psql "$DATABASE_URL" -f prisma/migrations/MANUAL_alerts_foundation.sql

# 2. completedAt no FormResponses (pro cron detect-form-abandoned)
psql "$DATABASE_URL" -f prisma/migrations/MANUAL_form_completed_at.sql

# 3. Regenere o Prisma Client no host onde o app roda
pnpm db:generate
```

(O seu padrão é aplicar SQL manual conforme a memória do projeto:
"Nunca rodar migrate/db push/db:generate". Mantemos.)

---

## 3. Seed de regras default de alerta

5 regras globais que dão sistema funcional out-of-the-box (lembretes
de agenda, WhatsApp caído, leads parados, propostas mudando status):

```bash
# Mesmo .env do app prod precisa estar no escopo (pra DATABASE_URL apontar pra prod)
pnpm exec tsx prisma/seed-alert-rules.ts
```

Idempotente — pode rodar várias vezes sem duplicar.

---

## 4. Container Piper TTS

A voz oficial do Astro (**Faber pt-BR VITS**) precisa de um container
rodando em algum lugar acessível pelo Next.js prod. **Não existe versão
"serverless" disso** — TTS precisa estado (modelo ONNX em memória).

> ⚠️ **Verificado em 2026-09-24**: `docker-compose.prod.yml` **não existe** no
> repositório, não há nenhum workflow em `.github/workflows/` e, portanto, a
> imagem `ghcr.io/weydsonlima/nasaex-wey/piper-tts:latest` **nunca foi
> publicada**. As instruções abaixo foram corrigidas para o que de fato
> funciona: buildar a partir do `docker/piper/` que está versionado.

### Opção A — Mesmo host do app (VPS / Coolify / Hetzner / Digital Ocean)

```bash
# No servidor de produção
git pull origin main
docker compose up piper -d --build

# Verifica
curl http://localhost:10200/health
# {"status":"ok","voices_dir":"/voices"}
```

O serviço `piper` do `docker-compose.yml` builda de `docker/piper/Dockerfile`,
que está completo no repositório (Dockerfile, `entrypoint.sh`, `server.py`). O
primeiro start baixa a voz `pt_BR-faber-medium` (~63 MB) e a guarda no volume
`piper_voices`, que sobrevive a redeploys. Limite de memória: 512 MB.

No Next.js, seta:
```env
PIPER_HTTP_URL=http://localhost:10200
```

### Opção B — App no Vercel + Piper externo

Vercel não roda containers persistentes. Hospede o Piper separado:

1. **Fly.io** (mais econômico ~$5/mês) — a partir do Dockerfile do repo:
   ```bash
   fly launch --dockerfile docker/piper/Dockerfile \
              --name nasa-piper --internal-port 10200 --vm-memory 512
   ```
2. **Railway / Render**: apontar para `docker/piper/Dockerfile`, expor a 10200.
3. **Próprio VPS**: `docker build -t piper docker/piper && docker run -d -p 10200:10200 piper`.

Depois seta no Vercel:
```env
PIPER_HTTP_URL=https://nasa-piper.fly.dev
```

### Opção C — Skip Piper em prod (degradado)

Não setar `NEXT_PUBLIC_PIPER_ENABLED=true` na prod = Astro fala com Web
Speech do browser. Funciona, mas qualidade inferior. Aceitável se TTS
não é prioridade pro seu launch.

---

## 5. GitHub Actions — build automático (NÃO EXISTE)

> ⚠️ **Verificado em 2026-09-24**: não há diretório `.github/workflows/` no
> repositório. O workflow `piper-build-push.yml` descrito aqui nunca foi
> criado, e nenhuma imagem é publicada automaticamente.

Enquanto não existir, o build do Piper é feito no próprio servidor, a partir de
`docker/piper/Dockerfile` (ver §4, Opção A). Criar o workflow é trabalho em
aberto — só vale a pena quando houver mais de um host consumindo a imagem.

**Pré-requisito (uma vez)**: na primeira execução, o package no GHCR
precisa virar público OU prod precisa autenticar com PAT. Pra deixar
público:

1. Vai pra https://github.com/users/Weydsonlima/packages/container/nasaex-wey%2Fpiper-tts/settings
2. Section "Danger Zone" → Change visibility → Public
3. (Próximas builds não precisam de auth pra pull)

---

## 6. Inngest crons

Em produção, o endpoint `/api/inngest` precisa estar registrado no
Inngest Cloud (não roda local). Painel: <https://app.inngest.com/>.

8 crons registrados nesta sessão (mais 1 que existia):
```
detect-stale-leads         */30 min
detect-broken-integrations  hourly
detect-agenda-starting      */5 min
detect-form-abandoned       */15 min
detect-low-metrics          9h, 15h
detect-overdue              hourly (já existia)
check-reminders             event-driven (já existia)
```

Inngest auto-discovery via serve() já cobre — você só precisa
confirmar que seu app tem `INNGEST_EVENT_KEY` + `INNGEST_SIGNING_KEY`
nos vars de prod.

---

## 7. Checklist final pré-launch

- [ ] `.env` prod tem TODOS os vars listados em `.env.example`
- [ ] Migrations 1-2 aplicadas no DB prod
- [ ] `pnpm db:generate` rodou no host do app
- [ ] `seed-alert-rules.ts` rodou apontando pro DB prod
- [ ] Container Piper rodando + reachable via `PIPER_HTTP_URL`
- [ ] `curl https://app.dominio/api/astro/tts` retorna `{status:"ok"}`
- [ ] Pusher app configurado + envs no host
- [ ] Inngest dashboard mostra os 8 crons ativos
- [ ] Login → `/home` → mandar msg por voz → ouvir Faber respondendo
- [ ] Disparar notif severity=critical no painel admin → popup full-screen
- [ ] Bell mostra notifs com badges de severity
- [ ] Cmd+K abre composer em qualquer página

---

## Troubleshooting

| Sintoma | Diagnóstico |
|---|---|
| Astro fala com voz robótica | Piper offline OU `NEXT_PUBLIC_PIPER_ENABLED` não-true |
| `/api/astro/tts` 503 | Container Piper inacessível — checa `PIPER_HTTP_URL` |
| Alertas críticos não chegam real-time | Pusher vars faltando OU canal `private-org-*` sem auth |
| Cron `detect-stale-leads` não dispara | Sem regra `lead.stale` ativa no DB OU Inngest não registrado |
| TS errors no build | `pnpm db:generate` esqueceu de rodar após migration |
