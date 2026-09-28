import "server-only";

import prisma from "@/lib/prisma";

// Vincula anexos já enviados a um ou mais lançamentos (spec 0008, RF-5).
//
// Em lançamento parcelado, o registro original é adotado pela primeira parcela
// e as demais ganham cópias apontando pra MESMA `fileKey` — assim o anexo é
// encontrável a partir de qualquer parcela sem duplicar o objeto no bucket.
// A exclusão do objeto só acontece quando o último registro que o referencia
// some (D-4).

interface LinkAttachmentsInput {
  organizationId: string;
  attachmentIds: string[];
  entryIds: string[];
}

export async function linkAttachmentsToEntries({
  organizationId,
  attachmentIds,
  entryIds,
}: LinkAttachmentsInput): Promise<number> {
  if (attachmentIds.length === 0 || entryIds.length === 0) return 0;

  const [attachments, entries] = await Promise.all([
    prisma.paymentAttachment.findMany({
      where: { id: { in: attachmentIds }, organizationId },
    }),
    prisma.paymentEntry.findMany({
      where: { id: { in: entryIds }, organizationId },
      select: { id: true },
    }),
  ]);

  if (attachments.length === 0 || entries.length === 0) return 0;

  const [firstEntry, ...siblingEntries] = entries;

  return prisma.$transaction(async (tx) => {
    await tx.paymentAttachment.updateMany({
      where: { id: { in: attachments.map((attachment) => attachment.id) } },
      data: { entryId: firstEntry.id },
    });

    if (siblingEntries.length === 0) return attachments.length;

    const copies = siblingEntries.flatMap((entry) =>
      attachments.map((attachment) => ({
        organizationId: attachment.organizationId,
        entryId: entry.id,
        fileKey: attachment.fileKey,
        fileName: attachment.fileName,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        kind: attachment.kind,
        description: attachment.description,
        uploadedById: attachment.uploadedById,
      })),
    );
    await tx.paymentAttachment.createMany({ data: copies });

    return attachments.length + copies.length;
  });
}
