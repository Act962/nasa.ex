import { TrafegoLanding } from "@/features/trafego/components/public/trafego-landing";

interface SearchParams {
  cancelado?: string;
}

export default async function TrafegoPublicPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const { cancelado } = await searchParams;

  return <TrafegoLanding wasCancelled={cancelado === "1"} />;
}
