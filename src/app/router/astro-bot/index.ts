import { getBotConfig } from "./config/get";
import { upsertBotConfig } from "./config/upsert";
import { createBinding } from "./binding/create";
import { listBindings } from "./binding/list";
import { revokeBinding } from "./binding/revoke";

// Procedures de OTP/PIN (binding/start-otp, binding/verify-otp,
// binding/reset-pin) foram DESATIVADAS no fluxo simplificado — os arquivos
// permanecem, mas não são mais registrados aqui.
export const astroBotRouter = {
  config: {
    get: getBotConfig,
    upsert: upsertBotConfig,
  },
  binding: {
    create: createBinding,
    list: listBindings,
    revoke: revokeBinding,
  },
};
