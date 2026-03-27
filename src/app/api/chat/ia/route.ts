import { generateText, Output } from "ai";
import { NextResponse } from "next/server";
import { openai } from "@ai-sdk/openai";
import z from "zod";

// export async function POST(request: Request) {
//   const { amount, topic } = await request.json();

//   const result = await generateText({
//     model: openai("gpt-4o-mini"),
//     system: "Você é um assistente de IA que responde de forma humoristica",
//     prompt: "Quanto que é 2 + 2?",
//   });

//   const { output } = await generateText({
//     model: openai("gpt-4o-mini"),
//     output: Output.object({
//       schema: z.object({
//         questions: z
//           .array(
//             z.object({
//               question: z.string().describe("Enunciado da questão"),
//               alternatives: z
//                 .array(
//                   z.object({
//                     description: z
//                       .string()
//                       .describe("Enunciado da alternativa"),
//                     isCorrect: z
//                       .boolean()
//                       .describe("Se a alternativa é correta ou não."),
//                   }),
//                 )
//                 .describe("Array de alternativas"),
//             }),
//           )
//           .describe("Array de questões com alternativas"),
//       }),
//     }),
//     system:
//       "Você é um assistente de questões com alternativas de múltipla escolha, que gera questões com base no que o usuário solicitar",
//     prompt: `Gere ${amount} questões sobre ${topic}`,
//   });

//   return NextResponse.json({ message: output.questions });
// }

export async function POST(request: Request) {
  return NextResponse.json({ message: "Hello World" });
}
