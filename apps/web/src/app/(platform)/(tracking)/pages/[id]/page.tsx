import { PagesBuilder } from "@/features/pages/components/builder/builder";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <PagesBuilder pageId={id} />;
}
