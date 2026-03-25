import { ActionsViewSwitcher } from "@/features/actions/components/actions-view-switcher";

interface Props {
  workspaceId: string;
}

export function WorkspaceBoard({ workspaceId }: Props) {
  return (
    <div className="h-full w-full p-4">
      <ActionsViewSwitcher workspaceId={workspaceId} />
    </div>
  );
}
