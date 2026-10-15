import { inngest } from "@/inngest/client";
import {
  ERP_CARTEIRA_IMPORT_EVENT,
  failImportRun,
  finishImportRun,
  importNextPage,
  startImportRun,
  type ErpCarteiraImportEvent,
} from "@/features/erp-carteira/server/run-import";

// ~28 mil clientes em páginas de 200: 140 páginas. O teto só impede laço infinito.
const MAX_PAGES = 400;

// Spec 0106: carteira do ERP → leads, uma página por step (retoma de onde parou se cair).
export const importErpCarteira = inngest.createFunction(
  {
    id: "erp-carteira-import",
    retries: 3,
    concurrency: { limit: 1, key: "event.data.organizationId" },
    onFailure: async ({ event, error }) => {
      const { organizationId } = event.data.event.data as ErpCarteiraImportEvent;
      await failImportRun(organizationId, error.message);
    },
  },
  { event: ERP_CARTEIRA_IMPORT_EVENT },
  async ({ event, step }) => {
    const { organizationId, mode } = event.data as ErpCarteiraImportEvent;
    const setup = await step.run("start", () => startImportRun(organizationId, mode));
    if (!setup) return { skipped: "sem-configuracao" };

    let cursor = setup.cursor;
    let pages = 0;
    for (; pages < MAX_PAGES; pages++) {
      const pageCursor = cursor;
      const result = await step.run(`page-${pages}`, () =>
        importNextPage(organizationId, setup, pageCursor),
      );
      cursor = result.nextCursor;
      if (!cursor) break;
    }

    await step.run("finish", () => finishImportRun(organizationId, setup.mode));
    return { mode: setup.mode, pages: pages + 1 };
  },
);
