import { z } from "zod";
import { base } from "@/app/middlewares/base";
import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { requireOrgAdmin } from "../_access";

const periodTypeSchema = z.enum([
  "DAILY",
  "WEEKLY",
  "MONTHLY",
  "BIMONTHLY",
  "QUARTERLY",
  "SEMIANNUAL",
  "ANNUAL",
]);

const entryKindSchema = z.enum(["SELLER", "BUCKET"]);

const importEntrySchema = z.object({
  externalCode: z.string().min(1),
  sellerName: z.string().min(1),
  goalName: z.string().min(1),
  goalAmount: z.number().nonnegative(),
  entryKind: entryKindSchema,
});

const importBranchSchema = z.object({
  name: z.string().min(1),
  entries: z.array(importEntrySchema),
});

const importSalesGoalRankingInputSchema = z.object({
  periodType: periodTypeSchema,
  periodStart: z.string(),
  periodEnd: z.string(),
  label: z.string().optional(),
  sourceFileName: z.string().optional(),
  branches: z.array(importBranchSchema).min(1),
});

// Reimportar o mesmo período (mesma organização + periodType + periodStart)
// atualiza valores em vez de duplicar linhas — upsert por externalCode.
export const importSalesGoalRanking = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(importSalesGoalRankingInputSchema)
  .handler(async ({ input, context }) => {
    await requireOrgAdmin(context.org.id, context.user.id);

    const periodStart = new Date(input.periodStart);
    const periodEnd = new Date(input.periodEnd);

    return prisma.$transaction(
      async (tx) => {
        const period = await tx.salesGoalPeriod.upsert({
          where: {
            organizationId_periodType_periodStart: {
              organizationId: context.org.id,
              periodType: input.periodType,
              periodStart,
            },
          },
          create: {
            organizationId: context.org.id,
            periodType: input.periodType,
            periodStart,
            periodEnd,
            label: input.label,
            sourceFileName: input.sourceFileName,
            importedByUserId: context.user.id,
          },
          update: {
            periodEnd,
            label: input.label,
            sourceFileName: input.sourceFileName,
            importedAt: new Date(),
            importedByUserId: context.user.id,
          },
        });

        let branchesCount = 0;
        let entriesCount = 0;

        for (const [index, branchInput] of input.branches.entries()) {
          const branch = await tx.salesGoalBranch.upsert({
            where: { periodId_name: { periodId: period.id, name: branchInput.name } },
            create: { periodId: period.id, name: branchInput.name, sortOrder: index },
            update: { sortOrder: index },
          });
          branchesCount += 1;

          for (const entryInput of branchInput.entries) {
            await tx.salesGoalEntry.upsert({
              where: {
                branchId_externalCode: {
                  branchId: branch.id,
                  externalCode: entryInput.externalCode,
                },
              },
              create: {
                branchId: branch.id,
                externalCode: entryInput.externalCode,
                sellerName: entryInput.sellerName,
                goalName: entryInput.goalName,
                goalAmount: entryInput.goalAmount,
                entryKind: entryInput.entryKind,
              },
              update: {
                sellerName: entryInput.sellerName,
                goalName: entryInput.goalName,
                goalAmount: entryInput.goalAmount,
                entryKind: entryInput.entryKind,
              },
            });
            entriesCount += 1;
          }
        }

        return { periodId: period.id, branchesCount, entriesCount };
      },
      { timeout: 30_000 },
    );
  });
