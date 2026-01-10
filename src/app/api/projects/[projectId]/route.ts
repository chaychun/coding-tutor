import { NextResponse } from "next/server";
import * as storage from "@/lib/storage";

interface RouteParams {
  params: Promise<{ projectId: string }>;
}

// GET /api/projects/[projectId] - Get a project
export async function GET(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const project = await storage.getProject(projectId);

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error getting project:", error);
    return NextResponse.json(
      { error: "Failed to get project" },
      { status: 500 }
    );
  }
}

// PATCH /api/projects/[projectId] - Update a project
export async function PATCH(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const body = await request.json();
    const { name, description } = body;

    const project = await storage.updateProject(projectId, { name, description });

    if (!project) {
      return NextResponse.json(
        { error: "Project not found" },
        { status: 404 }
      );
    }

    return NextResponse.json(project);
  } catch (error) {
    console.error("Error updating project:", error);
    return NextResponse.json(
      { error: "Failed to update project" },
      { status: 500 }
    );
  }
}

// DELETE /api/projects/[projectId] - Delete a project
export async function DELETE(request: Request, { params }: RouteParams) {
  try {
    const { projectId } = await params;
    const success = await storage.deleteProject(projectId);

    if (!success) {
      return NextResponse.json(
        { error: "Failed to delete project" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting project:", error);
    return NextResponse.json(
      { error: "Failed to delete project" },
      { status: 500 }
    );
  }
}
