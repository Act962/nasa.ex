import { getStarBalance } from "./get-balance";
import { listStarTransactions } from "./list-transactions";
import { listStarPackages } from "./list-packages";
import { purchaseStarPackage } from "./purchase-package";
import { getAppStarCost } from "./get-app-cost";
import { updateStarAlertConfig } from "./update-alert-config";
import { listPlans } from "./list-plans";
import { createCheckoutSession } from "./create-checkout-session";
import { listActiveGateways } from "./list-active-gateways";
import { createGatewayCheckout } from "./create-gateway-checkout";
import { createStarsCheckout } from "./create-stars-checkout";
import { getStarsPricing } from "./get-stars-pricing";
import { getStarDistribution } from "./get-distribution";
import { setStarDistribution } from "./set-distribution";
import { setMemberBudget } from "./set-member-budget";
import { getStarsUsageBreakdown } from "./get-usage-breakdown";
import { getStarsDailyConsumption } from "./get-daily-consumption";
import { listStarActionCosts } from "./list-action-costs";

export const starsRouter = {
  getBalance: getStarBalance,
  listTransactions: listStarTransactions,
  listPackages: listStarPackages,
  purchasePackage: purchaseStarPackage,
  getAppCost: getAppStarCost,
  updateAlertConfig: updateStarAlertConfig,
  listPlans,
  createCheckoutSession,
  listActiveGateways,
  createGatewayCheckout,
  createStarsCheckout,
  getStarsPricing,
  getDistribution: getStarDistribution,
  setDistribution: setStarDistribution,
  setMemberBudget,
  getUsageBreakdown: getStarsUsageBreakdown,
  getDailyConsumption: getStarsDailyConsumption,
  listActionCosts: listStarActionCosts,
};
