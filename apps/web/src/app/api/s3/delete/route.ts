import { S3 } from "@/lib/s3-client";
import { DeleteObjectCommand } from "@aws-sdk/client-s3";
import { NextResponse } from "next/server";

export async function DELETE(request: Request) {
  try {
    const body = await request.json();

    const key = body.key;

    if (!key) {
      return NextResponse.json(
        {
          error: "Missing or invalid object key",
        },
        {
          status: 400,
        },
      );
    }

    const command = new DeleteObjectCommand({
      Bucket: process.env.NEXT_PUBLIC_S3_BUCKET_NAME_IMAGES,
      Key: key,
    });

    await S3.send(command);

    return NextResponse.json(
      {
        message: "File deleted successfully",
      },
      {
        status: 200,
      },
    );
  } catch {
    return NextResponse.json(
      {
        error: "Missing or invalid object key",
      },
      {
        status: 400,
      },
    );
  }
}
