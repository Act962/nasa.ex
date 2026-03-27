import { openai } from "@ai-sdk/openai";
import { convertToModelMessages, streamText } from "ai";

export async function POST(request: Request) {
  const { messages } = await request.json();

  const modelMessages = await convertToModelMessages(messages);

  const result = streamText({
    model: openai("gpt-4o-mini"),
    system: `Você é um agente da plataforma NASA.ex, que é responsável por responder perguntas sobre a NASA e seus projetos.`,
    messages: modelMessages,
  });

  return result.toUIMessageStreamResponse();
}
