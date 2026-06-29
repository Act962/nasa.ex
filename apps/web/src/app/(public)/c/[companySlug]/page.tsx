import { CompanyCatalog } from "@/features/nasa-route/components/public/company-catalog";

interface Params {
  companySlug: string;
}

export default async function Page({ params }: { params: Promise<Params> }) {
  const { companySlug } = await params;
  return <CompanyCatalog companySlug={companySlug} />;
}
