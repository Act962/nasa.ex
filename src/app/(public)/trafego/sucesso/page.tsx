import { TrafegoSuccessPolling } from "@/features/trafego/components/public/success-polling";

interface SearchParams {
  token?: string;
  session_id?: string;
}

/**
 * Pós-checkout (`/trafego/sucesso?token=<pendingId>`). O webhook do Stripe é
 * assíncrono, então a página faz polling até o pagamento ser confirmado e o
 * token de ativação existir.
 */
export default async function TrafegoSuccessPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { token, session_id: checkoutSessionId } = await searchParams;

  return (
    <div className="px-4 py-12">
      <div className="mx-auto max-w-md">
        <TrafegoSuccessPolling
          pendingId={token ?? null}
          checkoutSessionId={checkoutSessionId ?? null}
        />
      </div>
    </div>
  );
}
