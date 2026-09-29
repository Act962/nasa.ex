import "server-only";
import prisma from "@/lib/prisma";
import { sampleName, shortRandomSuffix } from "./helpers";
import type { SampleSeedContext } from "./types";

const SAMPLE_LESSONS = [
  {
    title: "Boas-vindas e como funciona o treinamento",
    summary: "Conheça a empresa, a equipe e o que você vai aprender.",
    contentMd: [
      "# Seja bem-vindo(a)!",
      "",
      "Este é um treinamento de exemplo para novos colaboradores.",
      "",
      "- Nossa história e nossos valores",
      "- Como é o dia a dia na loja",
      "- Quem procurar quando tiver dúvidas",
    ].join("\n"),
    durationMin: 5,
    isFreePreview: true,
  },
  {
    title: "Atendimento ao cliente pelo WhatsApp",
    summary: "Boas práticas para responder rápido e vender mais.",
    contentMd: [
      "# Atendimento que encanta",
      "",
      "1. Responda em até 5 minutos no horário comercial.",
      "2. Chame o cliente pelo nome.",
      "3. Confirme o pedido, o valor e a forma de entrega antes de finalizar.",
      "",
      "> Dica: use respostas rápidas para as perguntas mais comuns.",
    ].join("\n"),
    durationMin: 10,
    isFreePreview: false,
  },
];

export async function seedSampleRouteCourse(context: SampleSeedContext): Promise<void> {
  await prisma.$transaction(async (tx) => {
    const course = await tx.nasaRouteCourse.create({
      data: {
        creatorOrgId: context.organizationId,
        creatorUserId: context.ownerUserId,
        slug: `treinamento-da-equipe-exemplo-${shortRandomSuffix()}`,
        title: sampleName("Treinamento da equipe"),
        subtitle: "Integração de novos colaboradores",
        description: "Curso de exemplo com um módulo e duas aulas em texto. Edite, grave seus vídeos e publique.",
        level: "beginner",
        format: "training",
        durationMin: 15,
        priceStars: 0,
        priceBrlCents: 0,
        isFree: true,
        isPublished: false,
        plans: {
          create: {
            name: "Acesso completo",
            description: "Acesso a todas as aulas do curso.",
            priceStars: 0,
            priceBrlCents: 0,
            order: 0,
            isDefault: true,
          },
        },
      },
      include: { plans: { select: { id: true } } },
    });

    const courseModule = await tx.nasaRouteModule.create({
      data: {
        courseId: course.id,
        order: 0,
        title: "Primeiros passos",
        summary: "O essencial para começar bem na empresa.",
      },
    });

    const defaultPlanId = course.plans[0]?.id;
    for (const [index, sampleLesson] of SAMPLE_LESSONS.entries()) {
      const lesson = await tx.nasaRouteLesson.create({
        data: {
          courseId: course.id,
          moduleId: courseModule.id,
          order: index,
          title: sampleLesson.title,
          summary: sampleLesson.summary,
          contentMd: sampleLesson.contentMd,
          durationMin: sampleLesson.durationMin,
          isFreePreview: sampleLesson.isFreePreview,
        },
      });
      if (defaultPlanId) {
        await tx.nasaRoutePlanLesson.create({ data: { planId: defaultPlanId, lessonId: lesson.id } });
      }
    }
  });
}
