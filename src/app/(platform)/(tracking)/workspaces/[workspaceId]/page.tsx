import { NavWorkspace } from "@/features/workspace/components/nav-workspace";
import { WorkspaceBoard } from "@/features/workspace/components/workspace";
import { client } from "@/lib/orpc";

interface Props {
  params: Promise<{ workspaceId: string }>;
}

export default async function Page({ params }: Props) {
  const { workspaceId } = await params;

  const { workspace } = await client.workspace.get({
    workspaceId,
  });

  return (
    <>
      <NavWorkspace workspaceId={workspaceId} title={workspace.name} />
      <WorkspaceBoard workspaceId={workspaceId} />
    </>
  );
}
