// Sons pré-definidos (sintetizados via Web Audio API, sem áudio externo) para
// as 3 categorias do Ranking de Equipes — evita depender de arquivos de
// terceiros com direitos autorais incertos (ex: trilhas oficiais de F1).

export type SalesGoalSoundCategory = "score" | "overtake" | "victory";

export interface SalesGoalSoundPreset {
  id: string;
  label: string;
}

export const SALES_GOAL_SOUND_PRESETS: Record<SalesGoalSoundCategory, SalesGoalSoundPreset[]> = {
  score: [
    { id: "score-ding", label: "🔔 Sino" },
    { id: "score-coin", label: "🪙 Moeda" },
    { id: "score-pop", label: "💥 Pop" },
  ],
  overtake: [
    { id: "overtake-whoosh", label: "💨 Whoosh" },
    { id: "overtake-horn", label: "📯 Buzina" },
    { id: "overtake-zap", label: "⚡ Zap" },
  ],
  victory: [
    { id: "victory-fanfare", label: "🎺 Fanfarra" },
    { id: "victory-chime", label: "✨ Chime ascendente" },
    { id: "victory-drumroll", label: "🥁 Redoble + Stab" },
  ],
};

let sharedContext: AudioContext | null = null;

function getAudioContext(): AudioContext | null {
  if (typeof window === "undefined") return null;
  const AudioContextClass =
    window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextClass) return null;
  if (!sharedContext || sharedContext.state === "closed") {
    sharedContext = new AudioContextClass();
  }
  return sharedContext;
}

function playTone(
  ctx: AudioContext,
  frequency: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  peakGain: number,
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, startTime);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

function playSweep(
  ctx: AudioContext,
  fromFrequency: number,
  toFrequency: number,
  startTime: number,
  duration: number,
  type: OscillatorType,
  peakGain: number,
) {
  const oscillator = ctx.createOscillator();
  const gain = ctx.createGain();
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(fromFrequency, startTime);
  oscillator.frequency.exponentialRampToValueAtTime(toFrequency, startTime + duration);
  gain.gain.setValueAtTime(0, startTime);
  gain.gain.linearRampToValueAtTime(peakGain, startTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  oscillator.connect(gain).connect(ctx.destination);
  oscillator.start(startTime);
  oscillator.stop(startTime + duration + 0.02);
}

export function playSalesGoalSoundPreset(presetId: string, volume = 0.6): void {
  const ctx = getAudioContext();
  if (!ctx) return;
  const now = ctx.currentTime;
  const peak = Math.max(Math.min(volume, 1), 0) * 0.5;

  switch (presetId) {
    case "score-ding":
      playTone(ctx, 1046.5, now, 0.25, "sine", peak);
      break;
    case "score-coin":
      playTone(ctx, 988, now, 0.08, "square", peak);
      playTone(ctx, 1319, now + 0.08, 0.18, "square", peak);
      break;
    case "score-pop":
      playSweep(ctx, 300, 900, now, 0.12, "triangle", peak);
      break;
    case "overtake-whoosh":
      playSweep(ctx, 200, 1200, now, 0.35, "sawtooth", peak * 0.7);
      break;
    case "overtake-horn":
      playTone(ctx, 220, now, 0.3, "sawtooth", peak);
      playTone(ctx, 220, now + 0.35, 0.3, "sawtooth", peak);
      break;
    case "overtake-zap":
      playSweep(ctx, 1500, 100, now, 0.15, "square", peak * 0.6);
      break;
    case "victory-fanfare":
      playTone(ctx, 523.25, now, 0.15, "triangle", peak);
      playTone(ctx, 659.25, now + 0.15, 0.15, "triangle", peak);
      playTone(ctx, 783.99, now + 0.3, 0.15, "triangle", peak);
      playTone(ctx, 1046.5, now + 0.45, 0.5, "triangle", peak);
      break;
    case "victory-chime":
      [1318.5, 1567.98, 2093].forEach((frequency, index) => {
        playTone(ctx, frequency, now + index * 0.12, 0.4, "sine", peak * 0.8);
      });
      break;
    case "victory-drumroll":
      for (let index = 0; index < 6; index += 1) {
        playTone(ctx, 150, now + index * 0.06, 0.05, "square", peak * 0.4);
      }
      playTone(ctx, 440, now + 0.45, 0.5, "sawtooth", peak);
      break;
    default:
      return;
  }
}

// Valor salvo no banco pode ser uma URL (link colado pelo admin) ou o id de
// um preset sintetizado acima — decide qual tocar.
export function playSalesGoalSound(value: string | null | undefined, volume = 0.6): void {
  if (!value) return;
  if (/^https?:\/\//i.test(value)) {
    const audio = new Audio(value);
    audio.volume = Math.max(Math.min(volume, 1), 0);
    audio.play().catch(() => {});
    return;
  }
  playSalesGoalSoundPreset(value, volume);
}
