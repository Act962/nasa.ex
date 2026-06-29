/**
 * Portas (interfaces) da camada de realtime.
 *
 * O domínio depende destes contratos, nunca de uma lib concreta (Pusher,
 * Ably, Inngest...). A implementação concreta é plugada no composition root
 * (`src/lib/realtime/index.ts`). Trocar de lib = trocar o adapter lá, sem
 * mexer em nenhum domínio. (Dependency Inversion + Interface Segregation.)
 */

/** Lado servidor: publica um evento num canal. */
export interface RealtimePublisher {
  publish(channel: string, event: string, payload: unknown): Promise<void>;
}

/** Assinatura ativa de um canal no client. */
export interface RealtimeChannelSubscription {
  bind(event: string, handler: (data: unknown) => void): void;
  unbindAll(): void;
  unsubscribe(): void;
}

/** Lado cliente: assina um canal. */
export interface RealtimeSubscriber {
  subscribe(channel: string): RealtimeChannelSubscription;
}

/**
 * Autoriza (ou não) que um usuário assine um canal privado. Cada domínio que
 * expõe um canal privado registra o seu authorizer em `channel-authorizers.ts`
 * — assim o endpoint de auth não vira um `switch` gigante (Open/Closed).
 */
export interface ChannelAuthorizer {
  /** true se este authorizer é o responsável por validar este canal. */
  matches(channel: string): boolean;
  /** true se `userId` pode assinar `channel`. */
  authorize(channel: string, userId: string): Promise<boolean>;
}
