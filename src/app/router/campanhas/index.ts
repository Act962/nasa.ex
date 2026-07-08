import { listSendingNumbers } from "./list-sending-numbers";
import { create } from "./create";
import { list } from "./list";
import { get } from "./get";
import { update } from "./update";
import { remove } from "./delete";
import { addRecipientsFromLeads } from "./add-recipients-from-leads";
import { addRecipientsFromCsv } from "./add-recipients-from-csv";
import { listRecipients } from "./list-recipients";
import { removeRecipient } from "./remove-recipient";
import { listTemplates } from "./list-templates";
import { createTemplate } from "./create-template";
import { uploadTemplateSample } from "./upload-template-sample";

/**
 * App "Campanhas" (disparos WhatsApp API Oficial).
 *  - Fase 1: fundação + audiência.
 *  - Fase 2: criação de templates de marketing (Meta).
 * Ver `docs/campanhas-overview.md`.
 */
export const campanhasRouter = {
  listSendingNumbers,
  create,
  list,
  get,
  update,
  delete: remove,
  addRecipientsFromLeads,
  addRecipientsFromCsv,
  listRecipients,
  removeRecipient,
  listTemplates,
  createTemplate,
  uploadTemplateSample,
};
