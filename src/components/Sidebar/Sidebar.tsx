"use client";

import { useState } from "react";
import type { Project, Session } from "@/lib/types";
import ProjectList from "./ProjectList";
import CreateProjectModal from "./CreateProjectModal";
import { Button } from "@/components/UI/button";

interface SidebarProps {
  projects: Project[];
  sessions: Session[];
  currentProjectId: string | null;
  currentSessionId: string | null;
  loading?: boolean;
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
  loading = false,
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
    <aside className={`flex flex-col bg-muted/50 ${className}`}>
      {/* Header */}
      <div className="p-4 border-b">
        <h1 className="text-xl font-bold">Coding Tutor</h1>
      </div>

      {/* Projects List */}
      <div className="flex-1 overflow-y-auto p-2">
        <ProjectList
          projects={projects}
          sessions={sessions}
          currentProjectId={currentProjectId}
          currentSessionId={currentSessionId}
          loading={loading}
          onSelectProject={onSelectProject}
          onSelectSession={onSelectSession}
          onCreateSession={onCreateSession}
          onRenameProject={onRenameProject}
          onRenameSession={onRenameSession}
        />
      </div>

      {/* Create Project */}
      <div className="p-4 border-t">
        <Button variant="outline" className="w-full" onClick={() => setIsModalOpen(true)}>
          + New Project
        </Button>
      </div>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </aside>
  );
}
