// Emotes da estação: o aceno é o braço girado no código; os outros usam clipes do pacote de animações do KayKit.
// A chave viaja pela sala do LiveKit (mensagem `emote`), então só entra aqui o que todos os clientes conhecem.
export const EMOTES = [
  { key: "wave", label: "Acenar", clip: null },
  { key: "jump", label: "Pular", clip: "Jump_Full_Short" },
  { key: "greet", label: "Cumprimentar", clip: "Interact" },
  { key: "surprise", label: "Susto", clip: "Hit_A" },
] as const;

export type EmoteKey = (typeof EMOTES)[number]["key"];

export const EMOTE_KEYS = EMOTES.map((emote) => emote.key) as [EmoteKey, ...EmoteKey[]];

export function emoteClip(key: EmoteKey): string | null {
  return EMOTES.find((emote) => emote.key === key)?.clip ?? null;
}
