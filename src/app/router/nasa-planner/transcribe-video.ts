import { requiredAuthMiddleware } from "@/app/middlewares/auth";
import { base } from "@/app/middlewares/base";
import { requireOrgMiddleware } from "@/app/middlewares/org";
import prisma from "@/lib/prisma";
import { ORPCError } from "@orpc/server";
import { z } from "zod";
import { S3 } from "@/lib/s3-client";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import OpenAI from "openai";
import { toFile } from "openai";

export const transcribeVideo = base
  .use(requiredAuthMiddleware)
  .use(requireOrgMiddleware)
  .input(z.object({ postId: z.string() }))
  .handler(async ({ input, context }) => {
    const post = await prisma.nasaPlannerPost.findFirst({
      where: { id: input.postId, organizationId: context.org.id },
    });
    if (!post) throw new ORPCError("NOT_FOUND", { message: "Post não encontrado" });
    if (!post.videoKey) throw new ORPCError("BAD_REQUEST", { message: "Post não possui vídeo anexado" });

    const openaiKey = process.env.OPENAI_API_KEY;
    if (!openaiKey) {
      throw new ORPCError("PRECONDITION_FAILED", {
        message: "Configure OPENAI_API_KEY para usar transcrição.",
      });
    }

    // Download video from R2
    const s3Obj = await S3.send(
      new GetObjectCommand({
        Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
        Key: post.videoKey,
      }),
    );
    const videoBytes = await s3Obj.Body?.transformToByteArray();
    if (!videoBytes) throw new ORPCError("INTERNAL_SERVER_ERROR", { message: "Vídeo não encontrado no storage" });

    const ext = post.videoKey.split(".").pop() ?? "mp4";
    const filename = `video.${ext}`;

    const openai = new OpenAI({ apiKey: openaiKey });
    const file = await toFile(Buffer.from(videoBytes), filename, {
      type: s3Obj.ContentType ?? "video/mp4",
    });

    const transcription = await openai.audio.transcriptions.create({
      file,
      model: "whisper-1",
      response_format: "text",
      language: "pt",
    });

    return { transcript: transcription as unknown as string };
  });
