# NASA — Production Checklist

Resumo curto do que o dev precisa fazer pra subir as features dos
PRs recentes em produção. Cada item linka pro arquivo onde estão os
detalhes inline.

> Pra contexto completo, ver [DEPLOYMENT.md](DEPLOYMENT.md).

---

## 1. Database — migrations + seed

```bash
DATABASE_URL="postgres://..." ./scripts/apply-prod-migrations.sh
```

Aplica idempotente:
- `prisma/migrations/MANUAL_alerts_foundation.sql`
- `prisma/migrations/MANUAL_form_completed_at.sql`
- `prisma/seed-alert-rules.ts` (5 regras default globais)

**Verifica**: `psql $DATABASE_URL -c "SELECT COUNT(*) FROM alert_rule;"` → deve retornar 5+

---

## 2. Env vars no host de prod

Copia do template: [`.env.example`](.env.example)

**Críticos pra Astro + alerts funcionar:**

| Var | Onde usar | Sem ele |
|---|---|---|
| `OPENAI_API_KEY` | Astro orchestrator | Chat IA não responde |
| `PUSHER_APP_ID` / `SECRET` / `KEY` / `CLUSTER` | Alerts real-time, orb sync | Notif só via polling 30s |
| `NEXT_PUBLIC_PIPER_ENABLED=true` | Cliente decide TTS engine | Cai pro Web Speech |
| `PIPER_HTTP_URL=https://piper.dom` | Server proxy `/api/astro/tts` | Idem |
| `INNGEST_EVENT_KEY` / `INNGEST_SIGNING_KEY` | Crons de alertas | Sem detect-stale-leads, etc |

---

## 3. Piper TTS container

Voz oficial do Astro precisa estar rodando em algum lugar reachable
pelo Next.js. Três caminhos (escolhe um):

- **Mesmo host (VPS)**: `docker compose -f docker-compose.yml -f docker-compose.prod.yml up piper -d`
- **Fly.io**: ver [DEPLOYMENT.md §4](DEPLOYMENT.md#4-container-piper-tts) opção B
- **Skip (degradado)**: deixa `NEXT_PUBLIC_PIPER_ENABLED` desligado, Astro fala via Web Speech do browser

**Pré-requisito**: tornar o package GHCR público uma vez — instruções inline em [.github/workflows/piper-build-push.yml](.github/workflows/piper-build-push.yml)

**Verifica**: `curl https://app.dom/api/astro/tts` → `{"status":"ok"}`

---

## 4. Inngest Cloud — registrar app

Pra os 6 crons de alertas dispararem em prod:

1. Cria app em https://app.inngest.com
2. "Sync Methods" → URL: `https://app.dom/api/inngest`
3. Click "Sync" → Inngest descobre os crons via serve()

Detalhes inline no [src/app/api/inngest/route.ts](src/app/api/inngest/route.ts) (header do arquivo).

**Verifica**: dashboard Inngest mostra os 6 crons novos ativos.

---

## 5. Pusher — auth do canal

Já implementado com validação por canal:
- `private-user-{userId}` → só o próprio user
- `private-org-{orgId}` → só membros da org
- `private-conversation-{id}` → só membros da org dona

Se criar feature nova que precisa de canal privado, **adicione case em**
[src/app/api/pusher/auth/route.ts](src/app/api/pusher/auth/route.ts) `validatePrivateChannel()`.
Senão o cliente vai falhar com 403 silencioso.

---

## 6. Checklist de smoke test pós-deploy

- [ ] Login → `/home` → AstroOrb visível no canto inferior direito
- [ ] Click orb → "Ativar escuta" → browser pede mic, aceita
- [ ] Diz "ASTRO" → orb saúda com voz Faber (Piper)
- [ ] Pede "criar um lead João Silva" → Astro chama tool, lead aparece no DB
- [ ] Admin envia notif severity=critical com "popup urgente" → user vê popup full-screen vermelho
- [ ] Cmd+K abre composer de qualquer página
- [ ] Mover card no kanban → toast aparece pro responsável (se houver regra)
- [ ] Bell mostra notif com badge de severity

---

## Onde está documentado inline no código

| Touchpoint | Arquivo com instruções |
|---|---|
| Inngest crons (6 novos) | [src/app/api/inngest/route.ts](src/app/api/inngest/route.ts) — header |
| Piper TTS proxy | [src/app/api/astro/tts/route.ts](src/app/api/astro/tts/route.ts) — header |
| Piper TTS client switching | [src/features/astro/voice/tts.ts](src/features/astro/voice/tts.ts) — header |
| Pusher auth (segurança canal) | [src/app/api/pusher/auth/route.ts](src/app/api/pusher/auth/route.ts) — header |
| GHCR package visibility | [.github/workflows/piper-build-push.yml](.github/workflows/piper-build-push.yml) — header |
| Compose prod usage | [docker-compose.prod.yml](docker-compose.prod.yml) — header |
| Piper setup completo | [docker/piper/PIPER_SETUP.md](docker/piper/PIPER_SETUP.md) |
| Migrations idempotentes | [prisma/migrations/MANUAL_alerts_foundation.sql](prisma/migrations/MANUAL_alerts_foundation.sql) — header |
| Seed regras default | [prisma/seed-alert-rules.ts](prisma/seed-alert-rules.ts) — docstring |
| Apply tudo em um comando | [scripts/apply-prod-migrations.sh](scripts/apply-prod-migrations.sh) — header |
