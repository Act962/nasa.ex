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
import { setTemplate } from "./set-template";
import { send } from "./send";
import { reopen } from "./reopen";
import { listContacts } from "./list-contacts";
import { contactFilterOptions } from "./contact-filter-options";
import { addRecipientsFromContacts } from "./add-recipients-from-contacts";
import { analytics } from "./analytics";

/**
 * App "Campanhas" (disparos WhatsApp API Oficial).
 *  - Fase 1: fundação + audiência.
 *  - Fase 2: criação de templates de marketing/utilidade (Meta).
 *  - Fase 3: anexar template + disparo ao vivo (`setTemplate`, `send`).
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
  setTemplate,
  send,
  reopen,
  listContacts,
  contactFilterOptions,
  addRecipientsFromContacts,
  analytics,
};
