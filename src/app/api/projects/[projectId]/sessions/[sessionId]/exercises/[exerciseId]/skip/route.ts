import { NextResponse } from "next/server";
import * as storage from "@/lib/storage";

// Force dynamic to prevent any caching
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ projectId: string; sessionId: string; exerciseId: string }>;
}

// POST /api/projects/[projectId]/sessions/[sessionId]/exercises/[exerciseId]/skip
// Skip an exercise - handles the skip action directly without relying on AI
export async function POST(_request: Request, { params }: RouteParams) {
  try {
    const { projectId, sessionId, exerciseId } = await params;

    // Update exercise status to skipped
    const exerciseFound = await storage.updateExerciseInSession(projectId, sessionId, exerciseId, {
      status: "skipped",
    });

    if (!exerciseFound) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    // Clear active exercise ID
    await storage.setActiveExerciseId(projectId, sessionId, null);

    return NextResponse.json({ success: true, exerciseId, status: "skipped" });
  } catch (error) {
    console.error("Error skipping exercise:", error);
    return NextResponse.json({ error: "Failed to skip exercise" }, { status: 500 });
  }
}
