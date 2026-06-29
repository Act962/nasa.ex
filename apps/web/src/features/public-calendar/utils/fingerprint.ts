import crypto from "crypto";

export function hashFingerprint(
  ip: string | null | undefined,
  visitorId: string | null | undefined,
  userAgent: string | null | undefined,
): string {
  const salt = process.env.FINGERPRINT_SALT ?? "nasa-calendar";
  const raw = `${salt}|${ip ?? "noip"}|${visitorId ?? "novid"}|${userAgent ?? "noua"}`;
  return crypto.createHash("sha256").update(raw).digest("hex").slice(0, 32);
}

export function extractClientIp(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? null;
}
