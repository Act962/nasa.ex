import { S3 } from "@/lib/storage";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { z } from "zod";

const fileUploadSchema = z.object({
  fileName: z.string().min(1, "Nome do arquivo é obrigatório"),
  contentType: z.string().min(1, "Content type is required"),
  size: z.number().min(1, "Size is required"),
  isImage: z.boolean(),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();

    const validation = fileUploadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: "Invalid Request Body",
        },
        {
          status: 400,
        },
      );
    }

    const { fileName, contentType, size, isImage } = validation.data;

    const uniqueKey = `${randomUUID()}-${fileName}`;

    const command = new PutObjectCommand({
      Bucket: process.env.AWS_BUCKET_NAME,
      ContentType: contentType,
      ContentLength: size,
      Key: uniqueKey,
    });

    const presignedUrl = await getSignedUrl(S3, command, {
      expiresIn: 360,
    });

    const response = {
      presignedUrl,
      key: uniqueKey,
    };

    return NextResponse.json(response);
  } catch (error) {
    return NextResponse.json(
      {
        error: "Failed to generate presigned URL",
      },
      {
        status: 500,
      },
    );
  }
}
