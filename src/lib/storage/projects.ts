import * as path from "path";
import type { Project } from "../types";
import {
  getDataPath,
  readJsonFile,
  writeJsonFile,
  listDirectories,
  generateId,
  ensureDir,
} from "./utils";

// Get project directory path
function getProjectDir(projectId: string): string {
  return path.join(getDataPath(), "projects", projectId);
}

// Get project file path
function getProjectFilePath(projectId: string): string {
  return path.join(getProjectDir(projectId), "project.json");
}

// Create a new project
export async function createProject(name: string, description?: string): Promise<Project> {
  const id = generateId();
  const now = new Date().toISOString();

  const project: Project = {
    id,
    name,
    description,
    createdAt: now,
    updatedAt: now,
  };

  const projectDir = getProjectDir(id);
  await ensureDir(projectDir);
  await ensureDir(path.join(projectDir, "progress"));
  await ensureDir(path.join(projectDir, "sessions"));
  await writeJsonFile(getProjectFilePath(id), project);

  return project;
}

// Get a project by ID
export async function getProject(projectId: string): Promise<Project | null> {
  return readJsonFile<Project>(getProjectFilePath(projectId));
}

// Update a project
export async function updateProject(
  projectId: string,
  updates: Partial<Omit<Project, "id" | "createdAt">>
): Promise<Project | null> {
  const project = await getProject(projectId);
  if (!project) return null;

  const updatedProject: Project = {
    ...project,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeJsonFile(getProjectFilePath(projectId), updatedProject);
  return updatedProject;
}

// Delete a project
export async function deleteProject(projectId: string): Promise<boolean> {
  const fs = await import("fs/promises");
  try {
    await fs.rm(getProjectDir(projectId), { recursive: true, force: true });
    return true;
  } catch {
    return false;
  }
}

// List all projects
export async function listProjects(): Promise<Project[]> {
  const projectsDir = path.join(getDataPath(), "projects");
  const projectIds = await listDirectories(projectsDir);

  const projects: Project[] = [];
  for (const id of projectIds) {
    const project = await getProject(id);
    if (project) {
      projects.push(project);
    }
  }

  // Sort by updatedAt descending (most recent first)
  return projects.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
