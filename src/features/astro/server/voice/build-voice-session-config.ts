import "server-only";

/** Configuração da sessão de voz em tempo real do ASTRO (spec 0054, D-1 e D-2). */

export const ASTRO_VOICE_TOOL_NAME = "consultar_astro";
/** Modelos de voz em tempo real que o usuário pode escolher; o mini é o padrão por custar ~3× menos. */
export const REALTIME_VOICE_MODEL_IDS = ["gpt-realtime-mini", "gpt-realtime"] as const;
const DEFAULT_VOICE_MODEL = "gpt-realtime-mini";
const DEFAULT_VOICE = "marin";
/** Só os últimos ~6 mil tokens da conversa voltam a cada resposta: em tempo real, o histórico inteiro é cobrado de novo como entrada. */
const CONTEXT_TOKEN_LIMIT = 6000;
const CONTEXT_RETENTION_RATIO = 0.7;

/** Modelo pedido pelo usuário, se for um dos permitidos; senão o padrão (env ou mini). */
export function resolveVoiceModel(requestedModelId?: string | null): string {
  if (requestedModelId && (REALTIME_VOICE_MODEL_IDS as readonly string[]).includes(requestedModelId)) return requestedModelId;
  return process.env.ASTRO_VOICE_MODEL?.trim() || DEFAULT_VOICE_MODEL;
}

function buildInstructions(params: { userFirstName: string; organizationName: string }): string {
  const today = new Date().toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  return [
    `Você é o ASTRO, copiloto da plataforma ÓRBITA, conversando por voz com ${params.userFirstName}, da empresa ${params.organizationName}. Hoje é ${today}.`,
    "Fale em português do Brasil, com naturalidade e calor humano, como numa ligação entre colegas. Frases curtas: uma a três por vez. Nunca leia listas longas, tabelas, links ou markdown — resuma o essencial e ofereça detalhar.",
    `Sempre que a pessoa perguntar sobre dados da empresa (leads, contatos, vendas, propostas, agenda, tarefas, finanças, campanhas, relatórios) ou pedir uma ação na plataforma (criar, agendar, mover, enviar, cadastrar), chame a ferramenta ${ASTRO_VOICE_TOOL_NAME} com o pedido completo nas palavras dela. Antes de chamar, diga algo breve como "só um instante, vou ver isso".`,
    `Nunca invente números, nomes ou datas: o que for da empresa vem de ${ASTRO_VOICE_TOOL_NAME}. Se a resposta da ferramenta disser que algo apareceu na tela (cartão, confirmação, guia), avise que está na tela e explique em uma frase.`,
    "Para conversa geral, dúvidas de uso ou ideias, responda direto, sem a ferramenta.",
    "Se a pessoa interromper, pare e escute. Se ela se despedir, despeça-se em uma frase.",
  ].join("\n\n");
}

export function buildVoiceSessionConfig(params: { userFirstName: string; organizationName: string; modelId: string }) {
  return {
    type: "realtime",
    model: params.modelId,
    instructions: buildInstructions(params),
    truncation: {
      type: "retention_ratio",
      retention_ratio: CONTEXT_RETENTION_RATIO,
      token_limits: { post_instructions: CONTEXT_TOKEN_LIMIT },
    },
    audio: {
      input: {
        transcription: { model: "gpt-4o-mini-transcribe", language: "pt" },
        turn_detection: { type: "semantic_vad", eagerness: "auto", create_response: true, interrupt_response: true },
      },
      output: { voice: process.env.ASTRO_VOICE_NAME?.trim() || DEFAULT_VOICE },
    },
    tools: [
      {
        type: "function",
        name: ASTRO_VOICE_TOOL_NAME,
        description:
          "Consulta o ASTRO da plataforma ÓRBITA, que acessa os dados da empresa e executa ações. Use para qualquer pergunta sobre dados da empresa ou pedido de ação.",
        parameters: {
          type: "object",
          properties: {
            pergunta: { type: "string", description: "O pedido completo do usuário, em português." },
          },
          required: ["pergunta"],
        },
      },
    ],
    tool_choice: "auto",
  };
}
