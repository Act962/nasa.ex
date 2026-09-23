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
import { acceptProposalAsContract } from "./accept-proposal";
import {
  listForgePriceItems,
  createForgePriceItem,
  updateForgePriceItem,
  deleteForgePriceItem,
  listForgePriceSuggestions,
  reviewForgePriceSuggestion,
} from "./price-catalog";
import {
  listForgeSimulations,
  getForgeSimulation,
  createForgeSimulation,
  updateForgeSimulation,
  deleteForgeSimulation,
  convertSimulationToProposal,
} from "./simulations";

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
    acceptAsContract: acceptProposalAsContract,
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
  priceCatalog: {
    listItems: listForgePriceItems,
    createItem: createForgePriceItem,
    updateItem: updateForgePriceItem,
    deleteItem: deleteForgePriceItem,
    listSuggestions: listForgePriceSuggestions,
    reviewSuggestion: reviewForgePriceSuggestion,
  },
  simulations: {
    list: listForgeSimulations,
    get: getForgeSimulation,
    create: createForgeSimulation,
    update: updateForgeSimulation,
    delete: deleteForgeSimulation,
    convertToProposal: convertSimulationToProposal,
  },
};
