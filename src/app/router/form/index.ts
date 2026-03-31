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

export const formRouter = {
  get: fetchFormById,
  create: createForm,
  list: fetchForms,
  update: updateForm,
  delete: deleteForm,
  listResponse: getManyResponses,
  getPublic,
  submitResponse,
  PublishForm,
  insightForm,
};
