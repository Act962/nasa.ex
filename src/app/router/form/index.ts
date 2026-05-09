import { createForm } from "./create";
import { fetchFormById } from "./get";
import { getManyResponses } from "./get-many-responses";
import { getPublic } from "./public/get";
import { fetchForms } from "./list";
import { updateForm } from "./update";
import { submitResponse } from "./public/submut-response";
import { PublishForm } from "./publish";
import { insightForm } from "./status";
import { deleteForm } from "./delete";
import { togglePublicOnSpace } from "./toggle-public-on-space";
import { getResponseById } from "./get-response";
import { updateResponse } from "./update-response";
import { createResponseForLead } from "./create-response-for-lead";
import { getResponseByToken } from "./get-response-by-token";
import { updateClientSignatures } from "./update-client-signatures";

export const formRouter = {
  get: fetchFormById,
  create: createForm,
  list: fetchForms,
  update: updateForm,
  delete: deleteForm,
  listResponse: getManyResponses,
  getResponseById,
  updateResponse,
  createResponseForLead,
  getResponseByToken,
  updateClientSignatures,
  getPublic,
  submitResponse,
  PublishForm,
  togglePublicOnSpace,
  insightForm,
};
