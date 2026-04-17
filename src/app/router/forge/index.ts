import {
  listForgeProducts,
  createForgeProduct,
  updateForgeProduct,
  deleteForgeProduct,
} from "./products";
import {
  listForgeProposals,
  getForgeProposal,
  createForgeProposal,
  updateForgeProposal,
  deleteForgeProposal,
  getForgeProposalPublic,
  trackProposalView,
} from "./proposals";
import {
  listForgeContracts,
  createForgeContract,
  updateForgeContract,
  deleteForgeContract,
} from "./contracts";
import {
  listForgeTemplates,
  createForgeTemplate,
  updateForgeTemplate,
  deleteForgeTemplate,
} from "./templates";
import { getForgeSettings, updateForgeSettings } from "./settings";
import { getForgeDashboard } from "./dashboard";

export const forgeRouter = {
  products: {
    list: listForgeProducts,
    create: createForgeProduct,
    update: updateForgeProduct,
    delete: deleteForgeProduct,
  },
  proposals: {
    list: listForgeProposals,
    get: getForgeProposal,
    create: createForgeProposal,
    update: updateForgeProposal,
    delete: deleteForgeProposal,
    getPublic: getForgeProposalPublic,
    trackProposalView: trackProposalView,
  },
  contracts: {
    list: listForgeContracts,
    create: createForgeContract,
    update: updateForgeContract,
    delete: deleteForgeContract,
  },
  templates: {
    list: listForgeTemplates,
    create: createForgeTemplate,
    update: updateForgeTemplate,
    delete: deleteForgeTemplate,
  },
  settings: {
    get: getForgeSettings,
    update: updateForgeSettings,
  },
  dashboard: {
    get: getForgeDashboard,
  },
};
