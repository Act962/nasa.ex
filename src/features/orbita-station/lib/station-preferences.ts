// Preferências guardadas no navegador só na etapa 1 (spec 0117, D-5). Na etapa 2 o avatar vai para o servidor.
import { z } from "zod";
import { STATION_TEMPLATES } from "../layout/station-templates";
import { avatarLookSchema, defaultLook, type AvatarLook } from "./avatar-look";

const STORAGE_PREFIX = "orbita-station:v1";
const templateKeySchema = z.string().refine((key) => STATION_TEMPLATES.some((template) => template.key === key));

function readStored<Value>(key: string, schema: z.ZodType<Value>): Value | null {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:${key}`);
    if (raw === null) return null;
    const parsed = schema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}

function writeStored(key: string, value: unknown): boolean {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}:${key}`, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export function readTemplateKey(): string | null {
  return readStored("template", templateKeySchema);
}

export function saveTemplateKey(templateKey: string): boolean {
  return writeStored("template", templateKey);
}

export function readAvatarLook(userId: string): AvatarLook {
  return readStored(`avatar:${userId}`, avatarLookSchema) ?? defaultLook(userId);
}

export function hasSavedAvatarLook(userId: string): boolean {
  return readStored(`avatar:${userId}`, avatarLookSchema) !== null;
}

export function saveAvatarLook(userId: string, look: AvatarLook): boolean {
  return writeStored(`avatar:${userId}`, look);
}
