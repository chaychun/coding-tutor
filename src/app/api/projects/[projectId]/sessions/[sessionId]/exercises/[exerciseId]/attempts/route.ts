import { NextResponse } from "next/server";
import * as storage from "@/lib/storage";

// Force dynamic to prevent any caching
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ projectId: string; sessionId: string; exerciseId: string }>;
}

// POST /api/projects/[projectId]/sessions/[sessionId]/exercises/[exerciseId]/attempts
// Submit an exercise attempt
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { projectId, sessionId, exerciseId } = await params;
    const body = await request.json();

    const { attemptId, code, blankValues } = body;

    if (!attemptId || typeof code !== "string") {
      return NextResponse.json({ error: "attemptId and code are required" }, { status: 400 });
    }

    // Validate blankValues if provided — must be a plain object with string values
    if (blankValues !== undefined) {
      if (
        typeof blankValues !== "object" ||
        blankValues === null ||
        Array.isArray(blankValues) ||
        !Object.values(blankValues).every((v) => typeof v === "string")
      ) {
        return NextResponse.json(
          { error: "blankValues must be an object with string values" },
          { status: 400 }
        );
      }
    }

    const attempt = await storage.submitExerciseAttempt(
      projectId,
      sessionId,
      exerciseId,
      attemptId,
      code,
      blankValues
    );

    if (!attempt) {
      return NextResponse.json({ error: "Exercise not found" }, { status: 404 });
    }

    return NextResponse.json(attempt);
  } catch (error) {
    console.error("Error submitting attempt:", error);
    return NextResponse.json({ error: "Failed to submit attempt" }, { status: 500 });
  }
}
