-- Planner v2 (specs 0057 e 0058): novos status do post.
-- Separada da migration base: valor novo de enum não pode ser usado na mesma transação em que nasce.
ALTER TYPE "NasaPlannerPostStatus" ADD VALUE IF NOT EXISTS 'IDEA';
ALTER TYPE "NasaPlannerPostStatus" ADD VALUE IF NOT EXISTS 'CHANGES_REQUESTED';
ALTER TYPE "NasaPlannerPostStatus" ADD VALUE IF NOT EXISTS 'PUBLISHING';
