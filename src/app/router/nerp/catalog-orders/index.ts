import { sendCatalogOrderQuote } from "./send-quote";
import { confirmCatalogOrderPaymentManually } from "./confirm-payment";

export const nerpCatalogOrdersRouter = {
  sendQuote: sendCatalogOrderQuote,
  confirmPayment: confirmCatalogOrderPaymentManually,
};
