import { requireAdminSession } from "@/features/admin/lib/admin-utils";
import { PaymentsManager } from "@/features/admin/components/payments/payments-manager";

export default async function AdminPaymentsPage() {
  await requireAdminSession();
  return (
    <div className="p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Gateways de Pagamento</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Configure Stripe, Asaas e outros provedores para processar pagamentos de Stars e planos.
        </p>
      </div>
      <PaymentsManager />
    </div>
  );
}
