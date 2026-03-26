import { ActionsViewSwitcher } from "@/features/actions/components/actions-view-switcher";

interface Props {
  workspaceId: string;
}

export function WorkspaceBoard({ workspaceId }: Props) {
  return (
    <div className="h-full w-full relative overflow-x-auto scroll-cols-tracking">
      <ActionsViewSwitcher workspaceId={workspaceId} />
    </div>
  );
}
