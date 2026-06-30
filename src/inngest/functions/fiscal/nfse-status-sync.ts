import { inngest } from "@/inngest/client";
import prisma from "@/lib/prisma";
import { consultarNfse } from "@/http/focus-nfe/consultar-nfse";
import { chargeStarsByAction } from "@/features/stars/lib/charge-by-action";
import { decryptSecret } from "@/lib/crypto";
import { S3 } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import type { FiscalEnvironment } from "@/generated/prisma/enums";

export const nfseStatusSync = inngest.createFunction(
  { id: "fiscal-nfse-status-sync", retries: 5 },
  { event: "fiscal/nfse.status-changed" },
  async ({ event, step }) => {
    const { ref } = event.data as { ref: string };

    const invoice = await step.run("load-invoice", async () =>
      prisma.fiscalInvoice.findUnique({
        where: { ref },
        include: { profile: true },
      }),
    );

    if (!invoice) {
      console.warn(`[nfse-status-sync] invoice not found for ref=${ref}`);
      return;
    }

    if (invoice.status === "AUTORIZADO" || invoice.status === "CANCELADO")
      return;

    const focusData = await step.run("consult-focus", async () => {
      const fiscalEnvironment = invoice.environment as FiscalEnvironment;
      const encryptedToken =
        fiscalEnvironment === "HOMOLOGACAO"
          ? invoice.profile.focusTokenHomologacao
          : invoice.profile.focusTokenProducao;
      if (!encryptedToken)
        throw new Error(`Token Focus NFe ausente no perfil para ref=${ref}`);
      const companyToken = decryptSecret(encryptedToken);
      return consultarNfse(ref, fiscalEnvironment, companyToken);
    });

    if (focusData.status === "processando_autorizacao") return;

    if (focusData.status === "autorizado") {
      const xmlStorageUrl = await step.run("download-xml", async () => {
        const xmlUrl = focusData.caminho_xml_nota_fiscal;
        if (!xmlUrl) return null;

        try {
          const xmlResponse = await fetch(xmlUrl, {
            signal: AbortSignal.timeout(30_000),
          });
          if (!xmlResponse.ok) return null;

          const xmlContent = await xmlResponse.text();
          const bucket = process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES;
          if (!bucket) return null;

          const storageKey = `fiscal/nfse/${invoice.organizationId}/${ref}.xml`;
          await S3.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: storageKey,
              Body: Buffer.from(xmlContent, "utf-8"),
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
        }),
      );

      await step.run("charge-stars", async () => {
        try {
          await chargeStarsByAction(
            invoice.organizationId,
            "fiscal_nfse_emit",
            {
              userId: invoice.issuedById,
              description: `NFS-e #${focusData.numero ?? ref} emitida`,
              appSlug: "forge",
            },
          );
        } catch (err) {
          console.error("[nfse-status-sync] Stars charge failed", err);
        }
      });
    } else if (focusData.status === "erro_autorizacao") {
      await step.run("update-error", async () =>
        prisma.fiscalInvoice.update({
          where: { ref },
          data: {
            status: "ERRO",
            errorMessage:
              focusData.erros?.[0]?.mensagem ?? "Erro desconhecido",
            focusResponse: focusData as never,
          },
        }),
      );
    } else if (focusData.status === "cancelado") {
      await step.run("update-cancelled", async () =>
        prisma.fiscalInvoice.update({
          where: { ref },
          data: { status: "CANCELADO", focusResponse: focusData as never },
        }),
      );
    }
  },
);
