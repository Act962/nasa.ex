import { Suspense } from "react";
import { PaymentPage } from "@/features/payment";
import { AppPinnedInsightsStrip } from "@/components/app-pinned-insights-strip";
import { PaymentGate } from "@/features/payment/components/access/payment-gate";

// A aba ativa vive em `?tab=` (o Astro lê isso pelo contexto da rota), e quem
// lê query string precisa de um limite de Suspense.
export default function Page() {
  return (
    <PaymentGate>
      <AppPinnedInsightsStrip appModule="payment" />
      <Suspense fallback={null}>
        <PaymentPage />
      </Suspense>
    </PaymentGate>
  );
}
