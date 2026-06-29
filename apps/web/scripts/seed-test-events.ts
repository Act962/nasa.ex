import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
  ssl: { rejectUnauthorized: false },
} as any);
const prisma = new PrismaClient({ adapter } as any);

async function main() {
  const existing = await prisma.action.findFirst({
    where: { isPublic: true },
    select: { workspaceId: true, organizationId: true, createdBy: true, coverImage: true },
  });
  if (!existing) { console.log("No existing public event found"); return; }

  const base = {
    workspaceId: existing.workspaceId,
    organizationId: existing.organizationId,
    createdBy: existing.createdBy,
    isPublic: true,
    isArchived: false,
    isGuestDraft: false,
    publishedAt: new Date(),
    coverImage: existing.coverImage,
    state: "PI",
    city: "Teresina",
    viewCount: 0,
    likesCount: 0,
    shareCount: 0,
  };

  const newEvents = [
    { title: "SUMMIT TECH 2026", publicSlug: "summit-tech-2026-x1a2b3", eventCategory: "CONFERENCIA" as const, startDate: new Date("2026-04-24T09:00:00"), endDate: new Date("2026-04-24T18:00:00") },
    { title: "WORKSHOP DIGITAL",  publicSlug: "workshop-digital-y4c5d6", eventCategory: "WORKSHOP"    as const, startDate: new Date("2026-04-24T14:00:00"), endDate: new Date("2026-04-24T17:00:00") },
    { title: "HACKATHON NASA",    publicSlug: "hackathon-nasa-z7e8f9",   eventCategory: "HACKATHON"   as const, startDate: new Date("2026-04-24T19:00:00"), endDate: new Date("2026-04-24T23:00:00") },
  ];

  for (const ev of newEvents) {
    await prisma.action.upsert({
      where: { publicSlug: ev.publicSlug },
      create: { ...base, ...ev },
      update: {},
    });
    console.log("✓", ev.title);
  }
  console.log("Done");
}

main().catch(console.error).finally(() => prisma.$disconnect());
