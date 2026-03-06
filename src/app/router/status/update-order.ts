// import { base } from "@/app/middlewares/base";
// import { requiredAuthMiddleware } from "../../middlewares/auth";
// import prisma from "@/lib/prisma";
// import { z } from "zod";

// export const updateStatusOrder = base
//   .use(requiredAuthMiddleware)
//   .route({
//     method: "PATCH",
//     summary: "Update status order position",
//     tags: ["Status"],
//   })
//   .input(
//     z.object({
//       statusId: z.string(),
//       trackingId: z.string(),
//       newOrder: z.number(),
//     })
//   )
//   .output(
//     z.object({
//       success: z.boolean(),
//     })
//   )
//   .handler(async ({ input }) => {
//     const { statusId, trackingId, newOrder } = input;

//     // Busca a coluna atual
//     const currentStatus = await prisma.status.findUnique({
//       where: { id: statusId },
//     });

//     if (!currentStatus) {
//       throw new Error("Status not found");
//     }

//     // Pega todas as colunas do tracking
//     const statuses = await prisma.status.findMany({
//       where: { trackingId },
//       orderBy: { order: "asc" },
//     });

//     const currentOrder = currentStatus.order;

//     // Atualiza ordens com base no movimento
//     if (newOrder > currentOrder) {
//       // Mover para frente → desloca as colunas intermediárias para trás
//       await prisma.status.updateMany({
//         where: {
//           trackingId,
//           order: {
//             gt: currentOrder,
//             lte: newOrder,
//           },
//         },
//         data: { order: { decrement: 1 } },
//       });
//     } else if (newOrder < currentOrder) {
//       // Mover para trás → desloca as colunas intermediárias para frente
//       await prisma.status.updateMany({
//         where: {
//           trackingId,
//           order: {
//             gte: newOrder,
//             lt: currentOrder,
//           },
//         },
//         data: { order: { increment: 1 } },
//       });
//     }

//     // Atualiza o status movido
//     await prisma.status.update({
//       where: { id: statusId },
//       data: { order: newOrder },
//     });

//     return { success: true };
//   });
