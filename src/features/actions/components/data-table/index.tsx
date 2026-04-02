import { parseAsInteger, useQueryStates } from "nuqs";
import { useListActionByWorkspace } from "../../hooks/use-tasks";
import { useActionFilters } from "../../hooks/use-action-filters";
import { columns } from "./columns";
import { ActionsTable } from "./table";

interface DataTableProps {
  workspaceId: string;
}

export const DataTable = ({ workspaceId }: DataTableProps) => {
  const [pagination] = useQueryStates({
    pageIndex: parseAsInteger.withDefault(0),
    pageSize: parseAsInteger.withDefault(20),
  });
  const { filters } = useActionFilters();
  const { actions, total } = useListActionByWorkspace({
    workspaceId,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    participantIds: filters.participantIds,
    tagIds: filters.tagIds,
    dueDateFrom: filters.dueDateFrom,
    dueDateTo: filters.dueDateTo,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    isArchived: filters.showArchived,
  });

  return (
    <div className="p-4">
      <ActionsTable columns={columns} data={actions} totalCount={total} />
    </div>
  );
};
