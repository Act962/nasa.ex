import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { LinnkerEditor } from "@/features/linnker/components/linnker-editor";

interface Props {
  params: Promise<{ pageId: string }>;
}

export default async function Page({ params }: Props) {
  const { pageId } = await params;

  return (
    <div className="h-full w-full">
      <HeaderTracking />
      <div className="mx-auto md:px-10">
        <LinnkerEditor pageId={pageId} />
      </div>
    </div>
  );
}
