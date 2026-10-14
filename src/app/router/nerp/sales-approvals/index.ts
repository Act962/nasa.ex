import { decideOrderApproval } from "./decide-approval";
import { installGuidedSaleFlows } from "./install-flows";
import { listOrderApprovals } from "./list-order-approvals";
import { listSalesApprovers } from "./list-approvers";
import { removeSalesApprover } from "./remove-approver";
import { saveSalesApprover } from "./save-approver";
import { saveSalesApprovalTemplates } from "./save-templates";

// Venda guiada pelo catálogo com aprovação dos setores (spec 0104).
export const nerpSalesApprovalsRouter = {
  listApprovers: listSalesApprovers,
  saveApprover: saveSalesApprover,
  removeApprover: removeSalesApprover,
  saveTemplates: saveSalesApprovalTemplates,
  installFlows: installGuidedSaleFlows,
  listOrderApprovals,
  decide: decideOrderApproval,
};
