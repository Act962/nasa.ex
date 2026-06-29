"use server";

import { inngest } from "@/inngest/client";
import { getSubscriptionToken } from "@inngest/realtime";
import {
  wsAddParticipantChannel,
  wsAddTagChannel,
  wsArchiveActionChannel,
  wsCreateActionChannel,
  wsCreateSubActionChannel,
  wsFilterChannel,
  wsManualTriggerChannel,
  wsMoveActionChannel,
  wsSendEmailChannel,
  wsSendMessageChannel,
  wsSetResponsibleChannel,
  wsWaitChannel,
} from "@/inngest/channels/workspace";

export async function fetchWsManualTriggerToken() {
  return getSubscriptionToken(inngest, {
    channel: wsManualTriggerChannel(),
    topics: ["status"],
  });
}

export async function fetchWsCreateActionToken() {
  return getSubscriptionToken(inngest, {
    channel: wsCreateActionChannel(),
    topics: ["status"],
  });
}

export async function fetchWsMoveActionToken() {
  return getSubscriptionToken(inngest, {
    channel: wsMoveActionChannel(),
    topics: ["status"],
  });
}

export async function fetchWsAddTagToken() {
  return getSubscriptionToken(inngest, {
    channel: wsAddTagChannel(),
    topics: ["status"],
  });
}

export async function fetchWsAddParticipantToken() {
  return getSubscriptionToken(inngest, {
    channel: wsAddParticipantChannel(),
    topics: ["status"],
  });
}

export async function fetchWsSetResponsibleToken() {
  return getSubscriptionToken(inngest, {
    channel: wsSetResponsibleChannel(),
    topics: ["status"],
  });
}

export async function fetchWsCreateSubActionToken() {
  return getSubscriptionToken(inngest, {
    channel: wsCreateSubActionChannel(),
    topics: ["status"],
  });
}

export async function fetchWsSendMessageToken() {
  return getSubscriptionToken(inngest, {
    channel: wsSendMessageChannel(),
    topics: ["status"],
  });
}

export async function fetchWsSendEmailToken() {
  return getSubscriptionToken(inngest, {
    channel: wsSendEmailChannel(),
    topics: ["status"],
  });
}

export async function fetchWsArchiveActionToken() {
  return getSubscriptionToken(inngest, {
    channel: wsArchiveActionChannel(),
    topics: ["status"],
  });
}

export async function fetchWsWaitToken() {
  return getSubscriptionToken(inngest, {
    channel: wsWaitChannel(),
    topics: ["status"],
  });
}

export async function fetchWsFilterToken() {
  return getSubscriptionToken(inngest, {
    channel: wsFilterChannel(),
    topics: ["status"],
  });
}
