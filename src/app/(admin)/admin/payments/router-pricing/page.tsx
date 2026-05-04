import { requireAdminSession } from "@/lib/admin-utils";
import { RouterPricingForm } from "./router-pricing-form";

export default async function AdminRouterPricingPage() {
  await requireAdminSession();
  return (
    <div className="p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">
          Cotação STAR · Checkout público (Router)
        </h1>
        <p className="text-zinc-400 text-sm mt-1">
          Define quanto vale 1 ★ em reais quando alunos sem conta compram cursos
          direto pelo Stripe. Atualize manualmente conforme oscilação do dólar
          ou estratégia de preço.
        </p>
      </div>
      <RouterPricingForm />
    </div>
  );
}
