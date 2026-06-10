import "server-only";
import prisma from "@/lib/prisma";
import { WhatsAppProvider } from "@/generated/prisma/enums";
import {
  decryptStoredMetaCredentialsPartial,
  MetaCredentialsMissingError,
} from "./providers/meta-credentials";

/**
 * Cache in-process do mapeamento `phone_number_id → WhatsAppInstance`
 * usado pelo webhook oficial da Meta (`/api/chat/webhook/official`).
 *
 * Por que existe (Fase 5):
 *   - O webhook Meta entrega o `phone_number_id` em
 *     `entry[].changes[].value.metadata.phone_number_id`.
 *   - O `metaPhoneNumberId` em `WhatsAppInstance` é **cifrado** com IV
 *     randômico (AES-256-GCM), então `where: { metaPhoneNumberId: cipher }`
 *     jamais bate. O lookup precisa ser scan + decrypt.
 *   - Pra evitar o scan em cada POST (hot path com vários eventos por
 *     minuto), cacheamos o resultado por TTL curto (30s) — mesma janela do
 *     `getCachedTrackingContext` pra coerência operacional.
 *
 * Por que cache in-process (e não Redis):
 *   - Universo esperado de instâncias `META_CLOUD` é pequeno (dezenas/
 *     baixas centenas no 1º ano de adoção).
 *   - Scan + decrypt cabem em < 20 ms no cold miss; sub-millisegundo no
 *     hit.
 *   - Sem dependência de infra adicional. Multi-instância é OK — cada
 *     processo manterá seu próprio map; o staleness é limitado pelo TTL.
 *   - Quando passar de ~500 instâncias `META_CLOUD` ativas ou p95 de cold
 *     miss subir, migrar pra coluna `metaPhoneNumberIdHash` (SHA-256
 *     não-cifrado, indexada) — plano descrito em
 *     `docs/whatsapp-oficial-overview.md` §6 (Roadmap Fase 5).
 *
 * Cache misses são logados com `count` de instâncias varridas e duração
 * total, pra dar sinal pra decidir a migração futura.
 */

const TTL_MS = 30_000;
/** Cap defensivo. Cache em runtime real fica em < 100 entradas (1 por
 *  tracking META_CLOUD ativo); um cap de 5k cobre 50x esse cenário e
 *  bloqueia DoS por inflar o map com `phone_number_id` aleatórios. */
const MAX_ENTRIES = 5_000;

interface MetaInstanceCacheEntry {
  result: ResolvedMetaInstance;
  expiresAt: number;
}

export interface ResolvedMetaInstance {
  readonly instanceId: string;
  readonly trackingId: string;
  readonly organizationId: string;
  readonly accessToken: string;
  readonly phoneNumberId: string;
  /**
   * `null` quando a instância foi provisionada via Embedded Signup (Fase 7) —
   * o caller deve cair pro `META_APP_SECRET` global. Continuar com `null`
   * sem fallback é um erro de configuração e o webhook responde 401.
   */
  readonly appSecret: string | null;
  /** `null` em instâncias Embedded Signup — caller cai pro `META_VERIFY_TOKEN_GLOBAL`. */
  readonly verifyToken: string | null;
  readonly businessAccountId: string | null;
}

/**
 * Decisão de design (resposta a review adversarial):
 *  - **Só cachear hits.** Misses (`phone_number_id` desconhecido) não
 *    entram no map, pra evitar DoS por memory exhaustion: atacante
 *    poderia enviar POSTs com IDs aleatórios distintos e inflar o map
 *    até OOM (HMAC só valida DEPOIS do lookup — então requests não
 *    autenticados pagam o custo). A contrapartida: misses verdadeiros
 *    (ex: instance recém-criada cujo webhook chega antes do operador
 *    completar credenciais) refazem o scan + decrypt a cada POST.
 *    Aceitável porque misses verdadeiros são raros e o scan custa
 *    ~10-20ms.
 *  - **Cap defensivo de 5k entradas.** Quando excede, faz sweep: limpa
 *    todas as entradas expiradas; se ainda passar do cap, descarta a
 *    mais velha (LRU naive — `Map` mantém ordem de inserção).
 */
const cache = new Map<string, MetaInstanceCacheEntry>();

/**
 * Resolve `phone_number_id` Meta → `WhatsAppInstance` + credenciais
 * decifradas. Retorna `null` quando:
 *  - Não existe instância `META_CLOUD` com esse `phone_number_id`, OU
 *  - A instância existe mas credenciais Meta estão incompletas/corrompidas.
 *
 * NÃO cacheia misses (ver decisão de design no comentário acima).
 */
