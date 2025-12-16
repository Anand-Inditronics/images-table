import { NextResponse } from "next/server";
import { S3Client, ListObjectsV2Command } from "@aws-sdk/client-s3";

const s3 = new S3Client({
  region: process.env.AWS_REGION!,
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET = process.env.S3_BUCKET_NAME!;
const PREFIX = process.env.S3_BASE_PREFIX!;
const REGION = process.env.AWS_REGION!;

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);

    const deviceIdFilter = searchParams.get("device_id");
    const startTime = searchParams.get("start_time")
      ? Number(searchParams.get("start_time"))
      : null;
    const endTime = searchParams.get("end_time")
      ? Number(searchParams.get("end_time"))
      : null;

    const page = Number(searchParams.get("page") || 1);
    const limit = Number(searchParams.get("limit") || 20);

    const listCmd = new ListObjectsV2Command({
      Bucket: BUCKET,
      Prefix: PREFIX,
    });

    const s3Response = await s3.send(listCmd);

    let records = s3Response.Contents?.map((obj) => {
      if (!obj.Key) return null;

      // meters_output/unrecognized/IM000101_1765374516.jpg
      const fileName = obj.Key.split("/").pop();
      if (!fileName) return null;

      const [device_id, tsPart] = fileName.split("_");
      const timestamp = Number(tsPart?.replace(".jpg", ""));

      if (!device_id || !timestamp) return null;

      return {
        device_id,
        timestamp,
        s3_image_url: `https://${BUCKET}.s3.${REGION}.amazonaws.com/${obj.Key}`,
      };
    }).filter(Boolean) as {
      device_id: string;
      timestamp: number;
      s3_image_url: string;
    }[];

    // 🔍 FILTERS
    if (deviceIdFilter) {
      records = records.filter((r) => r.device_id === deviceIdFilter);
    }

    if (startTime) {
      records = records.filter((r) => r.timestamp >= startTime);
    }

    if (endTime) {
      records = records.filter((r) => r.timestamp <= endTime);
    }

    // 🕒 Sort latest first
    records.sort((a, b) => b.timestamp - a.timestamp);

    const total = records.length;

    // 📄 PAGINATION
    const startIndex = (page - 1) * limit;
    const paginated = records.slice(startIndex, startIndex + limit);

    return NextResponse.json({
      page,
      limit,
      total,
      data: paginated,
    });
  } catch (error: any) {
    console.error("S3 fetch error:", error);
    return NextResponse.json(
      { error: "Failed to fetch images" },
      { status: 500 }
    );
  }
}
