"use client";

import { useState } from "react";
import type { Project, Session } from "@/lib/types";
import ProjectList from "./ProjectList";
import CreateProjectModal from "./CreateProjectModal";

interface SidebarProps {
  projects: Project[];
  sessions: Session[];
  currentProjectId: string | null;
  currentSessionId: string | null;
  onSelectProject: (projectId: string) => void;
  onSelectSession: (projectId: string, sessionId: string) => void;
  onCreateProject: (name: string) => void;
  onCreateSession: (projectId: string) => void;
  onRenameProject?: (projectId: string, newName: string) => void;
  onRenameSession?: (projectId: string, sessionId: string, newTitle: string) => void;
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
  onRenameProject,
  onRenameSession,
  className = "",
}: SidebarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleCreateProject = (name: string) => {
    onCreateProject(name);
    setIsModalOpen(false);
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
          onRenameProject={onRenameProject}
          onRenameSession={onRenameSession}
        />
      </div>

      {/* Create Project */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full px-3 py-2 text-sm border rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 dark:border-gray-700"
        >
          + New Project
        </button>
      </div>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </aside>
  );
}
