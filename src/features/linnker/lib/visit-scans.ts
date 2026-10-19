import type { Prisma } from "@/generated/prisma/client";

// Visita à página do Linnker. O clique no WhatsApp também vira `LinnkerScan` (spec 0114) e não pode contar
// como visita: quem visita e clica contaria duas vezes. `scanKind` nulo é a visita de sempre.
export const LINNKER_VISIT_SCAN_WHERE: Prisma.LinnkerScanWhereInput = {
  OR: [{ scanKind: null }, { scanKind: { not: "whatsapp_link" } }],
};
