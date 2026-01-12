import { NextResponse } from "next/server";
import * as storage from "@/lib/storage";

// Force dynamic to prevent any caching
export const dynamic = "force-dynamic";

interface RouteParams {
  params: Promise<{ projectId: string; sessionId: string }>;
}

// GET /api/projects/[projectId]/sessions/[sessionId] - Get a session
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { projectId, sessionId } = await params;
    const session = await storage.getSession(projectId, sessionId);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session, {
      headers: {
        "Cache-Control": "no-store, no-cache, must-revalidate",
      },
    });
  } catch (error) {
    console.error("Error getting session:", error);
    return NextResponse.json({ error: "Failed to get session" }, { status: 500 });
  }
}

// PATCH /api/projects/[projectId]/sessions/[sessionId] - Update a session
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { projectId, sessionId } = await params;
    const body = await request.json();

    const session = await storage.updateSession(projectId, sessionId, body);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    return NextResponse.json(session);
  } catch (error) {
    console.error("Error updating session:", error);
    return NextResponse.json({ error: "Failed to update session" }, { status: 500 });
  }
}
