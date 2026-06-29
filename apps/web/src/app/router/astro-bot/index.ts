import { getBotConfig } from "./config/get";
import { upsertBotConfig } from "./config/upsert";
import { startBindingOtp } from "./binding/start-otp";
import { verifyBindingOtp } from "./binding/verify-otp";
import { listBindings } from "./binding/list";
import { revokeBinding } from "./binding/revoke";
import { resetBindingPin } from "./binding/reset-pin";

export const astroBotRouter = {
  config: {
    get: getBotConfig,
    upsert: upsertBotConfig,
  },
  binding: {
    startOtp: startBindingOtp,
    verifyOtp: verifyBindingOtp,
    list: listBindings,
    revoke: revokeBinding,
    resetPin: resetBindingPin,
  },
};
