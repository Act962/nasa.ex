import { createHmac } from "crypto";

export type SignInput = {
  method: string;
  path: string;
  body: string;
  timestamp: string;
  secret: string;
};

export function buildCanonicalString(input: Omit<SignInput, "secret">): string {
  return `${input.method.toUpperCase()}\n${input.path}\n${input.body}\n${input.timestamp}`;
}

export function signRequest(input: SignInput): string {
  const canonical = buildCanonicalString(input);
  return createHmac("sha256", input.secret).update(canonical).digest("hex");
}
