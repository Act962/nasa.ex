import { PaymentPage } from "@/features/payment";
import { AppPinnedInsightsStrip } from "@/components/app-pinned-insights-strip";

export default function Page() {
  return (
    <>
      <AppPinnedInsightsStrip appModule="payment" />
      <PaymentPage />
    </>
  );
}
