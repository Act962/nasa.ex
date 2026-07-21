import { useListActionByWorkspace } from "../../hooks/use-tasks";
import { useActionFilters } from "../../hooks/use-action-filters";
import { useActionTableState } from "../../hooks/use-action-table-state";
import { columns } from "./columns";
import { ActionsTable } from "./table";

interface DataTableProps {
  workspaceId: string;
  /** Presente = tabela escopada às ações desse lead (sheet do lead). */
  leadId?: string;
}

export const DataTable = ({ workspaceId, leadId }: DataTableProps) => {
  const { pagination, setPagination, search, setSearch } = useActionTableState({
    persistInUrl: !leadId,
  });

  const { filters } = useActionFilters();
  const { actions, total } = useListActionByWorkspace({
    workspaceId,
    leadId,
    page: pagination.pageIndex + 1,
    limit: pagination.pageSize,
    participantIds: filters.participantIds,
    tagIds: filters.tagIds,
    projectIds: filters.projectIds,
    dueDateFrom: filters.dueDateFrom,
    dueDateTo: filters.dueDateTo,
    sortBy: filters.sortBy,
    sortOrder: filters.sortOrder,
    isArchived: filters.showArchived,
    title: search,
  });

  return (
    <div className="p-4">
      <ActionsTable
        columns={columns}
        data={actions}
        totalCount={total}
        pagination={pagination}
        onPaginationChange={setPagination}
        search={search}
        onSearchChange={setSearch}
      />
    </div>
  );
};
