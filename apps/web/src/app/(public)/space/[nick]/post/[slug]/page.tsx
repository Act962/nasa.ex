import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { headers } from "next/headers";
import prisma from "@/lib/prisma";
import { auth } from "@/lib/auth";
import { PostClient } from "./post-client";

interface Props {
  params: Promise<{ nick: string; slug: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { nick, slug } = await params;
  const station = await prisma.spaceStation.findUnique({
    where: { nick },
    select: {
      type: true,
      org: { select: { id: true, name: true, isSpacehomePublic: true } },
    },
  });
  if (!station?.org || station.type !== "ORG") {
    return { title: "Post não encontrado" };
  }
  if (!station.org.isSpacehomePublic) {
    return { title: "Post privado" };
  }
  const post = await prisma.companyPost.findFirst({
    where: {
      slug,
      orgId: station.org.id,
      isPublished: true,
    },
    select: { title: true, excerpt: true, coverUrl: true },
  });
  if (!post) return { title: "Post não encontrado" };
  return {
    title: `${post.title} · ${station.org.name}`,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      images: post.coverUrl ? [post.coverUrl] : undefined,
    },
  };
}

export default async function PostPage({ params }: Props) {
  const { nick, slug } = await params;

  const station = await prisma.spaceStation.findUnique({
    where: { nick },
    select: {
      type: true,
      org: {
        select: {
          id: true,
          name: true,
          logo: true,
          isSpacehomePublic: true,
        },
      },
    },
  });
  if (!station?.org || station.type !== "ORG") notFound();

  const hdrs = await headers();
  const sessionData = await auth.api.getSession({ headers: hdrs });
  const viewerUserId = sessionData?.user?.id ?? null;

  if (!station.org.isSpacehomePublic) {
    let isMember = false;
    if (viewerUserId) {
      const m = await prisma.member.findFirst({
        where: {
          userId: viewerUserId,
          organizationId: station.org.id,
        },
        select: { id: true },
      });
      isMember = !!m;
    }
    if (!isMember) notFound();
  }

  // Incrementa view count (fire-and-forget)
  prisma.companyPost
    .updateMany({
      where: {
        slug,
        orgId: station.org.id,
        isPublished: true,
      },
      data: { viewCount: { increment: 1 } },
    })
    .catch(() => null);

  return (
    <PostClient
      nick={nick}
      slug={slug}
      orgName={station.org.name}
      orgLogo={station.org.logo}
      isAuthenticated={!!viewerUserId}
    />
  );
}
