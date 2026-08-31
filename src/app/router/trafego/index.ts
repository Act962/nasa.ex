import { listPublicTrafegoPlans } from "./public/list-plans";
import { getPendingTrafegoPurchase } from "./public/get-pending-purchase";
import { redeemTrafegoPurchase } from "./public/redeem-purchase";
import { listTrafegoOrders } from "./list-orders";
import { getTrafegoOrder } from "./get-order";
import { getTrafegoOrderPerformance } from "./get-order-performance";
import { updateTrafegoBriefing } from "./update-briefing";
import { activateTrafegoOrder } from "./activate-order";
import { addTrafegoCreative, removeTrafegoCreative } from "./creatives";
import {
  addTrafegoCopy,
  updateTrafegoCopy,
  setTrafegoCopySelected,
  removeTrafegoCopy,
} from "./copies";
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
  linkTrafegoBroadcast,
  reviewTrafegoCreative,
  replyTrafegoMessageAdmin,
  listTrafegoMessagesAdmin,
} from "./admin/orders";
import {
  getTrafegoSettings,
  updateTrafegoSettings,
  setOrganizationAppScope,
} from "./admin/settings";

export const trafegoRouter = {
  // ── Público (sem auth) ──
  listPublicPlans: listPublicTrafegoPlans,
  getPendingPurchase: getPendingTrafegoPurchase,
  redeemPurchase: redeemTrafegoPurchase,

  // ── Painel do cliente ──
  listOrders: listTrafegoOrders,
  getOrder: getTrafegoOrder,
  getOrderPerformance: getTrafegoOrderPerformance,
  updateBriefing: updateTrafegoBriefing,
  activateOrder: activateTrafegoOrder,

  creatives: {
    add: addTrafegoCreative,
    remove: removeTrafegoCreative,
  },

  copies: {
    add: addTrafegoCopy,
    update: updateTrafegoCopy,
    setSelected: setTrafegoCopySelected,
    remove: removeTrafegoCopy,
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
      linkBroadcast: linkTrafegoBroadcast,
      reviewCreative: reviewTrafegoCreative,
      listMessages: listTrafegoMessagesAdmin,
      reply: replyTrafegoMessageAdmin,
    },
    settings: {
      get: getTrafegoSettings,
      update: updateTrafegoSettings,
      setOrganizationAppScope,
    },
  },
};
