# 🚨🚨🚨 MIGRATION PENDENTE — APLICAR ANTES DE TESTAR 🚨🚨🚨

> **DEV: ler isso antes de rodar a feature de "multi-conta Meta + permissões granulares".**
> O `schema.prisma` já tem o model novo, mas o banco **não** foi alterado.
> Sem aplicar essa migration, qualquer query nas novas procedures vai quebrar em runtime.

---

## O que falta aplicar

**Branch:** `feature/W-configuracoes-add-indicadores-matriz-de-permissoes-20260501`
**Data:** 2026-05-03

Foi adicionado ao `schema.prisma`:
- `enum MetaAccountKind { AD_ACCOUNT, PAGE, IG_ACCOUNT }`
- `model MemberMetaAccountAccess { id, organizationId, userId, kind, accountKey, createdAt, ... }`
- Relations correspondentes em `User.metaAccountAccess` e `Organization.memberMetaAccountAccess`

Tabela física a criar: `member_meta_account_access` com unique `(organization_id, user_id, kind, account_key)` e index `(organization_id, user_id)`.

---

## Por que NÃO foi aplicado automaticamente

Ao rodar `pnpm db:migrate`, o Prisma detectou **drift** entre o histórico de migrations e o estado atual do banco (PlatformIntegration já tem dados reais do OAuth Meta — 20 ad accounts, 32 páginas, 23 IGs). `migrate dev` ofereceu **`migrate reset`** (drop + recreate), o que **apagaria os tokens reais já conectados**. Por isso paramos.

A branch quebra sem essa tabela. Quem aplica é você, devs.

---

## Como aplicar (escolha um caminho)

### ✅ Opção A — Alinhar histórico depois do drift (recomendado)

Se o drift veio de migrations rodadas direto na produção sem registrar no Git:

```bash
# 1. Confirmar o drift
pnpm prisma migrate status

# 2. Marcar migrations existentes do banco como aplicadas (sem rodar nada)
#    Listar cada migration faltando e marcar:
pnpm prisma migrate resolve --applied "<nome_da_migration_faltando>"

# 3. Quando `migrate status` mostrar "Database schema is up to date":
pnpm prisma migrate dev --name add_member_meta_account_access
```

### ⚡ Opção B — Aplicar SQL direto e marcar como migrated

Se preferir não mexer no histórico todo agora:

```bash
# 1. Criar pasta de migration
mkdir -p prisma/migrations/$(date +%Y%m%d%H%M%S)_add_member_meta_account_access

# 2. Salvar o SQL abaixo em migration.sql dentro dessa pasta
cat > prisma/migrations/$(ls prisma/migrations | grep add_member_meta_account_access | tail -1)/migration.sql <<'SQL'
CREATE TYPE "MetaAccountKind" AS ENUM ('AD_ACCOUNT', 'PAGE', 'IG_ACCOUNT');

CREATE TABLE "member_meta_account_access" (
    "id" TEXT NOT NULL,
    "organization_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "kind" "MetaAccountKind" NOT NULL,
    "account_key" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "member_meta_account_access_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "member_meta_account_access_organization_id_user_id_kind_acc_key"
    ON "member_meta_account_access"("organization_id", "user_id", "kind", "account_key");

CREATE INDEX "member_meta_account_access_organization_id_user_id_idx"
    ON "member_meta_account_access"("organization_id", "user_id");

ALTER TABLE "member_meta_account_access"
    ADD CONSTRAINT "member_meta_account_access_organization_id_fkey"
    FOREIGN KEY ("organization_id") REFERENCES "organization"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "member_meta_account_access"
    ADD CONSTRAINT "member_meta_account_access_user_id_fkey"
    FOREIGN KEY ("user_id") REFERENCES "user"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
SQL

# 3. Aplicar o SQL no banco
pnpm prisma db execute --file prisma/migrations/<pasta>/migration.sql --schema prisma/schema.prisma

# 4. Marcar como aplicada
pnpm prisma migrate resolve --applied "<timestamp>_add_member_meta_account_access"

# 5. Regenerar client
pnpm db:generate
```

### 🚀 Opção C — Push direto (só dev local, NUNCA em produção)

```bash
pnpm prisma db push
pnpm db:generate
```

> ⚠️ Sem migration file. Em produção, depois é preciso reconciliar.

---

## Como verificar se deu certo

```bash
# 1. Tabela criada
psql postgresql://docker:docker@localhost/nasa_db -c "\d member_meta_account_access"

# 2. Enum criado
psql postgresql://docker:docker@localhost/nasa_db -c "\dT+ \"MetaAccountKind\""

# 3. Client gerado com o novo model
grep -q "MemberMetaAccountAccess" src/generated/prisma/index.d.ts && echo "OK" || echo "FAIL"
```

Depois disso, o Owner pode entrar em **Configurações > Permissões > Contas Meta** e a aba carrega sem erro 500.

---

## Producao

Quando subir pra prod:
1. Garantir que histórico de migrations está alinhado (`migrate status` limpo).
2. Rodar `pnpm migrate` (que é `prisma migrate deploy`) no pipeline de deploy.
3. Sem `migrate dev` em prod — só `deploy`.

---

## Migration adicional — campos de publicação no `NasaPlannerPost` (2026-05-03)

Para suportar publicação direta nas redes sociais a partir do Planner (escolher
IG account / FB page + capturar erros), foram adicionados ao `NasaPlannerPost`:

```sql
ALTER TABLE "nasa_planner_posts"
  ADD COLUMN "target_ig_account_id" TEXT,
  ADD COLUMN "target_fb_page_id"    TEXT,
  ADD COLUMN "publish_error"        TEXT;
```

Sem isso, o `update-post.ts`/`publish-post.ts` quebram ao tentar gravar a
escolha do destino e qualquer erro retornado pela Graph API.
