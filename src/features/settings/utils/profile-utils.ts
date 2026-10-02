import { countries } from "@/types/some";
import { normalizePhone } from "@/utils/format-phone";

export type PhoneCountry = (typeof countries)[number];

export const ACCEPTED_AVATAR_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
export const MAX_AVATAR_SIZE_MB = 5;

export function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export function parsePhone(fullPhone: string | null | undefined): {
  country: PhoneCountry;
  number: string;
} {
  const fallback = { country: countries[0], number: "" };
  if (!fullPhone) return fallback;
  const trimmed = fullPhone.trim();
  const match = trimmed.match(/^(\+\d{1,4})\s?(.*)$/);
  if (!match) return { country: countries[0], number: normalizePhone(trimmed) };
  const ddi = match[1];
  const country = countries.find((candidate) => candidate.ddi === ddi) ?? countries[0];
  return { country, number: normalizePhone(match[2]) };
}

export function toInitials(name: string): string {
  return (
    name
      .split(" ")
      .slice(0, 2)
      .map((word) => word[0])
      .join("")
      .toUpperCase() || "U"
  );
}
