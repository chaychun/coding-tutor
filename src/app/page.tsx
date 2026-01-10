"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import Sidebar from "@/components/Sidebar/Sidebar";
import { useProjects } from "@/hooks/useProjects";
import { useSessions } from "@/hooks/useSessions";

export default function Home() {
  const router = useRouter();
  const { projects, loading: projectsLoading, createProject, updateProject } = useProjects();
  const { sessions, createSession, fetchSessions, updateSession } = useSessions(null);

  const handleSelectProject = useCallback(
    (projectId: string) => {
      fetchSessions(projectId);
    },
    [fetchSessions]
  );

  const handleSelectSession = useCallback(
    (projectId: string, sessionId: string) => {
      router.push(`/projects/${projectId}/sessions/${sessionId}`);
    },
    [router]
  );

  const handleCreateProject = useCallback(
    async (name: string) => {
      const project = await createProject(name);
      const session = await createSession(project.id);
      router.push(`/projects/${project.id}/sessions/${session.id}`);
    },
    [createProject, createSession, router]
  );

  const handleCreateSession = useCallback(
    async (projectId: string) => {
      const session = await createSession(projectId);
      router.push(`/projects/${projectId}/sessions/${session.id}`);
    },
    [createSession, router]
  );

  const handleRenameProject = useCallback(
    async (projectId: string, newName: string) => {
      await updateProject(projectId, { name: newName });
    },
    [updateProject]
  );

  const handleRenameSession = useCallback(
    async (projectId: string, sessionId: string, newTitle: string) => {
      await updateSession(projectId, sessionId, { title: newTitle });
    },
    [updateSession]
  );

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar
        projects={projects}
        sessions={sessions}
        currentProjectId={null}
        currentSessionId={null}
        loading={projectsLoading}
        onSelectProject={handleSelectProject}
        onSelectSession={handleSelectSession}
        onCreateProject={handleCreateProject}
        onCreateSession={handleCreateSession}
        onRenameProject={handleRenameProject}
        onRenameSession={handleRenameSession}
        className="w-64 border-r border-gray-200 dark:border-gray-800"
      />

      {/* Welcome Screen */}
      <main className="flex-1 flex items-center justify-center bg-gray-50 dark:bg-gray-950">
        <div className="text-center">
          <h2 className="text-2xl font-bold mb-4">Welcome to Coding Tutor</h2>
          <p className="text-gray-500 mb-6">
            Create a project or select an existing one to start learning.
          </p>
          <button
            onClick={() => handleCreateProject("My First Project")}
            className="px-6 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            Create Your First Project
          </button>
        </div>
      </main>
    </div>
  );
}
