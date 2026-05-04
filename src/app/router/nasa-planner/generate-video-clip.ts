import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import { debitStars } from "@/lib/star-service";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { IntegrationPlatform, StarTransactionType } from "@/generated/prisma/enums";
import { z } from "zod";
import { v4 as uuidv4 } from "uuid";
import { S3 } from "@/lib/s3-client";
import { PutObjectCommand } from "@aws-sdk/client-s3";

const STARS_VIDEO_FALAI = 3;   // fal.ai kling 5s ~$0.04 = R$0.23 × 1.5 ÷ 0.15
const STARS_VIDEO_RUNWAY = 15; // RunwayML 5s ~$0.25 = R$1.43 × 1.5 ÷ 0.15

export const generateVideoClip = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      postId: z.string(),
      prompt: z.string().min(5),
      duration: z.number().int().min(3).max(10).default(5),
      provider: z.enum(["falai", "runway"]).default("falai"),
    }),
  )
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    const starsNeeded = input.provider === "runway" ? STARS_VIDEO_RUNWAY : STARS_VIDEO_FALAI;

    // Try to find fal.ai key from OPENAI integration (user stores fal.ai key there)
    const openaiIntegration = await prisma.platformIntegration.findFirst({
      where: {
        organizationId: context.org.id,
        platform: IntegrationPlatform.OPENAI,
        isActive: true,
      },
    });
    const apiKey = openaiIntegration
      ? ((openaiIntegration.config as Record<string, string>).falaiKey ??
         (openaiIntegration.config as Record<string, string>).apiKey)
      : process.env.FAL_API_KEY;

    if (!apiKey) {
      throw new ORPCError("PRECONDITION_FAILED", {
        message: "Configure uma chave fal.ai em Integrações → OpenAI (campo falaiKey) para gerar vídeos com IA.",
      });
    }

    let videoUrl: string | null = null;

    if (input.provider === "falai") {
      const res = await fetch("https://queue.fal.run/fal-ai/kling-video/v1.5/standard/text-to-video", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Key ${apiKey}`,
        },
        body: JSON.stringify({
          prompt: input.prompt,
          duration: `${input.duration}`,
          aspect_ratio: "16:9",
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new ORPCError("INTERNAL_SERVER_ERROR", { message: `fal.ai erro: ${err.slice(0, 200)}` });
      }

      // fal.ai returns a queue request — poll for result
      const queued = (await res.json()) as { request_id: string; response_url: string };

      let attempts = 0;
      while (attempts < 60) {
        await new Promise((r) => setTimeout(r, 5000));
        const poll = await fetch(queued.response_url, {
          headers: { Authorization: `Key ${apiKey}` },
        });
        const result = (await poll.json()) as any;
        if (result.status === "COMPLETED" || result.video?.url) {
          videoUrl = result.video?.url ?? result.outputs?.[0]?.url ?? null;
          break;
        }
        if (result.status === "FAILED") {
          throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "fal.ai: geração falhou" });
        }
        attempts++;
      }
    }

    if (!videoUrl) {
      throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Timeout ao gerar vídeo" });
    }

    // Download and re-upload to R2
    const videoRes = await fetch(videoUrl);
    if (!videoRes.ok) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Erro ao baixar vídeo gerado" });
    const videoBuffer = Buffer.from(await videoRes.arrayBuffer());

    const key = `nasa-planner/videos/${uuidv4()}.mp4`;
    await S3.send(
      new PutObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: key,
        Body: videoBuffer,
        ContentType: "video/mp4",
      }),
    );

    const { newBalance: balanceAfter } = await debitStars(
      context.org.id,
      starsNeeded,
      StarTransactionType.APP_CHARGE,
      `Vídeo IA gerado via ${input.provider} (${input.duration}s)`,
      "nasa-planner",
    );

    // Add as slide
    const slideCount = await prisma.nasaPlannerPostSlide.count({ where: { postId: input.postId } });
    const slide = await prisma.nasaPlannerPostSlide.create({
      data: { postId: input.postId, videoKey: key, order: slideCount + 1 },
    });

    return { slide, videoKey: key, starsSpent: starsNeeded, balanceAfter };
  });
