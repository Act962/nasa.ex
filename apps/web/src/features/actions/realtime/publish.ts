import {
  boardActionsChannel,
  type ActionChangedField,
} from "@/inngest/channels/board-actions";

type PublishFn = (payload: any) => Promise<unknown>;

const safePublish = async (label: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (err) {
    console.error(`[board-realtime] publish ${label} failed`, err);
  }
};

export async function publishActionMoved(
  publish: PublishFn,
  payload: {
    actionId: string;
    fromColumnId: string | null;
    toColumnId: string;
    fromWorkspaceId: string | null;
    toWorkspaceId: string;
    movedAt: string;
  },
) {
  if (!payload.toWorkspaceId) return;
  const body = { ...payload, source: "workflow" as const };

  await safePublish("action-moved", () =>
    publish(boardActionsChannel(payload.toWorkspaceId)["action-moved"](body)),
  );

  if (
    payload.fromWorkspaceId &&
    payload.fromWorkspaceId !== payload.toWorkspaceId
  ) {
    await safePublish("action-moved (source)", () =>
      publish(
        boardActionsChannel(payload.fromWorkspaceId!)["action-moved"](body),
      ),
    );
  }
}

export async function publishActionChanged(
  publish: PublishFn,
  payload: {
    actionId: string;
    columnId: string;
    workspaceId: string;
    fields: ActionChangedField[];
  },
) {
  if (
    !payload.columnId ||
    !payload.workspaceId ||
    payload.fields.length === 0
  ) {
    return;
  }

  await safePublish("action-changed", () =>
    publish(
      boardActionsChannel(payload.workspaceId)["action-changed"]({
        ...payload,
        at: new Date().toISOString(),
        source: "workflow",
      }),
    ),
  );
}

export async function publishActionArchived(
  publish: PublishFn,
  payload: {
    actionId: string;
    columnId: string;
    workspaceId: string;
  },
) {
  if (!payload.columnId || !payload.workspaceId) return;

  await safePublish("action-archived", () =>
    publish(
      boardActionsChannel(payload.workspaceId)["action-archived"]({
        ...payload,
        at: new Date().toISOString(),
        source: "workflow",
      }),
    ),
  );
}

export async function publishSubActionCreated(
  publish: PublishFn,
  payload: {
    actionId: string;
    columnId: string;
    workspaceId: string;
    count: number;
  },
) {
  if (!payload.columnId || !payload.workspaceId || payload.count <= 0) return;

  await safePublish("sub-action-created", () =>
    publish(
      boardActionsChannel(payload.workspaceId)["sub-action-created"]({
        ...payload,
        at: new Date().toISOString(),
        source: "workflow",
      }),
    ),
  );
}
