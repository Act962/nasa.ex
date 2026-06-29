import { channel, topic } from "@inngest/realtime";

const statusTopic = () =>
  topic("status").type<{
    nodeId: string;
    status: "loading" | "success" | "error";
  }>();

export const WS_MANUAL_TRIGGER_CHANNEL_NAME = "ws-manual-trigger-execution";
export const wsManualTriggerChannel = channel(
  WS_MANUAL_TRIGGER_CHANNEL_NAME,
).addTopic(statusTopic());

export const WS_CREATE_ACTION_CHANNEL_NAME = "ws-create-action-execution";
export const wsCreateActionChannel = channel(
  WS_CREATE_ACTION_CHANNEL_NAME,
).addTopic(statusTopic());

export const WS_MOVE_ACTION_CHANNEL_NAME = "ws-move-action-execution";
export const wsMoveActionChannel = channel(
  WS_MOVE_ACTION_CHANNEL_NAME,
).addTopic(statusTopic());

export const WS_ADD_TAG_CHANNEL_NAME = "ws-add-tag-execution";
export const wsAddTagChannel = channel(WS_ADD_TAG_CHANNEL_NAME).addTopic(
  statusTopic(),
);

export const WS_ADD_PARTICIPANT_CHANNEL_NAME = "ws-add-participant-execution";
export const wsAddParticipantChannel = channel(
  WS_ADD_PARTICIPANT_CHANNEL_NAME,
).addTopic(statusTopic());

export const WS_SET_RESPONSIBLE_CHANNEL_NAME = "ws-set-responsible-execution";
export const wsSetResponsibleChannel = channel(
  WS_SET_RESPONSIBLE_CHANNEL_NAME,
).addTopic(statusTopic());

export const WS_CREATE_SUB_ACTION_CHANNEL_NAME =
  "ws-create-sub-action-execution";
export const wsCreateSubActionChannel = channel(
  WS_CREATE_SUB_ACTION_CHANNEL_NAME,
).addTopic(statusTopic());

export const WS_SEND_MESSAGE_CHANNEL_NAME = "ws-send-message-execution";
export const wsSendMessageChannel = channel(
  WS_SEND_MESSAGE_CHANNEL_NAME,
).addTopic(statusTopic());

export const WS_SEND_EMAIL_CHANNEL_NAME = "ws-send-email-execution";
export const wsSendEmailChannel = channel(WS_SEND_EMAIL_CHANNEL_NAME).addTopic(
  statusTopic(),
);

export const WS_ARCHIVE_ACTION_CHANNEL_NAME = "ws-archive-action-execution";
export const wsArchiveActionChannel = channel(
  WS_ARCHIVE_ACTION_CHANNEL_NAME,
).addTopic(statusTopic());

export const WS_WAIT_CHANNEL_NAME = "ws-wait-execution";
export const wsWaitChannel = channel(WS_WAIT_CHANNEL_NAME).addTopic(
  statusTopic(),
);

export const WS_FILTER_CHANNEL_NAME = "ws-filter-execution";
export const wsFilterChannel = channel(WS_FILTER_CHANNEL_NAME).addTopic(
  statusTopic(),
);
