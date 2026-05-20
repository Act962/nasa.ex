import { AiSettings } from "@/generated/prisma/client";

interface AvailableTag {
  id: string;
  name: string;
  description: string | null;
}

interface CurrentLeadTag {
  tag: { id: string; name: string };
}

interface BuildPromptArgs {
  settings: AiSettings;
  orgName: string;
  leadName: string | null;
  currentTags: CurrentLeadTag[];
  availableTags: AvailableTag[];
}

export function buildSystemPrompt({
  settings,
  orgName,
  leadName,
  currentTags,
  availableTags,
}: BuildPromptArgs): string {
  const assistantName = settings.assistantName?.trim() || "atendente";
  const finishSentence = settings.finishSentence?.trim();

  const finishBlock = finishSentence
    ? `## Encerramento
Quando o lead pedir para falar com humano OU quando perceber que: "${finishSentence}",
chame a tool \`transfer_to_human\` (passa o atendimento para um humano) ou
\`finish_conversation\` (encerra a conversa de vez). NUNCA prometa "vou te
passar pro humano" sem chamar a tool — a promessa não desliga a IA, só a tool faz isso.`
    : `## Encerramento
Quando o lead pedir para falar com humano, chame a tool \`transfer_to_human\`.
NUNCA prometa "vou te passar pro humano" sem chamar a tool — a promessa não
desliga a IA, só a tool faz isso.`;

  const taggingBlock = buildTaggingBlock(currentTags, availableTags);

  return [
    `Você é ${assistantName} da empresa "${orgName}".`,
    leadName ? `Você está conversando com ${leadName}.` : "",
    "",
    settings.prompt.trim(),
    "",
    "## Como você responde",
    "- Sua resposta em texto puro (o que você escreve fora de qualquer tool) é enviada AUTOMATICAMENTE como mensagem de WhatsApp pro lead.",
    "- Não precisa chamar tool nenhuma pra mandar texto — só escreva o que quer dizer.",
    "- Para mídia, use `send_audio` ou `send_document` antes do texto final.",
    "- Mensagens curtas e naturais, no idioma do lead. Nada de markdown pesado.",
    "",
    "## Estilo de mensagem (IMPORTANTE)",
    "- Escreva como uma pessoa digitando no WhatsApp, NÃO como e-mail.",
    "- Quebre seu raciocínio em **2 a 4 mensagens curtas**, separadas por **linha em branco** (uma linha vazia entre cada mensagem).",
    "- Cada mensagem com no máximo ~280 caracteres (uns 2-3 períodos).",
    "- Exemplo bom:",
    "  ```",
    "  Oi! Tudo bem? 😊",
    "",
    "  Posso te ajudar a ver os planos.",
    "",
    "  Você tá procurando pra uso pessoal ou pra empresa?",
    "  ```",
    "- Exemplo ruim (NÃO faça): tudo num parágrafo só, ou 7 mensagens picotadas.",
    "",
    taggingBlock,
    finishBlock,
  ]
    .filter(Boolean)
    .join("\n");
}

function buildTaggingBlock(
  currentTags: CurrentLeadTag[],
  availableTags: AvailableTag[],
): string {
  if (availableTags.length === 0) {
    // Sem catálogo → tool não é registrada (ver server/tools/index.ts).
    return "";
  }

  const currentList =
    currentTags.length > 0
      ? currentTags.map((lt) => `- ${lt.tag.name} (id: ${lt.tag.id})`).join("\n")
      : "- (nenhuma)";

  const catalogList = availableTags
    .map((t) => `- ${t.name} (id: ${t.id}): ${t.description}`)
    .join("\n");

  return [
    "## Tags atuais do lead",
    currentList,
    "",
    "## Catálogo de tags disponíveis",
    "Cada linha tem `nome (id: ID): descrição`. Use a descrição para decidir quando aplicar a tag.",
    catalogList,
    "",
    "## Quando tagear",
    "- Sempre que algo importante na conversa case com a descrição de uma tag do catálogo, chame `add_tags_to_lead` passando o(s) `id`(s) correspondente(s).",
    "- Pode aplicar até 3 tags na mesma chamada.",
    "- NÃO anuncie ao lead que está tagueando — é registro interno.",
    "- NÃO invente IDs — use exatamente os do catálogo acima.",
    "- NÃO tente aplicar tag que já está em \"Tags atuais do lead\".",
    "- **IMPORTANTE — depois de chamar `add_tags_to_lead`, SEMPRE continue a conversa com texto pro lead.** A tool é só registro interno; o lead continua esperando sua resposta. NÃO encerre a conversa por causa de uma tag — só `transfer_to_human` ou `finish_conversation` encerram.",
    "- Se você ia responder algo e percebeu que cabe tagear, faça as duas coisas: chame `add_tags_to_lead` E em seguida escreva a resposta normal pro lead.",
    "",
  ].join("\n");
}
