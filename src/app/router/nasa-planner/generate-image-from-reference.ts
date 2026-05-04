import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { debitStars } from "@/lib/star-service";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { StarTransactionType } from "@/generated/prisma/enums";
import { S3 } from "@/lib/s3-client";
import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import { v4 as uuidv4 } from "uuid";
import Replicate from "replicate";

const STARS_IMG2IMG = 1; // Replicate SDXL ~$0.002 × 1.5 ÷ 0.15 ≈ 1 STAR

export const generateImageFromReference = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(
    z.object({
      postId: z.string(),
      referenceImageKey: z.string(),
      prompt: z.string().min(5),
      strength: z.number().min(0.1).max(1.0).default(0.7),
      slideOrder: z.number().int().default(1),
    }),
  )
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });

    const replicateToken = process.env.REPLICATE_API_TOKEN;
    if (!replicateToken) {
      throw new ORPCError("PRECONDITION_FAILED", {
        message: "Configure REPLICATE_API_TOKEN nas variáveis de ambiente para usar img2img.",
      });
    }

    const debit = await debitStars(
      context.org.id, STARS_IMG2IMG, StarTransactionType.APP_CHARGE,
      "NASA Planner — img2img Replicate SDXL", "nasa-planner", context.user.id,
    );
    if (!debit.success) throw new ORPCError("BAD_REQUEST", { message: "Saldo de stars insuficiente" });

    // Fetch reference image from R2 as base64
    const s3Obj = await S3.send(
      new GetObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: input.referenceImageKey,
      }),
    );
    const imgBytes = await s3Obj.Body?.transformToByteArray();
    if (!imgBytes) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Imagem de referência não encontrada" });

    const contentType = s3Obj.ContentType ?? "image/png";
    const base64 = Buffer.from(imgBytes).toString("base64");
    const dataUrl = `data:${contentType};base64,${base64}`;

    // Call Replicate SDXL img2img
    const replicate = new Replicate({ auth: replicateToken });
    const output = await replicate.run(
      "stability-ai/sdxl:7762fd07cf82c948538e41f63f77d685e02b063e37e496e96eefd46c929f9bdc",
      {
        input: {
          image: dataUrl,
          prompt: input.prompt,
          strength: input.strength,
          num_inference_steps: 30,
          guidance_scale: 7.5,
        },
      },
    );

    const outputUrl = Array.isArray(output) ? (output[0] as unknown as string) : (output as unknown as string);
    if (!outputUrl) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Replicate não retornou imagem" });

    // Download result and upload to R2
    const imgRes = await fetch(outputUrl);
    if (!imgRes.ok) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Erro ao baixar imagem gerada" });
    const buffer = Buffer.from(await imgRes.arrayBuffer());
    const key = `nasa-planner/${uuidv4()}.png`;

    await S3.send(
      new PutObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: key,
        Body: buffer,
        ContentType: "image/png",
      }),
    );

    // Upsert slide
    const existingSlide = await prisma.nasaPlannerPostSlide.findFirst({
      where: { postId: input.postId, order: input.slideOrder },
    });

    const slide = existingSlide
      ? await prisma.nasaPlannerPostSlide.update({
          where: { id: existingSlide.id },
          data: { imageKey: key },
        })
      : await prisma.nasaPlannerPostSlide.create({
          data: { postId: input.postId, imageKey: key, order: input.slideOrder },
        });

    if (input.slideOrder === 1) {
      await prisma.nasaPlannerPost.update({
        where: { id: input.postId },
        data: { thumbnail: key },
      });
    }

    return { slide, imageKey: key, starsSpent: STARS_IMG2IMG, balanceAfter: debit.newBalance };
  });
