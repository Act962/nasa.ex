import { openai } from "@ai-sdk/openai";

export function defaultModel() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error(
      "OPENAI_API_KEY ausente — necessária para o agente do WhatsApp.",
    );
  }
  const id = "gpt-4o-mini";
  return openai(id);
}
