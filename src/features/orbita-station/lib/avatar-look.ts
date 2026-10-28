import { z } from "zod";

export const LOOK_OPTIONS = {
  skin: ["#f6d2b5", "#eca674", "#c98e65", "#a06a45", "#7a4b2e", "#5a3622"],
  face: [["Knight", "Curto"], ["Ranger", "Curto 2"], ["Rogue", "Médio"], ["Mage", "Longo"], ["Barbarian", "Careca"]],
  hairColor: ["#201d1f", "#4a2e22", "#9a5943", "#dcb382", "#d9d4cf", "#d43df0", "#3de0f0"],
  suit: ["#1469ff", "#e0389a", "#2fa36b", "#e0832f", "#8a4fd6", "#c23b3b", "#1fa0b5", "#3a3f63"],
  accent: ["#19e6f5", "#ff7ad9", "#7dff9a", "#ffd166", "#b98cff", "#ffffff"],
  helmet: [["sem", "Nenhum"], ["com", "Capacete Órbita"], ["knight", "Elmo"], ["mage", "Chapéu de mago"], ["bear", "Gorro de urso"]],
  top: [["astronaut", "Traje Órbita"], ["Knight", "Armadura"], ["Rogue", "Jaqueta"], ["Ranger", "Colete"], ["Mage", "Túnica"], ["Barbarian", "Regata"]],
  bottom: [["astronaut", "Calça do traje"], ["Knight", "Grevas"], ["Rogue", "Calça escura"], ["Ranger", "Calça de trilha"], ["Mage", "Calça de mago"], ["Barbarian", "Calça de couro"]],
  cape: [["none", "Nenhuma"], ["Knight", "Capa real"], ["Rogue", "Capa curta"], ["Ranger", "Capa com capuz"], ["Mage", "Manto"]],
  outfitColor: ["original", "#1469ff", "#e0389a", "#2fa36b", "#e0832f", "#8a4fd6", "#c23b3b", "#3a3f63", "#f4f4fa"],
} as const;

const keysOf = <Option extends readonly (readonly [string, string])[]>(options: Option) =>
  options.map(([key]) => key) as unknown as [Option[number][0], ...Option[number][0][]];
const hexColor = z.string().regex(/^#[0-9a-f]{6}$/i);

export const avatarLookSchema = z.object({
  skin: hexColor,
  face: z.enum(keysOf(LOOK_OPTIONS.face)),
  hairColor: hexColor,
  suit: hexColor,
  accent: hexColor,
  helmet: z.enum(keysOf(LOOK_OPTIONS.helmet)),
  top: z.enum(keysOf(LOOK_OPTIONS.top)),
  bottom: z.enum(keysOf(LOOK_OPTIONS.bottom)),
  cape: z.enum(keysOf(LOOK_OPTIONS.cape)),
  outfitColor: z.union([z.literal("original"), hexColor]),
});

export type AvatarLook = z.infer<typeof avatarLookSchema>;

function hashOf(text: string): number {
  let hash = 5381;
  for (const char of text) hash = ((hash << 5) + hash + char.charCodeAt(0)) >>> 0;
  return hash;
}

/** Visual inicial estável por usuário: a mesma pessoa sempre começa igual, pessoas diferentes começam diferentes. */
export function defaultLook(userId: string): AvatarLook {
  const hash = hashOf(userId);
  const pick = <Item>(list: readonly Item[], salt: number) => list[(hash >>> salt) % list.length];
  return {
    skin: pick(LOOK_OPTIONS.skin, 1),
    face: pick(LOOK_OPTIONS.face, 3)[0],
    hairColor: pick(LOOK_OPTIONS.hairColor.slice(0, 5), 5),
    suit: pick(LOOK_OPTIONS.suit, 7),
    accent: pick(LOOK_OPTIONS.accent, 9),
    helmet: (hash >>> 11) % 4 === 0 ? "sem" : "com",
    top: "astronaut",
    bottom: "astronaut",
    cape: "none",
    outfitColor: "original",
  };
}
