import { AuthenticatedSuccessPolling } from "./authenticated-success-polling";

interface SearchParams {
  pendingId?: string;
  session_id?: string;
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { pendingId } = await searchParams;

  return (
    <div className="min-h-[60vh] flex items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <AuthenticatedSuccessPolling pendingId={pendingId ?? null} />
      </div>
    </div>
  );
}
