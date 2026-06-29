import { ClientPortalPage } from "@/features/client-portal/components/client-portal-page";

export default async function Page({ params }: { params: Promise<{ clientCode: string }> }) {
  const { clientCode } = await params;
  return <ClientPortalPage clientCode={clientCode} />;
}
