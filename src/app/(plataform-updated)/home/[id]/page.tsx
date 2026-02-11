import { ToolDetail } from "@/features/plataform-updated/components/ToolDetail";

interface PageProps {
  params: Promise<{ id: string }>;
}
export default async function Page({ params }: PageProps) {
  const { id } = await params;

  return (
    <div className="rocket-cursor">
      <ToolDetail id={id} />
    </div>
  );
}
