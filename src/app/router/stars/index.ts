import { getStarBalance } from "./get-balance";
import { listStarTransactions } from "./list-transactions";
import { listStarPackages } from "./list-packages";
import { purchaseStarPackage } from "./purchase-package";
import { getAppStarCost } from "./get-app-cost";
import { updateStarAlertConfig } from "./update-alert-config";
import { listPlans } from "./list-plans";
import { createCheckoutSession } from "./create-checkout-session";

export const starsRouter = {
  getBalance: getStarBalance,
  listTransactions: listStarTransactions,
  listPackages: listStarPackages,
  purchasePackage: purchaseStarPackage,
  getAppCost: getAppStarCost,
  updateAlertConfig: updateStarAlertConfig,
  listPlans,
  createCheckoutSession,
};
