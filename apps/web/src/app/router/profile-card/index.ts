/**
 * Router do UserProfileCard (dropdown do organograma, tela de edição).
 * - `upsert/add/remove` exigem auth.
 * - `list*Catalog` e `listJobTitles` são públicos (catálogos).
 *
 * Uso no client: `orpc.profileCard.upsertProfileCard({ ... })`.
 */
import { upsertProfileCard } from "./upsert-profile-card";
import { addSkill } from "./add-skill";
import { removeSkill } from "./remove-skill";
import { addTool } from "./add-tool";
import { removeTool } from "./remove-tool";
import { listSkillCatalog } from "./list-skill-catalog";
import { listToolCatalog } from "./list-tool-catalog";
import { listJobTitles } from "./list-job-titles";
import { listRoleConsentRequests } from "./list-role-consent-requests";
import { getMyProfileCard } from "./get-my-profile-card";

export const profileCardRouter = {
  getMyProfileCard,
  upsertProfileCard,
  addSkill,
  removeSkill,
  addTool,
  removeTool,
  listSkillCatalog,
  listToolCatalog,
  listJobTitles,
  listRoleConsentRequests,
};
