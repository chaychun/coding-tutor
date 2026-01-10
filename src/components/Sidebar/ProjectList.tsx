"use client";

import { useState, useCallback } from "react";
import type { Project, Session } from "@/lib/types";
import { InlineEdit } from "@/components/UI";
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuTrigger,
} from "@/components/UI/context-menu";
import { Button } from "@/components/UI/button";

interface ProjectListProps {
  projects: Project[];
  sessions: Session[];
  currentProjectId: string | null;
  currentSessionId: string | null;
  loading?: boolean;
  onSelectProject: (projectId: string) => void;
  onSelectSession: (projectId: string, sessionId: string) => void;
  onCreateSession: (projectId: string) => void;
  onRenameProject?: (projectId: string, newName: string) => void;
  onRenameSession?: (projectId: string, sessionId: string, newTitle: string) => void;
}

interface EditingState {
  type: "project" | "session";
  id: string;
  projectId?: string;
}

export default function ProjectList({
  projects,
  sessions,
  currentProjectId,
  currentSessionId,
  loading = false,
  onSelectProject,
  onSelectSession,
  onCreateSession,
  onRenameProject,
  onRenameSession,
}: ProjectListProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(currentProjectId ? [currentProjectId] : [])
  );
  const [editingItem, setEditingItem] = useState<EditingState | null>(null);

  const toggleProject = (projectId: string) => {
    const newExpanded = new Set(expandedProjects);
    if (newExpanded.has(projectId)) {
      newExpanded.delete(projectId);
    } else {
      newExpanded.add(projectId);
    }
    setExpandedProjects(newExpanded);
    onSelectProject(projectId);
  };

  const getProjectSessions = (projectId: string) => {
    return sessions.filter((s) => s.projectId === projectId);
  };

  const handleSaveRename = useCallback(
    (newValue: string) => {
      if (!editingItem) return;

      if (editingItem.type === "project") {
        onRenameProject?.(editingItem.id, newValue);
      } else if (editingItem.type === "session" && editingItem.projectId) {
        onRenameSession?.(editingItem.projectId, editingItem.id, newValue);
      }
      setEditingItem(null);
    },
    [editingItem, onRenameProject, onRenameSession]
  );

  const handleCancelRename = useCallback(() => {
    setEditingItem(null);
  }, []);

  if (loading) {
    // Skeleton that matches the project list item layout
    return (
      <div className="space-y-1">
        {[1, 2, 3].map((i) => (
          <div key={i} className="flex items-center gap-2 px-3 py-2 rounded-lg">
            <div className="w-3 h-3 bg-muted rounded animate-pulse"></div>
            <div className="flex-1 h-4 bg-muted rounded animate-pulse"></div>
            <div className="w-4 h-4 bg-muted rounded animate-pulse"></div>
          </div>
        ))}
      </div>
    );
  }

  if (projects.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground text-sm">
        No projects yet.
        <br />
        Create one to get started!
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {projects.map((project) => {
        const isExpanded = expandedProjects.has(project.id);
        const isSelected = project.id === currentProjectId;
        const projectSessions = getProjectSessions(project.id);
        const isEditingProject = editingItem?.type === "project" && editingItem.id === project.id;

        return (
          <div key={project.id}>
            {/* Project Header */}
            <ContextMenu>
              <ContextMenuTrigger asChild>
                {isEditingProject ? (
                  <div
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                    }`}
                  >
                    <span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
                    <InlineEdit
                      value={project.name}
                      isEditing={isEditingProject}
                      onSave={handleSaveRename}
                      onCancel={handleCancelRename}
                      className="font-medium"
                    />
                    <span className="text-xs text-muted-foreground">{projectSessions.length}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => toggleProject(project.id)}
                    className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                      isSelected ? "bg-accent text-accent-foreground" : "hover:bg-accent/50"
                    }`}
                  >
                    <span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
                    <span className="font-medium truncate flex-1">{project.name}</span>
                    <span className="text-xs text-muted-foreground">{projectSessions.length}</span>
                  </button>
                )}
              </ContextMenuTrigger>
              <ContextMenuContent>
                <ContextMenuItem
                  onClick={() => setEditingItem({ type: "project", id: project.id })}
                >
                  Rename
                </ContextMenuItem>
              </ContextMenuContent>
            </ContextMenu>

            {/* Sessions List */}
            {isExpanded && (
              <div className="ml-4 mt-1 space-y-1">
                {projectSessions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-muted-foreground">No sessions yet</div>
                ) : (
                  projectSessions.map((session) => {
                    const isSessionSelected = session.id === currentSessionId;
                    const isEditingSession =
                      editingItem?.type === "session" && editingItem.id === session.id;

                    return (
                      <ContextMenu key={session.id}>
                        <ContextMenuTrigger asChild>
                          {isEditingSession ? (
                            <div
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-sm transition-colors ${
                                isSessionSelected
                                  ? "bg-accent/70 text-accent-foreground"
                                  : "hover:bg-accent/50"
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  session.status === "active"
                                    ? "bg-green-500"
                                    : "bg-muted-foreground/30"
                                }`}
                              />
                              <InlineEdit
                                value={session.title}
                                isEditing={isEditingSession}
                                onSave={handleSaveRename}
                                onCancel={handleCancelRename}
                              />
                            </div>
                          ) : (
                            <button
                              onClick={() => onSelectSession(project.id, session.id)}
                              className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-sm transition-colors ${
                                isSessionSelected
                                  ? "bg-accent/70 text-accent-foreground"
                                  : "hover:bg-accent/50"
                              }`}
                            >
                              <span
                                className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                  session.status === "active"
                                    ? "bg-green-500"
                                    : "bg-muted-foreground/30"
                                }`}
                              />
                              <span className="truncate flex-1">{session.title}</span>
                            </button>
                          )}
                        </ContextMenuTrigger>
                        <ContextMenuContent>
                          <ContextMenuItem
                            onClick={() =>
                              setEditingItem({
                                type: "session",
                                id: session.id,
                                projectId: project.id,
                              })
                            }
                          >
                            Rename
                          </ContextMenuItem>
                        </ContextMenuContent>
                      </ContextMenu>
                    );
                  })
                )}

                {/* New Session Button */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onCreateSession(project.id)}
                  className="w-full justify-start px-3 py-1.5 h-auto text-xs text-muted-foreground hover:text-foreground"
                >
                  + New Session
                </Button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
