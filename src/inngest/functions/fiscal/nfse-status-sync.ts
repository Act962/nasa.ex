import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { resolveGatewayForInvoice } from "@/features/fiscal/lib/gateways";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { S3 } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { FiscalGateway } from "@/generated/prisma/enums";
import type {
  FiscalCompanyProfile,
  FiscalInvoice,
} from "@/generated/prisma/client";

// Disparado por qualquer gateway: Focus correlaciona por `ref` (embutido na
// URL do webhook), NFE.io por `externalId` (o webhook é por conta, não por
// nota). A consulta ao gateway (getInvoice) é sempre a fonte da verdade — os
// dados do webhook servem só de sinal "algo mudou" + fallback de mensagem de
// erro em caso de defasagem entre o webhook e a consulta.
export const nfseStatusSync = inngest.createFunction(
  { id: "fiscal-nfse-status-sync", retries: 5 },
  { event: "fiscal/nfse.status-changed" },
  async ({ event, step }) => {
    const {
      gateway,
      ref,
      externalId,
      webhookErrorMessages,
    } = event.data as {
      gateway: FiscalGateway;
      ref: string | null;
      externalId: string | null;
      webhookErrorMessages?: string[] | null;
    };

    const invoiceStepResult = await step.run("load-invoice", async () => {
      if (ref) {
        return prisma.fiscalInvoice.findUnique({
          where: { ref },
          include: { profile: true },
        });
      }
      if (externalId) {
        return prisma.fiscalInvoice.findFirst({
          where: { externalId, gateway },
          include: { profile: true },
        });
      }
      return null;
    });

    if (!invoiceStepResult) {
      console.warn("[nfse-status-sync] invoice not found", {
        gateway,
        ref,
        externalId,
      });
      return;
    }

    // step.run serializa o retorno como JSON entre steps (Date vira string) —
    // os campos Date da invoice/perfil não são usados aqui, só repassados aos
    // adapters, então o cast de volta ao tipo Prisma é seguro.
    const invoice = invoiceStepResult as unknown as FiscalInvoice & {
      profile: FiscalCompanyProfile;
    };

    if (invoice.status === "AUTORIZADO" || invoice.status === "CANCELADO")
      return;

    const snapshot = await step.run("consult-gateway", async () => {
      const gatewayAdapter = resolveGatewayForInvoice(invoice);
      return gatewayAdapter.getInvoice({
        invoice,
        profile: invoice.profile,
      });
    });

    if (snapshot.status === "PROCESSANDO") {
      // Ainda em processamento na fonte — mas o webhook pode ter chegado com
      // erro antes da consulta convergir (eventual consistência).
      if (webhookErrorMessages?.length) {
        await step.run("update-error-from-webhook", async () =>
          prisma.fiscalInvoice.update({
            where: { id: invoice.id },
            data: {
              status: "ERRO",
              flowStatus: snapshot.rawStatus,
              errorMessage: webhookErrorMessages[0],
              focusResponse: snapshot.providerResponse as never,
            },
          }),
        );
      }
      return;
    }

    if (snapshot.status === "AUTORIZADO") {
      const xmlStorageUrl = await step.run("download-xml", async () => {
        try {
          const gatewayAdapter = resolveGatewayForInvoice(invoice);
          const xmlFile = await gatewayAdapter.downloadInvoiceXml({
            invoice,
            profile: invoice.profile,
          });
          if (!xmlFile) return null;

          let xmlBuffer: Buffer;
          if (xmlFile.kind === "buffer") {
            xmlBuffer = xmlFile.buffer;
          } else {
            const xmlResponse = await fetch(xmlFile.url, {
              signal: AbortSignal.timeout(30_000),
            });
            if (!xmlResponse.ok) return null;
            xmlBuffer = Buffer.from(await xmlResponse.arrayBuffer());
          }

          const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
          if (!bucket) return null;

          const storageKey = `fiscal/nfse/${invoice.organizationId}/${invoice.ref}.xml`;
          await S3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: storageKey,
              Body: xmlBuffer,
              ContentType: "application/xml",
            }),
          );

          const publicBase = process.env.NEXT_PUBLIC_S3_BUCKET_CONSTRUCTOR_URL;
          return publicBase
            ? `https://${publicBase}/${storageKey}`
            : storageKey;
        } catch (err) {
          console.error(
            "[nfse-status-sync] XML download/upload failed",
            err,
          );
          return null;
        }
      });

      await step.run("update-authorized", async () =>
        prisma.fiscalInvoice.update({
          where: { id: invoice.id },
          data: {
            status: "AUTORIZADO",
            flowStatus: snapshot.rawStatus,
            ...(snapshot.externalId ? { externalId: snapshot.externalId } : {}),
            numero: snapshot.numero,
            codigoVerificacao: snapshot.codigoVerificacao,
            urlEspelho: snapshot.urlEspelho,
            urlDanfse: snapshot.urlDanfse,
            caminhoXmlFocus: snapshot.caminhoXml,
            caminhoXmlStorage: xmlStorageUrl,
            authorizedAt: new Date(),
            focusResponse: snapshot.providerResponse as never,
            errorMessage: null,
          },
        }),
      );

      await step.run("charge-stars", async () => {
        try {
          await chargeStarsByAction(
            invoice.organizationId,
            "fiscal_nfse_emit",
            {
              userId: invoice.issuedById,
              description: `NFS-e #${snapshot.numero ?? invoice.ref} emitida`,
              appSlug: "forge",
            },
          );
        } catch (err) {
          console.error("[nfse-status-sync] Stars charge failed", err);
        }
      });
    } else if (snapshot.status === "ERRO") {
      await step.run("update-error", async () =>
        prisma.fiscalInvoice.update({
          where: { id: invoice.id },
          data: {
            status: "ERRO",
            flowStatus: snapshot.rawStatus,
            errorMessage:
              snapshot.errorMessage ??
              webhookErrorMessages?.[0] ??
              "Erro desconhecido",
            focusResponse: snapshot.providerResponse as never,
          },
        }),
      );
    } else if (snapshot.status === "CANCELADO") {
      await step.run("update-cancelled", async () =>
        prisma.fiscalInvoice.update({
          where: { id: invoice.id },
          data: {
            status: "CANCELADO",
            flowStatus: snapshot.rawStatus,
            focusResponse: snapshot.providerResponse as never,
          },
        }),
      );
    }
  },
);
