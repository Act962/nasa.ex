/**
 * Notificação sonora pra mensagens inbound no tracking-chat.
 *
 * Usa Web Audio API pra gerar um beep duplo curto (não precisa de
 * arquivo MP3 deployed). Som "nintendo-style": 2 notas crescentes em
 * 150ms total, suficientemente curto pra não atrapalhar mas distinto
 * o bastante pra ser percebido.
 *
 * **Política autoplay dos browsers**: Chrome/Safari bloqueiam Audio sem
 * interação prévia do usuário. Como o atendente sempre clica em algo
 * (lista de conversas, scroll do chat, etc) ANTES de mensagens novas
 * chegarem, isso normalmente "destrava" o AudioContext. Mesmo assim,
 * envolvemos em try/catch — se bloquear, falha silenciosa (não fica
 * jogando warning no console do atendente).
 *
 * Cooldown de 1.5s entre beeps pra não martelar quando chegam várias
 * mensagens em sequência (ex: lead manda 4 mensagens seguidas).
 */

let audioCtx: AudioContext | null = null;
let lastPlayedAt = 0;

const MIN_INTERVAL_MS = 1500;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (audioCtx) return audioCtx;
  try {
    const Ctor =
      (window as unknown as { AudioContext?: typeof AudioContext })
        .AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return null;
    audioCtx = new Ctor();
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Toca o beep de notificação. Idempotente sob cooldown — múltiplas
 * chamadas em <1.5s só tocam 1x.
 *
 * Usa um ramp suave de gain pra evitar clicks no início/fim das notas.
 */
export function playIncomingChatBeep() {
  if (typeof window === "undefined") return;
  const now = Date.now();
  if (now - lastPlayedAt < MIN_INTERVAL_MS) return;
  lastPlayedAt = now;

  const ctx = getAudioContext();
  if (!ctx) return;

  try {
    // Se o AudioContext estiver suspenso (Safari, política iOS), tenta
    // resumir. Se falhar silenciosamente, o som não toca — aceita.
    if (ctx.state === "suspended") ctx.resume().catch(() => {});

    const playTone = (freq: number, startOffset: number, durationSec: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      gain.gain.value = 0;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const startAt = ctx.currentTime + startOffset;
      const endAt = startAt + durationSec;
      // Envelope ADSR simples: attack 10ms, decay imediato pra 0
      gain.gain.setValueAtTime(0, startAt);
      gain.gain.linearRampToValueAtTime(0.18, startAt + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, endAt);
      osc.start(startAt);
      osc.stop(endAt + 0.02);
    };

    // 2 notas crescentes (G5 → C6) — soa "alegre/positivo", não
    // alarmante. Total ~180ms.
    playTone(784, 0, 0.08); // G5
    playTone(1047, 0.09, 0.1); // C6
  } catch {
    // Se algo falhar (browser legacy, modo bloqueado), silêncio.
  }
}
