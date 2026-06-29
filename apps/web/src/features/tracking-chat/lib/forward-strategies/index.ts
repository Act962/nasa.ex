import z from "zod";
import type { ForwardPayload } from "./build-payload";
import type { ForwardContext, ForwardedMessage } from "./types";
import { contactSchema, contactStrategy } from "./contact";
import { locationSchema, locationStrategy } from "./location";
import { mediaSchema, mediaStrategy } from "./media";
import { textSchema, textStrategy } from "./text";

export { contactStrategy, locationStrategy, mediaStrategy, textStrategy };

export const forwardPayloadSchema = z.discriminatedUnion("kind", [
  textSchema,
  mediaSchema,
  contactSchema,
  locationSchema,
]);

export function dispatchForward(
  payload: ForwardPayload,
  ctx: ForwardContext,
): Promise<ForwardedMessage> {
  switch (payload.kind) {
    case "text":
      return textStrategy.execute(payload, ctx);
    case "media":
      return mediaStrategy.execute(payload, ctx);
    case "contact":
      return contactStrategy.execute(payload, ctx);
    case "location":
      return locationStrategy.execute(payload, ctx);
  }
}
