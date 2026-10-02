import { HeaderTracking } from "@/features/leads/components/header-tracking";
import { LinnkerEditor } from "@/features/linnker/components/linnker-editor";
import { LINNKER_COMMAND_EXAMPLES } from "@/features/linnker/lib/linnker-command-examples";

interface Props {
  params: Promise<{ pageId: string }>;
}

export default async function Page({ params }: Props) {
  const { pageId } = await params;

  return (
    <div className="h-full w-full">
      <HeaderTracking
        title="Linnker"
        isTitleHidden
        astroCommand={{ examples: LINNKER_COMMAND_EXAMPLES, isHiddenOnMobile: true }}
      />
      <div className="mx-auto md:px-10">
        <LinnkerEditor pageId={pageId} />
      </div>
    </div>
  );
}
