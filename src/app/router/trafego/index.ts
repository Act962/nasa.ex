import { listPublicTrafegoPlans } from "./public/list-plans";
import { getPendingTrafegoPurchase } from "./public/get-pending-purchase";
import { getPublicTrafegoConfig } from "./public/get-config";
import { redeemTrafegoPurchase } from "./public/redeem-purchase";
import { captureTrafegoLeadProcedure } from "./public/capture-lead";
import { confirmTrafegoPixPayment } from "./ops/confirm-pix";
import { reconcileTrafegoPix } from "./ops/reconcile-pix";
import { listTrafegoPendingPix } from "./ops/list-pending-pix";
import { getTrafegoLeadSummary } from "./ops/get-lead-summary";
import {
  startTrafegoPhoneVerificationProcedure,
  confirmTrafegoPhoneVerificationProcedure,
  checkTrafegoWhatsappNumberProcedure,
  lookupTrafegoSocialProfileProcedure,
} from "./public/verification";
import { listTrafegoOrders } from "./list-orders";
import { getTrafegoOrder } from "./get-order";
import { getTrafegoOrderPerformance } from "./get-order-performance";
import { updateTrafegoBriefing } from "./update-briefing";
import { activateTrafegoOrder } from "./activate-order";
import {
  addTrafegoCreative,
  removeTrafegoCreative,
  setTrafegoMaterialsProfileLink,
} from "./creatives";
import {
  addTrafegoCopy,
  updateTrafegoCopy,
  setTrafegoCopySelected,
  removeTrafegoCopy,
  suggestTrafegoCopiesProcedure,
} from "./copies";
import {
  getTrafegoRelease,
  addTrafegoReleaseSource,
  removeTrafegoReleaseSource,
  generateTrafegoRelease,
  saveTrafegoRelease,
  updateTrafegoAccessChecklist,
} from "./release";
import { getTrafegoRecommendations } from "./recommendations";
import {
  listTrafegoMessages,
  sendTrafegoMessage,
  markTrafegoMessagesRead,
} from "./support";
import {
  listTrafegoPlansAdmin,
  createTrafegoPlan,
  updateTrafegoPlan,
  toggleTrafegoPlanActive,
  deleteTrafegoPlan,
} from "./admin/plans";
import {
  listTrafegoOrdersAdmin,
  getTrafegoOrderAdmin,
  updateTrafegoOrderStatus,
  assignTrafegoOrder,
  linkTrafegoMetaCampaign,
  unlinkTrafegoMetaCampaign,
  linkTrafegoBroadcast,
  reviewTrafegoCreative,
  replyTrafegoMessageAdmin,
  listTrafegoMessagesAdmin,
} from "./admin/orders";
import {
  getTrafegoSettings,
  updateTrafegoSettings,
  setOrganizationAppScope,
  listTrafegoAgencyOptions,
  provisionTrafegoOperationsTrackingProcedure,
  provisionTrafegoBriefingFormProcedure,
} from "./admin/settings";

export const trafegoRouter = {
  // ── Público (sem auth) ──
  listPublicPlans: listPublicTrafegoPlans,
  getPublicConfig: getPublicTrafegoConfig,
  getPendingPurchase: getPendingTrafegoPurchase,
  redeemPurchase: redeemTrafegoPurchase,
  captureLead: captureTrafegoLeadProcedure,
  verification: {
    startPhone: startTrafegoPhoneVerificationProcedure,
    confirmPhone: confirmTrafegoPhoneVerificationProcedure,
    checkWhatsappNumber: checkTrafegoWhatsappNumberProcedure,
    lookupSocialProfile: lookupTrafegoSocialProfileProcedure,
  },

  // ── Operação (admin do sistema ou participante do tracking) ──
  ops: {
    confirmPix: confirmTrafegoPixPayment,
    reconcilePix: reconcileTrafegoPix,
    listPendingPix: listTrafegoPendingPix,
    getLeadSummary: getTrafegoLeadSummary,
  },

  // ── Painel do cliente ──
  listOrders: listTrafegoOrders,
  getOrder: getTrafegoOrder,
  getOrderPerformance: getTrafegoOrderPerformance,
  updateBriefing: updateTrafegoBriefing,
  activateOrder: activateTrafegoOrder,

  creatives: {
    add: addTrafegoCreative,
    remove: removeTrafegoCreative,
    setProfileLink: setTrafegoMaterialsProfileLink,
  },

  copies: {
    add: addTrafegoCopy,
    update: updateTrafegoCopy,
    setSelected: setTrafegoCopySelected,
    remove: removeTrafegoCopy,
    suggest: suggestTrafegoCopiesProcedure,
  },

  release: {
    get: getTrafegoRelease,
    addSource: addTrafegoReleaseSource,
    removeSource: removeTrafegoReleaseSource,
    generate: generateTrafegoRelease,
    save: saveTrafegoRelease,
  },

  accessChecklist: {
    update: updateTrafegoAccessChecklist,
  },

  recommendations: {
    get: getTrafegoRecommendations,
  },

  support: {
    list: listTrafegoMessages,
    send: sendTrafegoMessage,
    markRead: markTrafegoMessagesRead,
  },

  // ── Equipe NASA ──
  admin: {
    plans: {
      list: listTrafegoPlansAdmin,
      create: createTrafegoPlan,
      update: updateTrafegoPlan,
      toggleActive: toggleTrafegoPlanActive,
      delete: deleteTrafegoPlan,
    },
    orders: {
      list: listTrafegoOrdersAdmin,
      get: getTrafegoOrderAdmin,
      updateStatus: updateTrafegoOrderStatus,
      assign: assignTrafegoOrder,
      linkMetaCampaign: linkTrafegoMetaCampaign,
      unlinkMetaCampaign: unlinkTrafegoMetaCampaign,
      linkBroadcast: linkTrafegoBroadcast,
      reviewCreative: reviewTrafegoCreative,
      listMessages: listTrafegoMessagesAdmin,
      reply: replyTrafegoMessageAdmin,
    },
    settings: {
      get: getTrafegoSettings,
      update: updateTrafegoSettings,
      setOrganizationAppScope,
      listAgencyOptions: listTrafegoAgencyOptions,
      provisionOperationsTracking: provisionTrafegoOperationsTrackingProcedure,
      provisionBriefingForm: provisionTrafegoBriefingFormProcedure,
    },
  },
};
