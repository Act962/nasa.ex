import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getInitials(name: string): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/);
  if (parts.length === 0) return "";

  const firstInitial = parts[0][0] || "";
  const secondInitial = parts.length > 1 ? parts[1][0] : "";

  return (firstInitial + secondInitial).toUpperCase();
}
