"use client";

import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { FolderPlusIcon, WorkflowIcon } from "lucide-react";
import { useParams } from "next/navigation";
import { CreateWorkflowButton } from "./create-workflow";
import { useSuspenseWorkflows } from "@/features/workflows/hooks/use-workflows";
import { useWorkflowFolders } from "@/features/workflows/hooks/use-workflow-folders";
import { FolderGroup } from "@/features/workflows/components/folder-group";
import { FolderCreateDialog } from "@/features/workflows/components/folder-create-dialog";

export function WorkflowContainer() {
  const { trackingId } = useParams<{ trackingId: string }>();
  const [createFolderOpen, setCreateFolderOpen] = useState(false);

  const { data } = useSuspenseWorkflows(trackingId);
  const { data: foldersData } = useWorkflowFolders(trackingId);

  /**
   * Agrupa workflows por folderId. `null` = "Sem pasta".
   * Memoizado pra evitar re-render quando só status de outro workflow muda.
   */
  const grouped = useMemo(() => {
    const byFolder = new Map<
      string | null,
      typeof data.workflows
    >();
    byFolder.set(null, []);
    for (const f of foldersData?.folders ?? []) {
      byFolder.set(f.id, []);
    }
    for (const w of data.workflows) {
      const key = (w as any).folderId ?? null;
      if (!byFolder.has(key)) byFolder.set(null, byFolder.get(null) ?? []);
      const target = byFolder.get(key) ?? byFolder.get(null)!;
      target.push(w);
    }
    return byFolder;
  }, [data.workflows, foldersData?.folders]);

  const folders = foldersData?.folders ?? [];
  const uncategorized = grouped.get(null) ?? [];

  // Empty total
  if (data.workflows.length === 0 && folders.length === 0) {
    return (
      <div className="space-y-2 mb-8">
        <EmptyWorkflows onCreateFolder={() => setCreateFolderOpen(true)} />
        <FolderCreateDialog
          open={createFolderOpen}
          onOpenChange={setCreateFolderOpen}
          trackingId={trackingId}
        />
      </div>
    );
  }

  return (
    <div className="space-y-3 mb-8">
      <div className="flex items-center justify-end gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setCreateFolderOpen(true)}
        >
          <FolderPlusIcon className="size-4" />
          <span className="hidden sm:inline">Nova pasta</span>
        </Button>
      </div>

      {folders.map((f) => (
        <FolderGroup
          key={f.id}
          folderId={f.id}
          folderName={f.name}
          workflowCount={f.workflowCount}
          workflows={grouped.get(f.id) ?? []}
          trackingId={trackingId}
        />
      ))}

      <FolderGroup
        folderId={null}
        folderName="Sem pasta"
        workflowCount={uncategorized.length}
        workflows={uncategorized}
        trackingId={trackingId}
        defaultOpen
      />

      <FolderCreateDialog
        open={createFolderOpen}
        onOpenChange={setCreateFolderOpen}
        trackingId={trackingId}
      />
    </div>
  );
}

function EmptyWorkflows({
  onCreateFolder,
}: {
  onCreateFolder: () => void;
}) {
  return (
    <Empty>
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <WorkflowIcon />
        </EmptyMedia>
        <EmptyTitle>Nenhuma automação encontrada</EmptyTitle>
        <EmptyDescription>
          Crie uma automação ou organize em pastas pra começar.
        </EmptyDescription>
      </EmptyHeader>
      <EmptyContent>
        <div className="flex gap-2">
          <CreateWorkflowButton />
          <Button variant="outline" size="sm" onClick={onCreateFolder}>
            <FolderPlusIcon className="size-4" />
            Nova pasta
          </Button>
        </div>
      </EmptyContent>
    </Empty>
  );
}
