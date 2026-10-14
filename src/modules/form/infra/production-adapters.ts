import prisma from "@/lib/prisma";
import { createPlatformDraftEffects, createPlatformSubmissionEffects } from "./platform-submission-effects";
import { PrismaFormDraftRepository } from "./prisma-form-draft-repository";
import { PrismaFormSubmissionRepository } from "./prisma-form-submission-repository";

// Adapters ligados ao cliente Prisma global. Ficam aqui porque, dentro de
// src/modules, o Prisma só pode aparecer em infra/ (regra R7).

export const formSubmissionRepository = new PrismaFormSubmissionRepository(prisma);
export const submissionEffects = createPlatformSubmissionEffects(prisma);
export const formDraftRepository = new PrismaFormDraftRepository(prisma);
export const draftEffects = createPlatformDraftEffects(prisma);
