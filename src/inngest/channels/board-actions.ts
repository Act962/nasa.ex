import { channel, topic } from "@inngest/realtime";

export const BOARD_ACTIONS_CHANNEL_PREFIX = "board-actions";

export type ActionChangedField = "tag" | "participant";

export const boardActionsChannel = channel(
  (workspaceId: string) => `${BOARD_ACTIONS_CHANNEL_PREFIX}:${workspaceId}`,
)
  .addTopic(
    topic("action-moved").type<{
      actionId: string;
      fromColumnId: string | null;
      toColumnId: string;
      fromWorkspaceId: string | null;
      toWorkspaceId: string;
      movedAt: string;
      source: "workflow";
    }>(),
  )
  .addTopic(
    topic("action-changed").type<{
      actionId: string;
      columnId: string;
      workspaceId: string;
      fields: ActionChangedField[];
      at: string;
      source: "workflow";
    }>(),
  )
  .addTopic(
    topic("action-archived").type<{
      actionId: string;
      columnId: string;
      workspaceId: string;
      at: string;
      source: "workflow";
    }>(),
  )
  .addTopic(
    topic("sub-action-created").type<{
      actionId: string;
      columnId: string;
      workspaceId: string;
      count: number;
      at: string;
      source: "workflow";
    }>(),
  );
