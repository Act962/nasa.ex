import { listStatus } from "./list-status";
import { createStatus } from "./create";
import { updateStatus } from "./update";
import { updateStatusOrder } from "./update-order";

export const statusRoutes = {
  list: listStatus,
  create: createStatus,
  update: updateStatus,
  updateOrder: updateStatusOrder,
};

// {
//     list: listStatus,
//     create: createStatus,
//     // get: {},
//     update: updateStatus,
//     // delete: {},
//     updateOrder: updateStatusOrder,
//   },

// /** 🔄 Função auxiliar: renumera colunas dentro do tracking */
// async function normalizeStatusOrder(trackingId: string) {
//   const statuses = await prisma.status.findMany({
//     where: { trackingId },
//     orderBy: { order: "asc" },
//   });

//   for (let i = 0; i < statuses.length; i++) {
//     if (statuses[i].order !== i) {
//       await prisma.status.update({
//         where: { id: statuses[i].id },
//         data: { order: i },
//       });
//     }
//   }
// }
