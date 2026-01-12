"use client";

import { useState, useEffect, useCallback, use } from "react";
import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import AppSidebar from "@/components/Sidebar/AppSidebar";
import { SidebarInset } from "@/components/ui/sidebar";
import Chat from "@/components/Chat/Chat";
import EditorToolbar from "@/components/Editor/EditorToolbar";
import { useProjects } from "@/hooks/useProjects";
import { useSessions } from "@/hooks/useSessions";
import { useChat } from "@/hooks/useChat";
import { Button, Spinner } from "@/components/ui";
import type { Exercise } from "@/lib/types";

// Dynamically import Monaco editor to avoid SSR issues
const CodeEditor = dynamic(() => import("@/components/Editor/CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-card text-muted-foreground">
      <div className="text-center">
        <div className="mb-2">Loading editor...</div>
      </div>
    </div>
  ),
});

interface PageProps {
  params: Promise<{ projectId: string; sessionId: string }>;
}

export default function SessionPage({ params }: PageProps) {
  const router = useRouter();
  const { projectId, sessionId } = use(params);

  // Project and session state
  const { projects, loading: projectsLoading, createProject, updateProject } = useProjects();
  const [agentSessionId, setAgentSessionId] = useState<string | undefined>();

  const {
    sessions,
    currentSession,
    loading: sessionLoading,
    error: sessionError,
    fetchSessions,
    createSession,
    selectSession,
    updateSession,
    updateSessionTitleLocal,
  } = useSessions(projectId);

  // Editor state
  const [editorCode, setEditorCode] = useState("// Start coding here...\n");
  const [editorLanguage, setEditorLanguage] = useState("javascript");
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);

  // Chat hook
  const {
    messages,
    isStreaming,
    streamingContent,
    streamingToolCalls,
    streamingContentBlocks,
    sendMessage,
    loadMessages,
  } = useChat({
    projectId,
    sessionId,
    agentSessionId,
    onExercise: (exercise) => {
      setCurrentExercise(exercise);
      setEditorCode(exercise.starterCode);
      setEditorLanguage(exercise.language);
    },
    onSessionId: setAgentSessionId,
    onTitleGenerated: (title) => {
      updateSessionTitleLocal(sessionId, title);
    },
  });

  // Fetch sessions for sidebar
  useEffect(() => {
    fetchSessions(projectId);
  }, [projectId, fetchSessions]);

  // Load session data when sessionId changes
  useEffect(() => {
    selectSession(projectId, sessionId);
  }, [projectId, sessionId, selectSession]);

  // Load session messages when currentSession is available
  useEffect(() => {
    if (currentSession) {
      loadMessages(currentSession.messages);
      if (currentSession.agentSessionId) {
        setAgentSessionId(currentSession.agentSessionId);
      }
    }
  }, [currentSession, loadMessages]);

  // Navigation handlers
  const handleSelectProject = useCallback(
    (newProjectId: string) => {
      // Just expand the project in sidebar - no navigation yet
      fetchSessions(newProjectId);
    },
    [fetchSessions]
  );

  const handleSelectSession = useCallback(
    (newProjectId: string, newSessionId: string) => {
      router.push(`/projects/${newProjectId}/sessions/${newSessionId}`);
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
    async (targetProjectId: string) => {
      const session = await createSession(targetProjectId);
      router.push(`/projects/${targetProjectId}/sessions/${session.id}`);
    },
    [createSession, router]
  );

  const handleSendMessage = useCallback(
    (message: string) => {
      sendMessage(message, "message");
    },
    [sendMessage]
  );

  const handleSubmit = useCallback(() => {
    sendMessage("", "submit", editorCode);
  }, [sendMessage, editorCode]);

  const handleHint = useCallback(() => {
    sendMessage("", "hint", editorCode);
  }, [sendMessage, editorCode]);

  const handleRenameProject = useCallback(
    async (targetProjectId: string, newName: string) => {
      await updateProject(targetProjectId, { name: newName });
    },
    [updateProject]
  );

  const handleRenameSession = useCallback(
    async (targetProjectId: string, targetSessionId: string, newTitle: string) => {
      await updateSession(targetProjectId, targetSessionId, { title: newTitle });
    },
    [updateSession]
  );

  return (
    <>
      {/* Sidebar */}
      <AppSidebar
        projects={projects}
        sessions={sessions}
        currentProjectId={projectId}
        currentSessionId={sessionId}
        loading={projectsLoading}
        onSelectProject={handleSelectProject}
        onSelectSession={handleSelectSession}
        onCreateProject={handleCreateProject}
        onCreateSession={handleCreateSession}
        onRenameProject={handleRenameProject}
        onRenameSession={handleRenameSession}
      />

      {/* Main Content */}
      {sessionLoading && !currentSession ? (
        <SidebarInset className="flex items-center justify-center">
          <div className="text-center">
            <Spinner size={32} className="mx-auto mb-4" />
            <p className="text-muted-foreground">Loading session...</p>
          </div>
        </SidebarInset>
      ) : sessionError ? (
        <SidebarInset className="flex items-center justify-center">
          <div className="text-center">
            <p className="text-destructive mb-4">Error: {sessionError}</p>
            <Button onClick={() => selectSession(projectId, sessionId)}>Retry</Button>
          </div>
        </SidebarInset>
      ) : (
        <SidebarInset className="flex flex-row overflow-hidden max-h-svh">
          {/* Code Editor */}
          <div className="w-1/2 flex flex-col border-r border-border overflow-hidden">
            <EditorToolbar
              language={editorLanguage}
              hasExercise={!!currentExercise}
              isSubmitting={isStreaming}
              onSubmit={handleSubmit}
              onHint={handleHint}
            />
            <div className="flex-1 overflow-hidden">
              <CodeEditor code={editorCode} language={editorLanguage} onChange={setEditorCode} />
            </div>
          </div>

          {/* Chat */}
          <Chat
            messages={messages}
            currentExercise={currentExercise}
            exercises={currentSession?.exercises}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            streamingToolCalls={streamingToolCalls}
            streamingContentBlocks={streamingContentBlocks}
            loading={sessionLoading || !currentSession}
            onSendMessage={handleSendMessage}
            className="w-1/2 overflow-hidden"
          />
        </SidebarInset>
      )}
    </>
  );
}
