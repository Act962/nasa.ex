import { z } from "zod";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { normalizeSearchText } from "@/features/form-records/lib/record-fields";
import { LOOKUP_SOURCES } from "@/features/form-records/lib/orbit-lookup-value";

// Busca do campo "Busca no Órbita" (spec 0075, RF-7). Só para membro logado
// da organização: formulário público nunca chega aqui com sessão.

const MAX_RESULTS = 8;

const lookupOptionSchema = z.object({
  id: z.string(),
  label: z.string(),
  detail: z.string().nullable(),
  /** nome-chave → valor, para preencher os campos de mesmo nome no formulário. */
  fields: z.record(z.string(), z.string()),
});

type LookupOption = z.infer<typeof lookupOptionSchema>;

export function readKeyFieldValues(rawKeyFields: unknown): Record<string, string> {
  if (!rawKeyFields || typeof rawKeyFields !== "object" || Array.isArray(rawKeyFields)) return {};
  const values: Record<string, string> = {};
  for (const [fieldKey, rawField] of Object.entries(rawKeyFields as Record<string, unknown>)) {
    const value = (rawField as { value?: unknown } | null)?.value;
    if (typeof value === "string" && value) values[fieldKey] = value;
  }
  return values;
}

export const searchLookup = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Search data for a form lookup field", tags: ["Forms"] })
  .input(
    z.object({
      source: z.enum(LOOKUP_SOURCES),
      query: z.string().trim().max(80).default(""),
      /** Formulário cujas fichas são a fonte, quando `source` é RECORDS. */
      sourceFormId: z.string().optional(),
      /** Traz só esta ficha: usada quando a tela já abre com a ficha de origem escolhida. */
      recordId: z.string().optional(),
    }),
  )
  .output(z.object({ options: z.array(lookupOptionSchema) }))
  .handler(async ({ input, context }) => {
    const organizationId = context.org.id;
    const query = input.query;

    if (input.source === "LEADS") {
      const leads = await prisma.lead.findMany({
        where: {
          tracking: { organizationId },
          ...(query
            ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { phone: { contains: query } }] }
            : {}),
        },
        select: { id: true, name: true, phone: true },
        orderBy: { name: "asc" },
        take: MAX_RESULTS,
      });
      const options: LookupOption[] = leads.map((lead) => ({
        id: lead.id,
        label: lead.name,
        detail: lead.phone ?? null,
        fields: { cliente: lead.name },
      }));
      return { options };
    }

    if (input.source === "PRODUCTS") {
      const products = await prisma.forgeProduct.findMany({
        where: {
          organizationId,
          ...(query
            ? { OR: [{ name: { contains: query, mode: "insensitive" } }, { sku: { contains: query, mode: "insensitive" } }] }
            : {}),
        },
        select: { id: true, name: true, unit: true },
        orderBy: { name: "asc" },
        take: MAX_RESULTS,
      });
      return {
        options: products.map((product) => ({ id: product.id, label: product.name, detail: product.unit, fields: {} })),
      };
    }

    if (!input.sourceFormId) return { options: [] };
    const records = await prisma.formRecord.findMany({
      where: {
        organizationId,
        formId: input.sourceFormId,
        ...(input.recordId ? { id: input.recordId } : {}),
        ...(query ? { searchText: { contains: normalizeSearchText(query) } } : {}),
      },
      select: { id: true, label: true, leadId: true, keyFields: true, referenceDate: true },
      orderBy: { referenceDate: "desc" },
      take: MAX_RESULTS,
    });
    const leadIds = [...new Set(records.map((record) => record.leadId).filter((leadId): leadId is string => leadId !== null))];
    const leads =
      leadIds.length > 0
        ? await prisma.lead.findMany({
            where: { id: { in: leadIds }, tracking: { organizationId } },
            select: { id: true, name: true },
          })
        : [];
    const leadNameById = new Map(leads.map((lead) => [lead.id, lead.name]));

    const options: LookupOption[] = records.map((record) => {
      const fields = readKeyFieldValues(record.keyFields);
      const leadName = record.leadId ? leadNameById.get(record.leadId) : undefined;
      if (leadName && !fields.cliente) fields.cliente = leadName;
      const summary = Object.values(fields).slice(0, 3).join(" · ");
      return {
        id: record.id,
        label: record.label?.trim() || summary || "Ficha sem título",
        detail: [leadName, record.referenceDate.toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })]
          .filter(Boolean)
          .join(" · "),
        fields,
      };
    });
    return { options };
  });

/**
 * Onde um cliente cadastrado na hora, pela tela de nova ficha, deve entrar:
 * o tracking e a etapa configurados no formulário ou, na falta, o primeiro
 * tracking de que o usuário participa. A criação em si usa `leads.create`.
 */
export const getQuickClientDefaults = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .route({ method: "GET", summary: "Where a client created from the record picker should land", tags: ["Forms"] })
  .input(z.object({ formId: z.string() }))
  .output(z.object({ trackingId: z.string().nullable(), statusId: z.string().nullable(), trackingName: z.string().nullable() }))
  .handler(async ({ input, context, errors }) => {
    const organizationId = context.org.id;
    const form = await prisma.form.findFirst({
      where: { id: input.formId, organizationId },
      select: { settings: { select: { trackingId: true, statusId: true } } },
    });
    if (!form) throw errors.NOT_FOUND({ message: "Formulário não encontrado" });

    const firstStatusOf = (trackingId: string) =>
      prisma.status.findFirst({ where: { trackingId }, orderBy: { order: "asc" }, select: { id: true } });
    const participantOf = (trackingId?: string) =>
      prisma.trackingParticipant.findFirst({
        where: { userId: context.user.id, tracking: { organizationId }, ...(trackingId ? { trackingId } : {}) },
        orderBy: { createdAt: "asc" },
        select: { tracking: { select: { id: true, name: true } } },
      });

    // O tracking do formulário só vale se quem está preenchendo participa dele.
    const configured = form.settings?.trackingId ? await participantOf(form.settings.trackingId) : null;
    const participation = configured ?? (await participantOf());
    if (!participation) return { trackingId: null, statusId: null, trackingName: null };

    const isConfiguredStatus = configured !== null && Boolean(form.settings?.statusId);
    const status = isConfiguredStatus ? { id: form.settings?.statusId ?? "" } : await firstStatusOf(participation.tracking.id);
    return { trackingId: participation.tracking.id, statusId: status?.id ?? null, trackingName: participation.tracking.name };
  });
