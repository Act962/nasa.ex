import type { Metadata } from "next";
import { notFound } from "next/navigation";
import prisma from "@/lib/prisma";
import {
  PUBLIC_USER_SELECT,
  filterProfileCardByToggles,
} from "@/features/space-page/utils/public-selectors";
import { ProfileView } from "@/features/space-page/components/profile-view";

interface Params {
  userId: string;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<Params>;
}): Promise<Metadata> {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, image: true },
  });

  if (!user) return { title: "Perfil não encontrado" };

  const card = await prisma.userProfileCard.findUnique({
    where: { userId },
    select: { headline: true, bio: true, isPublic: true, showHeadline: true, showBio: true },
  });

  const headline = card?.isPublic && card.showHeadline ? card.headline : null;
  const bio      = card?.isPublic && card.showBio      ? card.bio      : null;

  return {
    title:       `${user.name ?? "Perfil"} · NASA`,
    description: headline ?? bio ?? `Perfil público de ${user.name ?? ""}`,
    openGraph: {
      title:       user.name ?? "Perfil NASA",
      description: headline ?? bio ?? undefined,
      images:      user.image ? [user.image] : undefined,
    },
  };
}

export default async function ProfilePage({
  params,
}: {
  params: Promise<Params>;
}) {
  const { userId } = await params;

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: PUBLIC_USER_SELECT,
  });

  if (!user) notFound();

  const cardRaw = await prisma.userProfileCard.findUnique({
    where: { userId },
    select: {
      id:             true,
      headline:       true,
      bio:            true,
      cvUrl:          true,
      linkedinUrl:    true,
      githubUrl:      true,
      portfolioUrl:   true,
      email:          true,
      isPublic:       true,
      showHeadline:   true,
      showBio:        true,
      showCv:         true,
      showLinkedin:   true,
      showGithub:     true,
      showPortfolio:  true,
      showEmail:      true,
      showSkills:     true,
      showTools:      true,
      skills: {
        select: {
          level: true,
          skill: { select: { id: true, name: true, slug: true } },
        },
      },
      tools: {
        select: {
          proficiency: true,
          tool: { select: { id: true, name: true, slug: true, iconUrl: true } },
        },
      },
    },
  });

  const card =
    cardRaw && cardRaw.isPublic ? filterProfileCardByToggles(cardRaw) : null;
  const skills = cardRaw?.isPublic && cardRaw.showSkills ? cardRaw.skills : [];
  const tools  = cardRaw?.isPublic && cardRaw.showTools  ? cardRaw.tools  : [];

  // Empresas do usuário (Member) com Spacehome pública para link de volta
  const memberships = await prisma.member.findMany({
    where: { userId },
    select: {
      cargo: true,
      role: true,
      organization: {
        select: {
          id:                true,
          name:              true,
          slug:              true,
          logo:              true,
          isSpacehomePublic: true,
          spaceStation: {
            select: { nick: true },
          },
        },
      },
    },
  });

  return (
    <ProfileView
      user={user}
      card={card}
      skills={skills}
      tools={tools}
      memberships={memberships}
    />
  );
}
