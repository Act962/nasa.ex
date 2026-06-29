export interface CreateActionWithAiProps {
  workspaceId?: string;
  trackingId?: string;
}

export interface ViewActionButtonProps {
  title: string;
  id: string;
  onView: (id: string) => void;
}

export interface MessageTextPartProps {
  text: string;
  isStreaming: boolean;
  onViewAction: (id: string) => void;
}

export interface ContextSelectorProps {
  workspaces: Array<{ id: string; name: string; icon?: string | null }>;
  columns: Array<{ id: string; name: string; color: string | null }>;
  selectedWorkspaceId: string;
  selectedColumnId: string;
  selectedWorkspaceName?: string;
  selectedColumnName?: string;
  onSelectWorkspace: (id: string) => void;
  onSelectColumn: (workspaceId: string, columnId: string) => void;
}
