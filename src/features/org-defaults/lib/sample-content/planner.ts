import "server-only";
import type { NasaPlannerCard } from "@/generated/prisma/client";
import prisma from "@/lib/prisma";
import { daysFromNow, sampleName } from "./helpers";
import type { SampleSeedContext } from "./types";

const MIND_MAP_NAME = sampleName("Plano de lançamento");

const TOPIC_BRANCHES = [
  { id: "node-publico", label: "Público-alvo", color: "#EC4899", position: { x: 650, y: 150 } },
  { id: "node-canais", label: "Canais de divulgação", color: "#10B981", position: { x: 650, y: 300 } },
  { id: "node-oferta", label: "Oferta de lançamento", color: "#F59E0B", position: { x: 650, y: 450 } },
];

const SAMPLE_CARDS = [
  { title: "Definir persona do cliente ideal", priority: "HIGH", status: "IN_PROGRESS" as const, dueInDays: 3 },
  { title: "Gravar vídeo de apresentação da loja", priority: "MEDIUM", status: "PENDING" as const, dueInDays: 7 },
  { title: "Criar cupom de 10% para a primeira compra", priority: "LOW", status: "PENDING" as const, dueInDays: 10 },
];

export async function seedSamplePlanner(context: SampleSeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const planner = await tx.nasaPlanner.create({
      data: {
        organizationId: context.organizationId,
        name: sampleName("Planejamento de conteúdo"),
        description: "Planner de exemplo com posts em rascunho e um mapa mental de lançamento.",
        toneOfVoice: "Próximo, simpático e direto, como uma conversa no balcão da loja.",
        keyMessages: ["Atendimento de perto", "Entrega rápida na região"],
        defaultHashtags: ["#lojadobairro", "#compreLocal"],
        defaultCtas: ["Chame no WhatsApp", "Visite a loja"],
      },
    });

    await tx.nasaPlannerPost.createMany({
      data: [
        {
          plannerId: planner.id,
          organizationId: context.organizationId,
          createdById: context.ownerUserId,
          type: "STATIC",
          status: "DRAFT",
          title: sampleName("Post de boas-vindas"),
          caption:
            "Chegamos nas redes! 🎉 Aqui você vai acompanhar novidades, promoções e os bastidores da nossa loja. Conta pra gente: o que você quer ver por aqui?",
          hashtags: ["#novidade", "#lojadobairro", "#compreLocal"],
          cta: "Siga o perfil e ative as notificações",
        },
        {
          plannerId: planner.id,
          organizationId: context.organizationId,
          createdById: context.ownerUserId,
          type: "CAROUSEL",
          status: "DRAFT",
          title: sampleName("Carrossel: 3 motivos para comprar com a gente"),
          caption:
            "1️⃣ Atendimento de verdade, com quem entende do assunto.\n2️⃣ Entrega rápida na sua região.\n3️⃣ Preço justo e condições especiais no PIX.\n\nArraste para o lado e confira!",
          hashtags: ["#dicas", "#atendimento", "#compreLocal"],
          cta: "Chame no WhatsApp e faça seu pedido",
        },
      ],
    });

    const mindMap = await tx.nasaPlannerMindMap.create({
      data: {
        plannerId: planner.id,
        name: MIND_MAP_NAME,
        template: "mindmap",
        nodes: [],
        edges: [],
      },
    });

    const cardNodes: { card: NasaPlannerCard; branch: (typeof TOPIC_BRANCHES)[number] }[] = [];
    for (const [index, sampleCard] of SAMPLE_CARDS.entries()) {
      const branch = TOPIC_BRANCHES[index];
      const card = await tx.nasaPlannerCard.create({
        data: {
          mindMapId: mindMap.id,
          plannerId: planner.id,
          title: sampleCard.title,
          priority: sampleCard.priority,
          status: sampleCard.status,
          assigneeIds: [context.ownerUserId],
          dueDate: daysFromNow(sampleCard.dueInDays, 18),
          nodeId: branch.id,
        },
      });
      cardNodes.push({ card, branch });
    }

    const rootNode = {
      id: "root",
      type: "mindMapRoot",
      position: { x: 400, y: 300 },
      data: { label: MIND_MAP_NAME, color: "#7C3AED" },
    };
    const topicNodes = TOPIC_BRANCHES.map((branch) => ({
      id: branch.id,
      type: "topic",
      position: branch.position,
      data: { label: branch.label, color: branch.color, depth: 1, hasChildren: true },
    }));
    const cardPositionNodes = cardNodes.map(({ card, branch }) => ({
      id: `card-${card.id}`,
      type: "cardNode",
      position: { x: branch.position.x + 260, y: branch.position.y },
      data: { title: card.title, status: card.status, priority: card.priority, cardId: card.id },
    }));

    const rootEdges = TOPIC_BRANCHES.map((branch) => ({
      id: `e-root-${branch.id}`,
      source: "root",
      target: branch.id,
      type: "custom",
      data: { color: branch.color },
    }));
    const cardEdges = cardNodes.map(({ card, branch }) => ({
      id: `e-${branch.id}-card-${card.id}`,
      source: branch.id,
      target: `card-${card.id}`,
      type: "custom",
      data: { color: branch.color },
    }));

    await tx.nasaPlannerMindMap.update({
      where: { id: mindMap.id },
      data: {
        nodes: [rootNode, ...topicNodes, ...cardPositionNodes],
        edges: [...rootEdges, ...cardEdges],
      },
    });
  });
}
