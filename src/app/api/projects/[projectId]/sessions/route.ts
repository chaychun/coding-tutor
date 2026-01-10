import { NextResponse } from "next/server";
import * as storage from "@/lib/storage";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId]/sessions - List all sessions for a project
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const sessions = await storage.listSessions(projectId);
    return NextResponse.json(sessions);
  } catch (error) {
    console.error("Error listing sessions:", error);
    return NextResponse.json(
      { error: "Failed to list sessions" },
      { status: 500 }
    );
  }
}

// POST /api/projects/[projectId]/sessions - Create a new session
export async function POST(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { title } = body;

    const session = await storage.createSession(projectId, title);
    return NextResponse.json(session, { status: 201 });
  } catch (error) {
    console.error("Error creating session:", error);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 }
    );
  }
}
