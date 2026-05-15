import "server-only";

/**
 * Event Subscribers — wire entre o `eventBus` (publicado pelas mutações)
 * e o `alert-engine` (consome regras + cria notifications + Pusher).
 *
 * Mutações chamam `eventBus.publish("lead.status_changed", payload)`;
 * aqui escutamos e delegamos pro `dispatchAlert`. Registrar 1x por processo
 * via importação no boot (instrumentation.ts).
 *
 * Por que separado das mutações?
 *   - Zero acoplamento: mutações não importam alert-engine.
 *   - Fácil desligar/ligar tipos de evento sem mexer em cada handler.
 *   - Tipos de payload validados pelo catálogo no momento do dispatch.
 */

import { eventBus } from "./event-bus";
import { dispatchAlert } from "./alert-engine";
import { ALERT_CATALOG } from "./alert-catalog";

let registered = false;

export function registerAlertSubscribers(): void {
  if (registered) return;
  registered = true;

  // Pra cada evento do catálogo, registra um subscriber genérico que delega
  // pro engine. Engine valida payload via Zod schema da entrada.
  for (const def of ALERT_CATALOG) {
    eventBus.subscribe(def.key, async (payload) => {
      try {
        await dispatchAlert(def.key, payload as Record<string, unknown>);
      } catch (err) {
        // Falha em subscriber NÃO deve propagar pra mutação que publicou.
        // O event-bus já captura, mas reforçamos com try local.
        // eslint-disable-next-line no-console
        console.error(`[alert-subscribers] dispatch ${def.key} falhou:`, err);
      }
    });
  }

  // eslint-disable-next-line no-console
  console.log(`[alert-subscribers] registrados ${ALERT_CATALOG.length} subscribers`);
}
