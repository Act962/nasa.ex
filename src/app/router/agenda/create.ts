// import { requiredAuthMiddleware } from "@/app/middlewares/auth";
// import { base } from "@/app/middlewares/base";
// import prisma from "@/lib/prisma";
// import z from "zod";

// export const createAgenda = base
//   .use(requiredAuthMiddleware)
//   .route({
//     method: "POST",
//     path: "/agenda/create",
//     summary: "Create agenda",
//   })
//   .input(
//     z.object({
//       name: z.string(),
//       description: z.string(),
//       trackingId: z.string(),
//     }),
//   )
//   .handler(async ({ input }) => {
//     const { name, description, trackingId } = input;

//     const agenda = await prisma.availability.create({
//       data: {
//         name,
//         description,
//         trackingId,
//       },
//     });

//     return agenda;
//   });
