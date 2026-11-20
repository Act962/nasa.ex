import "server-only";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import prisma from "@/lib/prisma";
import { S3 } from "@/lib/s3-client";
import { describeSalePayment } from "@/features/forge/lib/sale-payment";
import { loadSaleReceipt } from "./load-sale-receipt";
import { renderReceiptPdf } from "./receipt-pdf";

/**
 * Recibo emitido = venda recebida: entra no Financeiro como conta a receber já paga, com o PDF do recibo
 * nos comprovantes (spec 0151, RF-11). Roda depois da resposta e não derruba a venda se falhar.
 * Idempotente pelo nº do documento ("Recibo 0012") dentro da empresa.
 */
export async function recordSaleInFinance({ proposalId, userId, receiptUrl }: { proposalId: string; userId: string; receiptUrl: string }) {
  const loaded = await loadSaleReceipt({ id: proposalId });
  if (!loaded) return;
  const { receipt, organizationId } = loaded;
  const documentNumber = `Recibo ${String(receipt.number).padStart(4, "0")}`;

  const existing = await prisma.paymentEntry.findFirst({
    where: { organizationId, type: "RECEIVABLE", documentNumber, leadId: loaded.leadId },
    select: { id: true },
  });
  if (existing) return;

  const amountCents = Math.round(loaded.total * 100);
  const paidAt = new Date(receipt.paidAt);
  const payment = describeSalePayment(receipt.paymentMethod, receipt.installments);
  const entry = await prisma.paymentEntry.create({
    data: {
      organizationId,
      type: "RECEIVABLE",
      status: "PAID",
      description: `${documentNumber} - ${receipt.client?.name ?? "Cliente"}`.slice(0, 250),
      amount: amountCents,
      paidAmount: amountCents,
      dueDate: paidAt,
      paidAt,
      competenceDate: paidAt,
      documentNumber,
      notes: [payment ? `Forma de pagamento: ${payment}` : null, `Recibo: ${receiptUrl}`].filter(Boolean).join("\n"),
      leadId: loaded.leadId,
      trackingId: loaded.trackingId,
      createdById: userId,
    },
    select: { id: true },
  });

  try {
    const pdf = await renderReceiptPdf(receipt);
    const fileKey = `payment/attachments/${organizationId}/${uuidv4()}.pdf`;
    await S3.send(
      new PutObjectCommand({ Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!, Key: fileKey, Body: pdf, ContentType: "application/pdf" }),
    );
    const fileName = `${documentNumber.replace(" ", "-").toLowerCase()}.pdf`;
    await prisma.paymentAttachment.create({
      data: {
        organizationId,
        entryId: entry.id,
        fileKey,
        fileName,
        originalFileName: fileName,
        mimeType: "application/pdf",
        sizeBytes: pdf.byteLength,
        kind: "RECIBO",
        sourceChannel: "forge",
        description: `Recibo emitido pelo Órbita (${receiptUrl})`.slice(0, 500),
        uploadedById: userId,
      },
    });
  } catch (error) {
    // Sem o PDF o lançamento continua valendo; o link do recibo fica nas observações.
    console.error("[forge/sales] receipt_pdf_attachment_failed", { proposalId, error });
  }
}
