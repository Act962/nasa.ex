import { PaymentPage } from "@/features/payment";
import { AppPinnedInsightsStrip } from "@/components/app-pinned-insights-strip";
import { PaymentGate } from "@/features/payment/components/access/payment-gate";

export default function Page() {
  return (
    <PaymentGate>
      <AppPinnedInsightsStrip appModule="payment" />
      <PaymentPage />
    </PaymentGate>
  );
}