export async function getCachedTrackingByMetaPhoneNumberId(
  phoneNumberId: string,
): Promise<ResolvedMetaInstance | null> {
  const now = Date.now();
  const cached = cache.get(phoneNumberId);
  if (cached && cached.expiresAt > now) {
    return cached.result;
  }
  // Hit expirado: tira do map pra liberar a chave (LRU naive abaixo
  // depende de ordem de inserção).
  if (cached) cache.delete(phoneNumberId);

  const started = now;
  const candidates = await prisma.whatsAppInstance.findMany({
    where: { provider: WhatsAppProvider.META_CLOUD },
    select: {
      id: true,
      trackingId: true,
      organizationId: true,
      metaAccessToken: true,
      metaPhoneNumberId: true,
      metaAppSecret: true,
      metaVerifyToken: true,
      metaBusinessAccountId: true,
    },
  });

  let resolved: ResolvedMetaInstance | null = null;
  for (const candidate of candidates) {
    // Skip silencioso de instâncias com credenciais ESSENCIAIS ausentes
    // (accessToken/phoneNumberId) — operador ainda não completou o
    // provisionamento. `metaAppSecret`/`metaVerifyToken` PODEM estar
    // ausentes (Fase 7 Embedded Signup grava NULL — fallback global).
    if (!candidate.metaAccessToken || !candidate.metaPhoneNumberId) {
      continue;
    }
    try {
      const plain = decryptStoredMetaCredentialsPartial({
        metaAccessToken: candidate.metaAccessToken,
        metaPhoneNumberId: candidate.metaPhoneNumberId,
        metaAppSecret: candidate.metaAppSecret,
        metaVerifyToken: candidate.metaVerifyToken,
        metaBusinessAccountId: candidate.metaBusinessAccountId,
      });
      if (plain.phoneNumberId === phoneNumberId) {
        resolved = {
          instanceId: candidate.id,
          trackingId: candidate.trackingId,
          organizationId: candidate.organizationId,
          accessToken: plain.accessToken,
          phoneNumberId: plain.phoneNumberId,
          appSecret: plain.appSecret,
          verifyToken: plain.verifyToken,
          businessAccountId: plain.businessAccountId,
        };
        break;
      }
    } catch (error) {
      if (error instanceof MetaCredentialsMissingError) {
        // Defensive — shouldn't happen porque o early-return acima
        // cobre, mas é só pra robustez.
        continue;
      }
      // Provavelmente `AI_SECRETS_KEY` rotacionou sem re-encriptar essa
      // instância. Loga (operador vai querer saber) e segue.
      console.error(
        "[meta-phone-lookup] decrypt_failed",
        { instanceId: candidate.id },
        error,
      );
    }
  }

  const elapsedMs = Date.now() - started;

  // Só cacheia hits — misses ficam fora pra não permitir cache flooding
  // por requests não autenticados (HMAC só valida depois desta função).
  if (resolved) {
    cache.set(phoneNumberId, { result: resolved, expiresAt: now + TTL_MS });
    sweepIfFull();
  }

  // Sinal estruturado pra decidir migrar pra coluna hash quando escalar.
  // Só loga no cold miss (cache hit não conta). Não usa `phoneNumberId`
  // do request pra evitar log flooding: atacante pode mandar IDs
  // aleatórios distintos pra inflar logs. Vai só count + duração.
  console.log("[meta-phone-lookup] cold_miss", {
    candidates: candidates.length,
    matched: resolved !== null,
    elapsedMs,
  });

  return resolved;
}

/**
 * Quando o cache cresce além do cap, primeiro tenta limpar todas as
 * entradas expiradas (sweep). Se ainda assim passar do cap, descarta a
 * mais antiga (FIFO via ordem de inserção do `Map`). Pragmático — sem
 * dependência externa, sem trabalho extra por hit.
 */
function sweepIfFull(): void {
  if (cache.size <= MAX_ENTRIES) return;
  const now = Date.now();
  for (const [key, entry] of cache) {
    if (entry.expiresAt <= now) cache.delete(key);
    if (cache.size <= MAX_ENTRIES) return;
  }
  // Sweep não foi suficiente — descarta a mais antiga uma a uma.
  while (cache.size > MAX_ENTRIES) {
    const firstKey = cache.keys().next().value;
    if (firstKey === undefined) break;
    cache.delete(firstKey);
  }
}

/**
 * Invalida explicitamente uma entrada — chamar quando o admin altera
 * `metaPhoneNumberId` da instância. Sem isso, o webhook pode continuar
 * roteando pro número antigo por até TTL_MS.
 */
export function invalidateMetaPhoneNumberIdLookup(phoneNumberId: string): void {
  cache.delete(phoneNumberId);
}

/**
 * Quando o admin altera o `phoneNumberId` ele provavelmente não sabe o
 * valor antigo (e nem nós, sem decifrar). Esse helper limpa o cache
 * inteiro — é seguro porque é pequeno (algumas dezenas de entradas) e o
 * evento é raro. Chamado por `integrations.setProviderSettings` quando
 * `meta.phoneNumberId` está no payload.
 */
export function clearMetaPhoneNumberIdLookupCache(): void {
  cache.clear();
}
