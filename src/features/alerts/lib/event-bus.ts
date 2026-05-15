/**
 * Event bus in-process — pub/sub server-side síncrono.
 *
 * Cada mutação do app publica eventos tipados (ex: `lead.status_changed`);
 * o alert engine se inscreve uma vez no boot e chama `dispatchAlert`.
 *
 * Por que in-process e não Inngest?
 *   - sub-ms latência vs ~100ms de Inngest events;
 *   - mantém a mutação que disparou e o alerta no mesmo trace;
 *   - quando o fan-out é grande (>20 destinatários), o engine delega
 *     pro Inngest internamente (alert.fanout) — não é responsabilidade
 *     do bus.
 *
 * Singleton via `globalThis` pra sobreviver a hot-reload do Next dev.
 */

type Handler<P = unknown> = (payload: P) => void | Promise<void>;

class EventBusImpl {
  private handlers = new Map<string, Set<Handler<unknown>>>();

  subscribe<P = unknown>(eventType: string, handler: Handler<P>): () => void {
    let set = this.handlers.get(eventType);
    if (!set) {
      set = new Set();
      this.handlers.set(eventType, set);
    }
    set.add(handler as Handler<unknown>);
    return () => {
      set?.delete(handler as Handler<unknown>);
    };
  }

  async publish<P = unknown>(eventType: string, payload: P): Promise<void> {
    const set = this.handlers.get(eventType);
    if (!set || set.size === 0) return;
    // Fire-and-await: erros de subscribers não devem propagar pra mutação
    // que publicou (alert lateral não pode quebrar fluxo principal).
    await Promise.all(
      Array.from(set).map(async (h) => {
        try {
          await h(payload);
        } catch (err) {
          // eslint-disable-next-line no-console
          console.error(
            `[event-bus] subscriber de "${eventType}" falhou:`,
            err,
          );
        }
      }),
    );
  }
}

// Singleton resistente a hot-reload (Next dev re-importa módulos).
const globalForBus = globalThis as unknown as {
  __nasaEventBus?: EventBusImpl;
};

export const eventBus: EventBusImpl =
  globalForBus.__nasaEventBus ?? new EventBusImpl();

if (process.env.NODE_ENV !== "production") {
  globalForBus.__nasaEventBus = eventBus;
}
