import { customAlphabet } from "nanoid";

const slugAlphabet = "0123456789abcdefghijklmnopqrstuvwxyz";
const nano = customAlphabet(slugAlphabet, 6);

export function slugifyTitle(title: string): string {
  return title
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export function generatePublicSlug(title: string): string {
  const base = slugifyTitle(title) || "evento";
  return `${base}-${nano()}`;
}
