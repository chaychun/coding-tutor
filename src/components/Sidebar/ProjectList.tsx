"use client";

import { useState, useCallback } from "react";
import type { Project, Session } from "@/lib/types";
import { ContextMenu, InlineEdit } from "@/components/UI";
import type { ContextMenuItem } from "@/components/UI";

interface ProjectListProps {
  projects: Project[];
  sessions: Session[];
  currentProjectId: string | null;
  currentSessionId: string | null;
  onSelectProject: (projectId: string) => void;
  onSelectSession: (projectId: string, sessionId: string) => void;
  onCreateSession: (projectId: string) => void;
  onRenameProject?: (projectId: string, newName: string) => void;
  onRenameSession?: (projectId: string, sessionId: string, newTitle: string) => void;
}

interface ContextMenuState {
  type: "project" | "session";
  id: string;
  projectId?: string;
  position: { x: number; y: number };
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
  onSelectProject,
  onSelectSession,
  onCreateSession,
  onRenameProject,
  onRenameSession,
}: ProjectListProps) {
  const [expandedProjects, setExpandedProjects] = useState<Set<string>>(
    new Set(currentProjectId ? [currentProjectId] : [])
  );
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
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

  const handleContextMenu = useCallback(
    (
      e: React.MouseEvent,
      type: "project" | "session",
      id: string,
      projectId?: string
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({
        type,
        id,
        projectId,
        position: { x: e.clientX, y: e.clientY },
      });
    },
    []
  );

  const handleRename = useCallback(() => {
    if (contextMenu) {
      setEditingItem({
        type: contextMenu.type,
        id: contextMenu.id,
        projectId: contextMenu.projectId,
      });
      setContextMenu(null);
    }
  }, [contextMenu]);

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

  const getContextMenuItems = useCallback((): ContextMenuItem[] => {
    return [{ label: "Rename", onClick: handleRename }];
  }, [handleRename]);

  if (projects.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500 text-sm">
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
        const isEditingProject =
          editingItem?.type === "project" && editingItem.id === project.id;

        return (
          <div key={project.id}>
            {/* Project Header */}
            {isEditingProject ? (
              <div
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  isSelected
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
                onContextMenu={(e) =>
                  handleContextMenu(e, "project", project.id)
                }
              >
                <span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
                <InlineEdit
                  value={project.name}
                  isEditing={isEditingProject}
                  onSave={handleSaveRename}
                  onCancel={handleCancelRename}
                  className="font-medium"
                />
                <span className="text-xs text-gray-400">
                  {projectSessions.length}
                </span>
              </div>
            ) : (
              <button
                onClick={() => toggleProject(project.id)}
                onContextMenu={(e) =>
                  handleContextMenu(e, "project", project.id)
                }
                className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-sm transition-colors ${
                  isSelected
                    ? "bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300"
                    : "hover:bg-gray-100 dark:hover:bg-gray-800"
                }`}
              >
                <span className="text-xs">{isExpanded ? "▼" : "▶"}</span>
                <span className="font-medium truncate flex-1">
                  {project.name}
                </span>
                <span className="text-xs text-gray-400">
                  {projectSessions.length}
                </span>
              </button>
            )}

            {/* Sessions List */}
            {isExpanded && (
              <div className="ml-4 mt-1 space-y-1">
                {projectSessions.length === 0 ? (
                  <div className="px-3 py-2 text-xs text-gray-400">
                    No sessions yet
                  </div>
                ) : (
                  projectSessions.map((session) => {
                    const isSessionSelected = session.id === currentSessionId;
                    const isEditingSession =
                      editingItem?.type === "session" &&
                      editingItem.id === session.id;

                    return isEditingSession ? (
                      <div
                        key={session.id}
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-sm transition-colors ${
                          isSessionSelected
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                        onContextMenu={(e) =>
                          handleContextMenu(
                            e,
                            "session",
                            session.id,
                            project.id
                          )
                        }
                      >
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            session.status === "active"
                              ? "bg-green-500"
                              : "bg-gray-300 dark:bg-gray-600"
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
                        key={session.id}
                        onClick={() => onSelectSession(project.id, session.id)}
                        onContextMenu={(e) =>
                          handleContextMenu(
                            e,
                            "session",
                            session.id,
                            project.id
                          )
                        }
                        className={`w-full flex items-center gap-2 px-3 py-1.5 rounded-lg text-left text-sm transition-colors ${
                          isSessionSelected
                            ? "bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400"
                            : "hover:bg-gray-100 dark:hover:bg-gray-800"
                        }`}
                      >
                        <span
                          className={`w-2 h-2 rounded-full flex-shrink-0 ${
                            session.status === "active"
                              ? "bg-green-500"
                              : "bg-gray-300 dark:bg-gray-600"
                          }`}
                        />
                        <span className="truncate flex-1">{session.title}</span>
                      </button>
                    );
                  })
                )}

                {/* New Session Button */}
                <button
                  onClick={() => onCreateSession(project.id)}
                  className="w-full px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 text-left"
                >
                  + New Session
                </button>
              </div>
            )}
          </div>
        );
      })}

      {/* Context Menu */}
      <ContextMenu
        isOpen={contextMenu !== null}
        position={contextMenu?.position ?? { x: 0, y: 0 }}
        onClose={() => setContextMenu(null)}
        items={getContextMenuItems()}
      />
    </div>
  );
}
