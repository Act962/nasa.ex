// import { PrismaClient, TagType, Temperature } from "@/generated/prisma/client";
// import { PrismaPg } from "@prisma/adapter-pg";
// import { faker } from "@faker-js/faker";

// import "dotenv/config";
// import z from "zod";

// const adapter = new PrismaPg({
//   connectionString: process.env.DATABASE_URL,
// });

// const prisma = new PrismaClient({
//   adapter,
// });

// const userId = "42iJDVudyr0YcUxNiMACYdO6nOwi6NZD";
// const organizationId = "1763649065560x124190212952162300";

// async function main() {
//   const user = await prisma.user.findUnique({
//     where: {
//       id: userId,
//     },
//   });

//   if (!user) {
//     throw new Error("User not found");
//   }

//   const organization = await prisma.organization.findUnique({
//     where: {
//       id: organizationId,
//     },
//   });

//   if (!organization) {
//     throw new Error("Organization not found");
//   }

//   await prisma.member.create({
//     data: {
//       userId,
//       organizationId,
//       role: "admin",
//       createdAt: new Date(),
//     },
//   });
// }

// main();
