import { redirect } from "next/navigation";

/** O Kit da Marca virou aba do Planner; o endereço antigo segue valendo para links já enviados. */
export default async function NasaPlannerBrandKitPage({ searchParams }: { searchParams: Promise<{ org?: string }> }) {
  const { org } = await searchParams;
  redirect(org ? `/nasa-planner?tab=kit&org=${encodeURIComponent(org)}` : "/nasa-planner?tab=kit");
}
