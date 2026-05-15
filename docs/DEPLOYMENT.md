# NASA — Deployment Guide

Passos pra colocar em produção tudo que está nas PRs mergeadas
(Astro Command + Alerts + Voz Piper).

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

### Opção A — Mesmo host do app (VPS/Hetzner/Digital Ocean)

```bash
# No servidor de produção
git pull origin main
docker compose -f docker-compose.yml -f docker-compose.prod.yml up piper -d

# Verifica
curl http://localhost:10200/health
# {"status":"ok","voices_dir":"/voices"}
```

`docker-compose.prod.yml` puxa a imagem pré-buildada via GitHub Actions
do `ghcr.io/weydsonlima/nasaex-wey/piper-tts:latest` (multi-arch
amd64+arm64). Volume `piper_voices` mantém o modelo cacheado entre
redeploys.

No Next.js, seta:
```env
PIPER_HTTP_URL=http://localhost:10200
```

### Opção B — App no Vercel + Piper externo

Vercel não roda containers persistentes. Hospede o Piper separado:

1. **Fly.io** (mais econômico ~$5/mês):
   ```bash
   fly launch --image ghcr.io/weydsonlima/nasaex-wey/piper-tts:latest \
              --name nasa-piper --internal-port 10200 --memory 512
   ```
2. **Railway / Render**: import via GHCR, expose port 10200.
3. **Próprio VPS**: docker run -d com a imagem.

Depois seta no Vercel:
```env
PIPER_HTTP_URL=https://nasa-piper.fly.dev
```

### Opção C — Skip Piper em prod (degradado)

Não setar `NEXT_PUBLIC_PIPER_ENABLED=true` na prod = Astro fala com Web
Speech do browser. Funciona, mas qualidade inferior. Aceitável se TTS
não é prioridade pro seu launch.

---

## 5. GitHub Actions — build automático

Toda alteração em `docker/piper/**` na branch `main` aciona o workflow
`piper-build-push.yml` que:

1. Builda multi-arch (amd64 + arm64)
2. Publica em `ghcr.io/weydsonlima/nasaex-wey/piper-tts:latest`
3. Também tagueia com `sha-<short>` pra pin reproduzível

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
