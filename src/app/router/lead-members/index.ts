import {
  createLeadMember,
  listLeadMembers,
  mergeLeadAsMember,
  promoteLeadMemberToLead,
  updateLeadMember,
  updateLeadMemberLabels,
} from "./members";

export const leadMembersRouter = {
  list: listLeadMembers,
  create: createLeadMember,
  update: updateLeadMember,
  updateLabels: updateLeadMemberLabels,
  promote: promoteLeadMemberToLead,
  mergeLead: mergeLeadAsMember,
};
