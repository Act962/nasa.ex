# Etapa 4 — Webhook + Inngest

## Objetivo

Criar o endpoint que recebe os callbacks da Focus NFe e a função Inngest que consulta o status real e atualiza a `FiscalInvoice`. O webhook **não** faz lógica pesada — apenas dispara o evento Inngest e retorna 200.

---

## `src/app/api/focus-nfe/webhook/route.ts`

Espelha `src/app/api/stripe/webhook/route.ts`: valida credencial, dispara Inngest, retorna 200 imediatamente.

```typescript
import { NextRequest, NextResponse } from "next/server";
import { inngest } from "@/inngest/client";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.FOCUS_NFE_WEBHOOK_SECRET;
  const authorizationHeader = req.headers.get("authorization");

  // fail-closed: rejeita se secret não configurado ou não bate
  // A Focus reenvia o valor exato do campo "authorization" registrado no hook
  if (!webhookSecret || authorizationHeader !== webhookSecret) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "invalid json" }, { status: 400 });
  }

  const ref = typeof body.ref === "string" ? body.ref : null;
  if (!ref) {
    // Ping de teste sem ref — aceita mas não processa
    return NextResponse.json({ ok: true });
  }

  // Dispara Inngest de forma best-effort (não bloqueia o response)
  // A Focus vai fazer retry se retornarmos erro, por isso os 200 são imediatos
  try {
    await inngest.send({ name: "fiscal/nfse.status-changed", data: { ref } });
  } catch (err) {
    console.error("[focus-nfe/webhook] failed to dispatch inngest event", err);
    // Retorna 500 para que a Focus faça retry
    return NextResponse.json({ error: "dispatch failed" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
```

### Setup único — registrar o webhook na Focus

```typescript
// Script one-off (rodar uma vez por ambiente via ts-node ou REPL):
import { registrarWebhook } from "@/http/focus-nfe/operations";

await registrarWebhook(
  {
    event: "nfse",
    url: "https://SEU_DOMINIO/api/focus-nfe/webhook",
    authorization: process.env.FOCUS_NFE_WEBHOOK_SECRET,
  },
  "HOMOLOGACAO",
);
```

---

## `src/inngest/functions/fiscal/nfse-status-sync.ts`

```typescript
import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { consultarNfse } from "@/http/focus-nfe/operations";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import type { FiscalEnvironment } from "@/generated/prisma/enums";

export const nfseStatusSync = inngest.createFunction(
  { id: "fiscal-nfse-status-sync", retries: 5 },
  { event: "fiscal/nfse.status-changed" },
  async ({ event, step }) => {
    const { ref } = event.data as { ref: string };

    // 1. Carrega a invoice
    const invoice = await step.run("load-invoice", async () =>
      prisma.fiscalInvoice.findUnique({
        where: { ref },
        include: { profile: true },
      })
    );

    if (!invoice) {
      console.warn(`[nfse-status-sync] invoice not found for ref=${ref}`);
      return;
    }

    // Idempotência: se já resolvida, não faz nada
    if (invoice.status === "AUTORIZADO" || invoice.status === "CANCELADO") return;

    // 2. Consulta a Focus (fonte canônica — nunca confia nos dados do body do webhook)
    const focusData = await step.run("consult-focus", async () =>
      consultarNfse(ref, invoice.environment as FiscalEnvironment)
    );

    if (focusData.status === "processando_autorizacao") {
      // Ainda processando — aguarda próximo webhook ou refreshStatus manual
      return;
    }

    if (focusData.status === "autorizado") {
      // 3. Download do XML para storage próprio
      const xmlStorageUrl = await step.run("download-xml", async () => {
        const xmlUrl = focusData.caminho_xml_nota_fiscal;
        if (!xmlUrl) return null;

        try {
          const xmlResponse = await fetch(xmlUrl, { signal: AbortSignal.timeout(30_000) });
          if (!xmlResponse.ok) return null;
          const xmlContent = await xmlResponse.text();

          // Upload para R2/S3 usando s3-client existente em src/lib/s3-client.ts
          // Chave: `fiscal/nfse/${invoice.organizationId}/${ref}.xml`
          const { uploadToS3 } = await import("@/lib/s3-client");
          const storageKey = `fiscal/nfse/${invoice.organizationId}/${ref}.xml`;
          await uploadToS3(storageKey, Buffer.from(xmlContent, "utf-8"), "application/xml");

          // Gerar URL de acesso usando r2-url ou url pública do bucket
          const { getR2Url } = await import("@/lib/r2-url");
          return getR2Url(storageKey);
        } catch (err) {
          console.error("[nfse-status-sync] XML download/upload failed", err);
          return null; // Não bloqueia a autorização por falha no XML
        }
      });

      // 4. Atualiza invoice para AUTORIZADO
      await step.run("update-authorized", async () =>
        prisma.fiscalInvoice.update({
          where: { ref },
          data: {
            status: "AUTORIZADO",
            numero: focusData.numero,
            codigoVerificacao: focusData.codigo_verificacao,
            urlEspelho: focusData.url,
            urlDanfse: focusData.url_danfse,
            caminhoXmlFocus: focusData.caminho_xml_nota_fiscal,
            caminhoXmlStorage: xmlStorageUrl,
            authorizedAt: new Date(),
            focusResponse: focusData as never,
            errorMessage: null,
          },
        })
      );

      // 5. Cobra Stars após autorização (nunca antes)
      await step.run("charge-stars", async () => {
        try {
          await chargeStarsByAction(invoice.organizationId, "fiscal_nfse_emit", {
            userId: invoice.issuedById,
            description: `NFS-e #${focusData.numero ?? ref} emitida`,
            appSlug: "forge",
          });
        } catch (err) {
          // Stars não podem bloquear a autorização — logar e seguir
          console.error("[nfse-status-sync] Stars charge failed", err);
        }
      });

    } else if (focusData.status === "erro_autorizacao") {
      await step.run("update-error", async () =>
        prisma.fiscalInvoice.update({
          where: { ref },
          data: {
            status: "ERRO",
            errorMessage: focusData.mensagem_erro ?? focusData.mensagem_erros?.[0] ?? "Erro desconhecido",
            focusResponse: focusData as never,
          },
        })
      );
    } else if (focusData.status === "cancelado") {
      await step.run("update-cancelled", async () =>
        prisma.fiscalInvoice.update({
          where: { ref },
          data: { status: "CANCELADO", focusResponse: focusData as never },
        })
      );
    }
  }
);
```

### Notas sobre o download do XML

> Verificar quais funções de upload/URL existem em `src/lib/s3-client.ts` e `src/lib/r2-url.ts` antes de implementar. Adaptar a assinatura conforme o que já existe (não criar novos helpers de upload se já houver um genérico).

---

## Registro em `src/app/api/inngest/route.ts`

```typescript
import { nfseStatusSync } from "@/inngest/functions/fiscal/nfse-status-sync";

// Adicionar no array do serve({ functions: [...] }):
nfseStatusSync,
```

---

## Validação desta etapa

```bash
# 1. Simular webhook manualmente:
curl -sX POST http://localhost:3000/api/focus-nfe/webhook \
  -H "Content-Type: application/json" \
  -H "Authorization: SEU_WEBHOOK_SECRET" \
  -d '{"ref": "forge-xxx-1"}'
# Deve retornar: {"ok": true}

# 2. Conferir no Inngest Dev UI (http://localhost:8288) se o evento
#    "fiscal/nfse.status-changed" foi recebido e a função executou.

# 3. Sem authorization ou com valor errado deve retornar 401.
```
