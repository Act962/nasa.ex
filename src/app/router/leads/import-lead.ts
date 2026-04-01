import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { LeadAction } from "@/generated/prisma/enums";
import prisma from "@/lib/prisma";
import { normalizePhone } from "@/utils/format-phone";
import { Decimal } from "@prisma/client/runtime/client";
import z from "zod";

export const importLeadsBatch = base
  .use(requiredAuthMiddleware)
  .input(
    z.object({
      leads: z.array(
        z.object({
          name: z.string(),
          phone: z.string().optional(),
          email: z.string().optional(),
          document: z.string().optional(),
          description: z.string().optional(),
          amount: z.number().optional(),
          temperature: z.enum(["COLD", "WARM", "HOT", "VERY_HOT"]).optional(),
          source: z
            .enum(["DEFAULT", "WHATSAPP", "FORM", "AGENDA", "OTHER"])
            .optional(),
          profile: z.string().optional(),
          createdAt: z.string().optional(),
        }),
      ),
      trackingId: z.string(),
      statusId: z.string(),
    }),
  )
  .handler(async ({ input, context, errors }) => {
    console.log(
      "StatusId: " + input.statusId + "TrackingId: " + input.trackingId,
    );

    const status = await prisma.status.findFirst({
      where: {
        id: input.statusId,
        trackingId: input.trackingId,
      },
    });

    if (!status) {
      throw new Error("Status inválido para o funil informado");
    }

    const CHUNK_SIZE = 200;
    const results = {
      imported: 0,
      errors: [] as Array<{
        name: string;
        phone?: string;
        reason: string;
        rowIndex: number;
      }>,
    };

    // 1. Buscar o maior order atual UMA vez só
    const lastLead = await prisma.lead.findFirst({
      where: { statusId: input.statusId, trackingId: input.trackingId },
      orderBy: { order: "desc" },
      select: { order: true },
    });

    let currentOrder = lastLead
      ? new Decimal(lastLead.order).plus(1)
      : new Decimal(0);

    // 2. Buscar phones/emails já existentes UMA vez só
    const phones = input.leads.map((l) => l.phone).filter(Boolean) as string[];
    const existingLeads = await prisma.lead.findMany({
      where: {
        trackingId: input.trackingId,
        phone: { in: phones },
      },
      select: { phone: true, email: true },
    });

    const existingPhones = new Set(existingLeads.map((l) => l.phone));

    // 3. Filtrar leads válidos e montar payload com rastreamento
    // Rastrear telefones DENTRO do arquivo sendo importado (duplicatas internas)
    const seenPhonesInFile = new Map<
      string,
      { name: string; rowIndex: number }
    >();
    const toInsert: Array<any & { _rowIndex: number }> = [];
    const insertedLeadIndices = new Set<number>();

    for (let idx = 0; idx < input.leads.length; idx++) {
      const lead = input.leads[idx];

      // Validação: nome é obrigatório
      if (!lead.name || lead.name.trim() === "") {
        results.errors.push({
          name: lead.phone || "(sem nome)",
          phone: lead.phone,
          reason: "Nome é obrigatório",
          rowIndex: idx + 1,
        });
        continue;
      }

      const phone = normalizePhone(lead.phone);

      // Validação: telefone duplicado NO BANCO (leads já existentes)
      if (phone && existingPhones.has(phone)) {
        results.errors.push({
          name: lead.name,
          phone: lead.phone,
          reason: `Telefone já existe no funil`,
          rowIndex: idx + 1,
        });
        continue;
      }

      // Validação: telefone duplicado DENTRO DO ARQUIVO (duplicata interna)
      if (phone && seenPhonesInFile.has(phone)) {
        const firstOccurrence = seenPhonesInFile.get(phone)!;
        results.errors.push({
          name: lead.name,
          phone: lead.phone,
          reason: `Telefone duplicado no arquivo (linha ${firstOccurrence.rowIndex} também tem "${firstOccurrence.name}")`,
          rowIndex: idx + 1,
        });
        continue;
      }

      // Se passou em todas as validações, rastrear o telefone
      if (phone) {
        seenPhonesInFile.set(phone, { name: lead.name, rowIndex: idx + 1 });
      }

      toInsert.push({
        name: lead.name,
        phone: phone === "" ? null : phone,
        email: lead.email ?? null,
        document: lead.document ?? null,
        description: lead.description ?? null,
        amount: lead.amount ? new Decimal(lead.amount) : new Decimal(0),
        temperature: lead.temperature ?? "COLD",
        source: lead.source ?? "DEFAULT",
        profile: lead.profile ?? null,
        createdAt: parseImportDate(lead.createdAt),
        statusId: input.statusId,
        trackingId: input.trackingId,
        responsibleId: context.user.id,
        order: currentOrder,
        currentAction: LeadAction.ACTIVE,
        isActive: true,
        _rowIndex: idx + 1,
      });

      insertedLeadIndices.add(idx);
      currentOrder = currentOrder.plus(1);
    }

    // 4. Inserir em chunks dentro de UMA transaction
    const chunks = chunkArray(toInsert, CHUNK_SIZE);

    const insertedIds: string[] = [];

    try {
      await prisma.$transaction(
        async (tx) => {
          for (const chunk of chunks) {
            const chunkWithoutRowIndex = chunk.map(
              ({ _rowIndex, ...rest }) => rest,
            );
            await tx.lead.createMany({
              data: chunkWithoutRowIndex,
              skipDuplicates: true, // fallback de segurança
            });
            // Buscar os leads que foram criados
            for (const item of chunk) {
              const created = await tx.lead.findFirst({
                where: {
                  phone: item.phone,
                  trackingId: item.trackingId,
                  name: item.name,
                },
                select: { id: true },
              });
              if (created) {
                insertedIds.push(created.id);
              }
            }
          }
        },
        {
          timeout: 30_000,
        },
      );
    } catch (err) {
      console.error("Erro ao inserir leads:", err);
      for (const item of toInsert) {
        results.errors.push({
          name: item.name,
          phone: item.phone,
          reason: "Erro ao inserir na base de dados",
          rowIndex: item._rowIndex,
        });
      }
      return results;
    }

    // 5. Registrar history em batch
    if (insertedIds.length > 0) {
      await prisma.leadHistory.createMany({
        data: insertedIds.map((leadId) => ({
          leadId,
          action: "ACTIVE" as LeadAction,
          notes: "Lead importado via planilha",
          userId: context.user.id,
        })),
      });
    }

    results.imported = insertedIds.length;
    return results;
  });

