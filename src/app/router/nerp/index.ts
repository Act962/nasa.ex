import { getNerpConnectionStatus } from "./get-connection-status";
import { disconnectNerp } from "./disconnect";
import { nerpOrgRouter } from "./org";
import { nerpProductsRouter } from "./products";
import { nerpCategoriesRouter } from "./categories";
import { nerpCatalogSettingsRouter } from "./catalog-settings";
import { nerpStocksRouter } from "./stocks";
import { nerpCustomerRouter } from "./customer";
import { nerpSalesRouter } from "./sales";
import { nerpDashboardRouter } from "./dashboard";

// Módulo `checkout` removido: nerp não expõe CRUD de checkout (apenas
// `checkout.purchase` / `purchase-assas`, que têm semântica de "fechar pedido").
// Quando NASA precisar disparar uma compra, expor `nerp.checkout.purchase` aqui.
export const nerpRouter = {
  getConnectionStatus: getNerpConnectionStatus,
  disconnect: disconnectNerp,
  org: nerpOrgRouter,
  products: nerpProductsRouter,
  categories: nerpCategoriesRouter,
  catalogSettings: nerpCatalogSettingsRouter,
  stocks: nerpStocksRouter,
  customer: nerpCustomerRouter,
  sales: nerpSalesRouter,
  dashboard: nerpDashboardRouter,
};
