import { PutObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";
import z from "zod";
import { v4 as uuidv4 } from "uuid";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { S3 } from "@/lib/s3-client";

export const fileUploadSchema = z.object({
  filename: z.string().min(1, { message: "Filename is required" }),
  contentType: z.string().min(1, { message: "Content type is required" }),
  size: z.number().min(1, { message: "File size is required" }),
  isImage: z.boolean(),
});

export async function POST(req: Request) {
  try {
    const body = await req.json();

    const validation = fileUploadSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { error: "Invalid Request Body", details: validation.error.format() },
        { status: 400 },
      );
    }

    const { filename, contentType, size, isImage } = validation.data;

    const extention = filename.split(".").pop();

    const uniqueKey = `${uuidv4()}.${extention}`;

    const command = new PutObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES!,
      ContentType: contentType,
      ContentLength: size,
      Key: uniqueKey,
    });
    const presignedUrl = await getSignedUrl(S3, command, {
      expiresIn: 60 * 60, //URL expires in 6 minutes
    });

    const response = {
      presignedUrl,
      key: uniqueKey,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.log(error);
    return NextResponse.json(
      { error: "Failed to generate presigned URL" },
      { status: 500 },
    );
  }
}
