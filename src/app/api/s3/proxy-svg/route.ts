import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const url = req.nextUrl.searchParams.get("url");

  if (!url) {
    return NextResponse.json({ error: "Missing URL parameter" }, { status: 400 });
  }

  try {
    const response = await fetch(url);
    
    if (!response.ok) {
      throw new Error(`Failed to fetch SVG: ${response.statusText}`);
    }

    const svgContent = await response.text();

    // Verify it's actually an SVG (basic check)
    if (!svgContent.trim().toLowerCase().startsWith("<svg") && !svgContent.includes("<svg")) {
      return NextResponse.json({ error: "File is not a valid SVG" }, { status: 400 });
    }

    return new NextResponse(svgContent, {
      headers: {
        "Content-Type": "image/svg+xml",
        "Cache-Control": "public, max-age=3600", // Cache for 1 hour
      },
    });
  } catch (error) {
    console.error("[proxy-svg] Error fetching SVG:", error);
    return NextResponse.json(
      { error: "Failed to fetch SVG from the provided URL" },
      { status: 500 }
    );
  }
}
