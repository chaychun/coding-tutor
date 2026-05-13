"use client";

import { useState } from "react";
import { GraduationCap, Plus } from "@phosphor-icons/react";
import type { Project, Session } from "@/lib/types";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupAction,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuSkeleton,
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useIsTauri } from "@/hooks/use-tauri";
import { cn } from "@/lib/utils";
import CreateProjectModal from "./CreateProjectModal";
import ProjectMenu from "./ProjectMenu";

interface AppSidebarProps {
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
}

export default function AppSidebar({
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
}: AppSidebarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const isTauri = useIsTauri();

  const handleCreateProject = (name: string) => {
    onCreateProject(name);
    setIsModalOpen(false);
  };

  return (
    <Sidebar>
      <SidebarHeader className={cn("relative border-b border-sidebar-border", isTauri && "pt-10")}>
        {isTauri && <div data-tauri-drag-region className="absolute inset-x-0 top-0 h-10 z-20" />}
        <div data-tauri-drag-region className="flex items-center gap-2 px-2">
          <GraduationCap className="size-5" weight="bold" />
          <span className="text-sm font-bold">Coding Tutor</span>
        </div>
      </SidebarHeader>

      {/* Content */}
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Projects</SidebarGroupLabel>
          <SidebarGroupAction title="New Project" onClick={() => setIsModalOpen(true)}>
            <Plus className="size-4" />
            <span className="sr-only">New Project</span>
          </SidebarGroupAction>
          <SidebarGroupContent>
            {loading ? (
              <SidebarMenu>
                {[1, 2, 3].map((i) => (
                  <SidebarMenuSkeleton key={i} showIcon />
                ))}
              </SidebarMenu>
            ) : projects.length === 0 ? (
              <div className="text-center py-8 px-2 text-muted-foreground text-xs">
                No projects yet.
                <br />
                Create one to get started!
              </div>
            ) : (
              <ProjectMenu
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
            )}
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      {/* Footer */}
      <SidebarFooter className="border-t border-sidebar-border">
        <ThemeToggle />
      </SidebarFooter>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />
    </Sidebar>
  );
}
