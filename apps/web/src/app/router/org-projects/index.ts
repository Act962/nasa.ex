import { listOrgProjects } from "./list";
import { getOrgProject } from "./get";
import { createOrgProject } from "./create";
import { updateOrgProject } from "./update";
import { deleteOrgProject } from "./delete";
import { updateProjectBrand } from "./update-brand";
import { togglePublic } from "./toggle-public";

export const orgProjectsRouter = {
  list: listOrgProjects,
  get: getOrgProject,
  create: createOrgProject,
  update: updateOrgProject,
  delete: deleteOrgProject,
  updateBrand: updateProjectBrand,
  togglePublic,
};
