import { useSuspenseColumnsByWorkspace } from "@/features/workspace/hooks/use-workspace";
import { DragDropContext, Droppable, Draggable } from "@hello-pangea/dnd";
import { useState } from "react";
import { WorkspaceColumn } from "./status-column";

interface Props {
  workspaceId: string;
}

export const DataKanban = ({ workspaceId }: Props) => {
  const { data } = useSuspenseColumnsByWorkspace(workspaceId);

  const [columns, setColumns] = useState(data.columns);

  return (
    <DragDropContext onDragEnd={() => {}}>
      <div className="grid grid-rows-[1fr_auto] h-full">
        <ol className="flex gap-x-3 overflow-x-auto">
          {columns.map((board) => {
            return (
              <WorkspaceColumn
                key={board.id}
                {...board}
                workspaceId={workspaceId}
              />
            );
          })}

          <div className="shrink-0 w-1" />
        </ol>
      </div>
    </DragDropContext>
  );
};
