import { SuccessPolling } from "./success-polling";

interface SearchParams {
  token?: string;
  session_id?: string;
}

/**
 * Página de pós-checkout (`/checkout/sucesso?token=<pendingId>&session_id=...`).
 *
 * O Stripe redireciona pra cá após o pagamento. Como o webhook é assíncrono,
 * a página faz polling no `getPendingPurchase` até detectar `status=PAID` e,
 * idealmente, o `signupToken` gerado.
 */
export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token } = await searchParams;

  return (
    <div className="dark min-h-screen bg-background px-4 py-12 text-foreground">
      <div className="mx-auto max-w-md">
        <SuccessPolling pendingId={token ?? null} />
      </div>
    </div>
  );
}
