// Configuração da estação da empresa gravada no banco (spec 0119). Usada no servidor e no navegador.
import { z } from "zod";
import { DEFAULT_TEMPLATE_KEY, STATION_TEMPLATES } from "../layout/station-templates";

export const ROOM_NAME_MAX_LENGTH = 40;

export const templateKeySchema = z.string().refine((key) => STATION_TEMPLATES.some((template) => template.key === key), "Modelo de estação desconhecido");

/** Nomes próprios das salas, pela chave da sala. Chave de sala que o modelo atual não tem é guardada mesmo assim (CB-10). */
export const roomNamesSchema = z.record(
  z.string().regex(/^(top|bottom)-\d{1,2}$/),
  z.string().trim().min(1).max(ROOM_NAME_MAX_LENGTH),
);

export type RoomNames = z.infer<typeof roomNamesSchema>;

export interface StationSettings {
  templateKey: string;
  roomNames: RoomNames;
  version: number;
}

/** Lê o que veio do banco sem confiar nele: valor inválido vira o padrão, não derruba a página (RNF-6). */
export function parseStationSettings(stored: { templateKey: string; roomNames: unknown; version: number }): StationSettings {
  const templateKey = templateKeySchema.safeParse(stored.templateKey);
  const roomNames = roomNamesSchema.safeParse(stored.roomNames ?? {});
  return {
    templateKey: templateKey.success ? templateKey.data : DEFAULT_TEMPLATE_KEY,
    roomNames: roomNames.success ? roomNames.data : {},
    version: stored.version,
  };
}
