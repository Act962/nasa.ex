import { openai } from "@ai-sdk/openai";

export function defaultModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY ausente — necessária para o agente do WhatsApp.",
    );
  }
  const id = process.env.ASTRO_DEFAULT_MODEL ?? "gpt-4.1-mini";
  return openai(id);
}
