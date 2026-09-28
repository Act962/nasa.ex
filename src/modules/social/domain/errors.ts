import { DomainError } from "@/modules/shared/domain/domain-error";

export const SocialErrorCode = {
  CHANNEL_NOT_CONNECTED: "CHANNEL_NOT_CONNECTED",
  CHANNEL_NEEDS_RECONNECT: "CHANNEL_NEEDS_RECONNECT",
  CHANNEL_ALREADY_TAKEN: "CHANNEL_ALREADY_TAKEN",
  AUTOMATION_NOT_FOUND: "AUTOMATION_NOT_FOUND",
  AUTOMATION_INCOMPLETE: "AUTOMATION_INCOMPLETE",
  INVALID_CREDENTIALS: "INVALID_CREDENTIALS",
  INVALID_STEP_CONFIG: "INVALID_STEP_CONFIG",
} as const;

export class ChannelNotConnectedError extends DomainError {
  constructor() {
    super(
      SocialErrorCode.CHANNEL_NOT_CONNECTED,
      "Nenhuma conta conectada nesta organização.",
    );
  }
}

export class ChannelNeedsReconnectError extends DomainError {
  constructor(reason?: string) {
    super(
      SocialErrorCode.CHANNEL_NEEDS_RECONNECT,
      "A conexão com a conta expirou. Reconecte para voltar a responder.",
      reason ? { reason } : undefined,
    );
  }
}

export class ChannelAlreadyTakenError extends DomainError {
  constructor() {
    super(
      SocialErrorCode.CHANNEL_ALREADY_TAKEN,
      "Esta conta já está conectada em outra organização.",
    );
  }
}

export class AutomationNotFoundError extends DomainError {
  constructor() {
    super(SocialErrorCode.AUTOMATION_NOT_FOUND, "Automação não encontrada.");
  }
}

/** Faltou peça para ativar — a mensagem diz exatamente o que falta. */
export class AutomationIncompleteError extends DomainError {
  constructor(missing: string) {
    super(SocialErrorCode.AUTOMATION_INCOMPLETE, missing);
  }
}

export class InvalidCredentialsError extends DomainError {
  constructor(message = "Credenciais incompletas ou inválidas.") {
    super(SocialErrorCode.INVALID_CREDENTIALS, message);
  }
}

export class InvalidStepConfigError extends DomainError {
  constructor(message: string) {
    super(SocialErrorCode.INVALID_STEP_CONFIG, message);
  }
}
