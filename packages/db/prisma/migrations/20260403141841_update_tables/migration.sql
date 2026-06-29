-- AlterTable
ALTER TABLE "member_star_budgets" ALTER COLUMN "updated_at" DROP DEFAULT;

-- AlterTable
ALTER TABLE "plans" ADD COLUMN     "benefits" JSONB NOT NULL DEFAULT '[]',
ADD COLUMN     "billing_type" TEXT NOT NULL DEFAULT 'monthly',
ADD COLUMN     "cta_gateway_id" TEXT,
ADD COLUMN     "cta_label" TEXT NOT NULL DEFAULT 'Assinar agora',
ADD COLUMN     "cta_link" TEXT,
ADD COLUMN     "highlighted" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "slogan" TEXT,
ADD COLUMN     "sort_order" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
