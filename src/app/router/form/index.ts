import { createForm } from "./create";
import { fetchFormById } from "./get";
import { getManyResponses } from "./get-many-responses";
import { getPublic } from "./public/get";
import { fetchForms } from "./list";
import { updateForm } from "./update";
import { submitResponse } from "./public/submut-response";
import { savePartialResponse } from "./public/save-partial-response";
import { findDraftByPhone } from "./public/find-draft";
import { validateLeadPhone } from "./public/validate-lead-phone";
import { PublishForm } from "./publish";
import { insightForm } from "./status";
import { deleteForm } from "./delete";
import { togglePublicOnSpace } from "./toggle-public-on-space";
import { getResponseById } from "./get-response";
import { updateResponse } from "./update-response";
import { updateResponseLabel } from "./update-response-label";
import { cancelResponse } from "./cancel-response";
import { createResponseForLead } from "./create-response-for-lead";
import { getResponseByToken } from "./get-response-by-token";
import { updateClientSignatures } from "./update-client-signatures";
import { recordFormOpening } from "./record-form-opening";
import { listRecentResponses } from "./list-recent-responses";

export const formRouter = {
  get: fetchFormById,
  create: createForm,
  list: fetchForms,
  update: updateForm,
  delete: deleteForm,
  listResponse: getManyResponses,
  listRecentResponses,
  getResponseById,
  updateResponse,
  updateResponseLabel,
  cancelResponse,
  createResponseForLead,
  recordFormOpening,
  getResponseByToken,
  updateClientSignatures,
  getPublic,
  submitResponse,
  savePartialResponse,
  findDraftByPhone,
  validateLeadPhone,
  PublishForm,
  togglePublicOnSpace,
  insightForm,
};
