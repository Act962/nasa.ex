import { os } from "@orpc/server";

export const base = os.$context<{ headers: Headers }>().errors({
  BAD_REQUEST: {
    message: "You are being ratee limited",
  },
  NOT_FOUND: {
    message: "Not found",
  },
  FORBIDDEN: {
    message: "This is forbidden",
  },
  UNAUTHORIZED: {
    message: "You are not authorized",
  },
  INTERNAL_SERVER_ERROR: {
    message: "Something went wrong",
  },
});
