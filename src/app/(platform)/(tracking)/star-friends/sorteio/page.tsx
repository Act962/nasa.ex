import { CampaignLiveDraw } from "@/features/star-friends/components/campaign-live-draw";

export default async function Page({ searchParams }: { searchParams: Promise<{ modo?: string }> }) {
  const { modo } = await searchParams;
  return <CampaignLiveDraw isSimulation={modo === "simulacao"} />;
}
