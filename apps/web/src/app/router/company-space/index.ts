/**
 * Router autenticado da Spacehome (owner/admin only).
 * Todas as procedures aqui passam por `orgAdminGuard` (exceto
 * `respond-role-consent`, que é o usuário-alvo respondendo).
 *
 * Uso no client: `orpc.companySpace.updateSpace({ ... })`.
 */
import { updateSpace } from "./update-space";
import { togglePublic } from "./toggle-public";
import { getSpaceAdmin } from "./get-space-admin";
import { upsertRole } from "./upsert-role";
import { notifyRoleConsent } from "./notify-role-consent";
import { respondRoleConsent } from "./respond-role-consent";
import { deleteRole } from "./delete-role";
import { reorderRoles } from "./reorder-roles";
import { moderateReview } from "./moderate-review";
import { moderateComment } from "./moderate-comment";
import { createPost } from "./create-post";
import { updatePost } from "./update-post";
import { deletePost } from "./delete-post";
import { toggleNBoxPublic } from "./toggle-nbox-public";

export const companySpaceRouter = {
  getSpaceAdmin,
  updateSpace,
  togglePublic,
  upsertRole,
  notifyRoleConsent,
  respondRoleConsent,
  deleteRole,
  reorderRoles,
  moderateReview,
  moderateComment,
  createPost,
  updatePost,
  deletePost,
  toggleNBoxPublic,
};
