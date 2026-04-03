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
import { getStarDistribution } from "./get-distribution";
import { setStarDistribution } from "./set-distribution";
import { setMemberBudget } from "./set-member-budget";

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
  getDistribution: getStarDistribution,
  setDistribution: setStarDistribution,
  setMemberBudget,
};
