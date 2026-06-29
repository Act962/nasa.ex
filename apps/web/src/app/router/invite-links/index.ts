import { createInviteLink } from "./create";
import { listInviteLinks } from "./list";
import { revokeInviteLink } from "./revoke";
import { deleteInviteLink } from "./delete";
import { getInviteLinkByToken } from "./get-by-token";
import { joinViaInviteLink } from "./join";

export const inviteLinksRouter = {
  create: createInviteLink,
  list: listInviteLinks,
  revoke: revokeInviteLink,
  delete: deleteInviteLink,
  getByToken: getInviteLinkByToken,
  join: joinViaInviteLink,
};
