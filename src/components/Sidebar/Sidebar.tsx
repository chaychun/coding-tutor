"use client";

import { useState } from "react";
import type { Project, Session } from "@/lib/types";
import ProjectList from "./ProjectList";

interface SidebarProps {
  projects: Project[];
  sessions: Session[];
  currentProjectId: string | null;
  currentSessionId: string | null;
  onSelectProject: (projectId: string) => void;
  onSelectSession: (projectId: string, sessionId: string) => void;
  onCreateProject: (name: string) => void;
  onCreateSession: (projectId: string) => void;
  className?: string;
}

export default function Sidebar({
  projects,
  sessions,
  currentProjectId,
  currentSessionId,
  onSelectProject,
  onSelectSession,
  onCreateProject,
  onCreateSession,
  className = "",
}: SidebarProps) {
  const [newProjectName, setNewProjectName] = useState("");
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateProject = () => {
    if (newProjectName.trim()) {
      onCreateProject(newProjectName.trim());
      setNewProjectName("");
      setIsCreating(false);
    }
  };

  return (
    <aside className={`flex flex-col bg-gray-50 dark:bg-gray-900 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200 dark:border-gray-800">
        <h1 className="text-xl font-bold">Coding Tutor</h1>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-2">
        <ProjectList
          projects={projects}
          sessions={sessions}
          currentProjectId={currentProjectId}
          currentSessionId={currentSessionId}
          onSelectProject={onSelectProject}
          onSelectSession={onSelectSession}
          onCreateSession={onCreateSession}
        />
      </div>

      {/* Create Project */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        {isCreating ? (
          <div className="space-y-2">
            <input
              type="text"
              value={newProjectName}
              onChange={(e) => setNewProjectName(e.target.value)}
              placeholder="Project name..."
              className="w-full px-3 py-2 text-sm border rounded-lg dark:bg-gray-800 dark:border-gray-700"
              autoFocus
              onKeyDown={(e) => {
                if (e.key === "Enter") handleCreateProject();
                if (e.key === "Escape") setIsCreating(false);
              }}
            />
            <div className="flex gap-2">
              <button
                onClick={handleCreateProject}
                className="flex-1 px-3 py-1 text-sm bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Create
              </button>
              <button
                onClick={() => setIsCreating(false)}
                className="px-3 py-1 text-sm border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => setIsCreating(true)}
            className="w-full px-3 py-2 text-sm border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 dark:border-gray-700"
          >
            + New Project
          </button>
        )}
      </div>
    </aside>
  );
}
