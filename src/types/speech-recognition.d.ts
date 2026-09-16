/**
 * A Web Speech API não está no `lib.dom.d.ts` do TypeScript: `SpeechRecognitionEvent`
 * existe, mas a interface `SpeechRecognition` (e o construtor, ainda prefixado em
 * alguns navegadores) não. Sem esta declaração, os três pontos que usam voz —
 * o orb do Astro, a wake word e o input de voz do /home — não compilam.
 *
 * Só os membros que o projeto realmente usa. Se precisar de mais, acrescente aqui
 * em vez de espalhar `as any` nos componentes.
 */

interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}

interface SpeechRecognition extends EventTarget {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  maxAlternatives: number;
  onstart: ((this: SpeechRecognition, event: Event) => void) | null;
  onresult:
    | ((this: SpeechRecognition, event: SpeechRecognitionEvent) => void)
    | null;
  onerror:
    | ((this: SpeechRecognition, event: SpeechRecognitionErrorEvent) => void)
    | null;
  onend: ((this: SpeechRecognition, event: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

declare const SpeechRecognition: {
  prototype: SpeechRecognition;
  new (): SpeechRecognition;
};

interface Window {
  SpeechRecognition?: typeof SpeechRecognition;
  webkitSpeechRecognition?: typeof SpeechRecognition;
}
