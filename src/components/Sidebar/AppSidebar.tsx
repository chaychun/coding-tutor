"use client";

import { useState } from "react";
import { GraduationCap, Plus, ShieldCheck, WarningCircle } from "@phosphor-icons/react";
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
} from "@/components/ui/sidebar";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { Button } from "@/components/ui/button";
import AuthSettingsModal from "@/components/Auth/AuthSettingsModal";
import { useCredentialStatus } from "@/hooks/useCredentialStatus";
import { useIsTauri } from "@/hooks/use-tauri";
import { cn } from "@/lib/utils";
import CreateProjectModal from "./CreateProjectModal";
import ProjectMenu from "./ProjectMenu";

interface AppSidebarProps {
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
}

export default function AppSidebar({
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
}: AppSidebarProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isAuthOpen, setIsAuthOpen] = useState(false);
  const { status: credStatus } = useCredentialStatus();
  const credConfigured = credStatus.active_kind !== null;
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
            {projects.length === 0 ? (
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
      <SidebarFooter className="border-t border-sidebar-border !flex-row items-center justify-between gap-1 px-2">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => setIsAuthOpen(true)}
          title={credConfigured ? "Anthropic authentication" : "Set up Anthropic authentication"}
          className="relative"
        >
          {credConfigured ? (
            <ShieldCheck size={16} weight="duotone" />
          ) : (
            <WarningCircle size={16} weight="fill" className="text-destructive" />
          )}
          <span className="sr-only">Authentication</span>
          {!credConfigured && (
            <span className="absolute top-1 right-1 size-1.5 rounded-full bg-destructive" />
          )}
        </Button>
        <ThemeToggle />
      </SidebarFooter>

      <CreateProjectModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onCreate={handleCreateProject}
      />

      <AuthSettingsModal isOpen={isAuthOpen} onClose={() => setIsAuthOpen(false)} />
    </Sidebar>
  );
}