// util
function chunkArray<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size),
  );
}

function parseImportDate(dateStr?: string): Date {
  if (!dateStr || dateStr.trim() === "") return new Date();

  const cleaned = dateStr.trim().split(" ")[0]; // ignora parte de hora

  // Formato BR: DD/MM/YYYY ou DD-MM-YYYY
  const brMatch = cleaned.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/);
  if (brMatch) {
    const day = parseInt(brMatch[1], 10);
    const month = parseInt(brMatch[2], 10) - 1; // 0-indexed
    let year = parseInt(brMatch[3], 10);
    if (year < 100) year += 2000;

    // Date.UTC garante meia-noite UTC, sem desvio de fuso
    const ts = Date.UTC(year, month, day);
    if (!isNaN(ts)) return new Date(ts);
  }

  // Formato ISO: YYYY-MM-DD ou YYYY/MM/DD
  const isoMatch = cleaned.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (isoMatch) {
    const year = parseInt(isoMatch[1], 10);
    const month = parseInt(isoMatch[2], 10) - 1;
    const day = parseInt(isoMatch[3], 10);

    const ts = Date.UTC(year, month, day);
    if (!isNaN(ts)) return new Date(ts);
  }

  // Último fallback: deixa o JS tentar (comportamento anterior)
  const d = new Date(dateStr);
  if (!isNaN(d.getTime())) return d;

  return new Date();
}
