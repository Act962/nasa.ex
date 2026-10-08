import { ClientRecordsPage } from "@/features/form-records/components/client-records-page";

export default async function Page({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  return <ClientRecordsPage token={token} />;
}
