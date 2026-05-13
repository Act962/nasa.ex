import { boardLeadsChannel, type LeadChangedField } from "@/inngest/channels/board-leads";

type PublishFn = (payload: any) => Promise<unknown>;

const safePublish = async (label: string, fn: () => Promise<unknown>) => {
  try {
    await fn();
  } catch (err) {
    console.error(`[board-realtime] publish ${label} failed`, err);
  }
};

export async function publishLeadMoved(
  publish: PublishFn,
  payload: {
    leadId: string;
    fromTrackingId: string | null;
    toTrackingId: string;
    fromStatusId: string | null;
    toStatusId: string;
    movedAt: string;
  },
) {
  if (!payload.toTrackingId) return;
  const body = { ...payload, source: "workflow" as const };

  await safePublish("lead-moved", () =>
    publish(boardLeadsChannel(payload.toTrackingId)["lead-moved"](body)),
  );

  if (
    payload.fromTrackingId &&
    payload.fromTrackingId !== payload.toTrackingId
  ) {
    await safePublish("lead-moved (source)", () =>
      publish(boardLeadsChannel(payload.fromTrackingId!)["lead-moved"](body)),
    );
  }
}

export async function publishLeadChanged(
  publish: PublishFn,
  payload: {
    leadId: string;
    trackingId: string;
    statusId: string;
    fields: LeadChangedField[];
  },
) {
  if (!payload.trackingId || !payload.statusId || payload.fields.length === 0) {
    return;
  }

  await safePublish("lead-changed", () =>
    publish(
      boardLeadsChannel(payload.trackingId)["lead-changed"]({
        ...payload,
        at: new Date().toISOString(),
        source: "workflow",
      }),
    ),
  );
}

export async function publishLeadClosed(
  publish: PublishFn,
  payload: {
    leadId: string;
    trackingId: string;
    statusId: string;
    outcome: "WON" | "LOST";
  },
) {
  if (!payload.trackingId || !payload.statusId) return;

  await safePublish("lead-closed", () =>
    publish(
      boardLeadsChannel(payload.trackingId)["lead-closed"]({
        ...payload,
        at: new Date().toISOString(),
        source: "workflow",
      }),
    ),
  );
}
