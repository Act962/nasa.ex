import { enable } from "./enable";
import { disable } from "./disable";
import { grantAuth } from "./grant-auth";
import { revokeAuth } from "./revoke-auth";
import { listMembersWithAuth } from "./list-members-with-auth";
import { updateSettings } from "./update-settings";
import { getStatus } from "./get-status";

export const metaMcpRouter = {
  enable,
  disable,
  grantAuth,
  revokeAuth,
  listMembersWithAuth,
  updateSettings,
  getStatus,
};
