"use client";

import { useState, useEffect, useCallback, use } from "react";
import { useRouter } from "next/navigation";
import AppSidebar from "@/components/Sidebar/AppSidebar";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import Chat from "@/components/Chat/Chat";
import { useProjects } from "@/hooks/useProjects";
import { useSessions } from "@/hooks/useSessions";
import { useChat } from "@/hooks/useChat";
import { Button, Spinner } from "@/components/ui";

interface PageProps {
  params: Promise<{ projectId: string; sessionId: string }>;
}

export default function SessionPage({ params }: PageProps) {
  const router = useRouter();
  const { projectId, sessionId } = use(params);

  // Project and session state
  const { projects, loading: projectsLoading, createProject, updateProject } = useProjects();
  const [agentSessionId, setAgentSessionId] = useState<string | undefined>();
  const [testingMode, setTestingMode] = useState(false);

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

  // Chat hook with exercise state
  const {
    messages,
    isStreaming,
    streamingContent,
    streamingToolCalls,
    streamingContentBlocks,
    sendMessage,
    loadMessages,
    activeExercise,
    setActiveExercise,
    exercises,
    setExercises,
    submitExercise,
    skipExercise,
    retryExercise,
    conceptQuestions,
    setConceptQuestions,
    answerConceptQuestion,
  } = useChat({
    projectId,
    sessionId,
    agentSessionId,
    testingMode,
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
  // Note: We use selectSession directly and load messages from the returned session,
  // NOT from currentSession state, to avoid re-loading messages when only the title updates
  useEffect(() => {
    const loadSessionData = async () => {
      const session = await selectSession(projectId, sessionId);
      if (session) {
        loadMessages(session.messages);
        if (session.exercises) {
          setExercises(session.exercises);
        }
        if (session.conceptQuestions) {
          setConceptQuestions(session.conceptQuestions);
        }
        if (session.agentSessionId) {
          setAgentSessionId(session.agentSessionId);
        }
      }
    };
    loadSessionData();
  }, [
    projectId,
    sessionId,
    selectSession,
    loadMessages,
    setExercises,
    setConceptQuestions,
    setAgentSessionId,
  ]);

  // Restore active exercise when session loads
  // Include needs_retry status since the user should be able to retry immediately
  useEffect(() => {
    if (currentSession?.activeExerciseId && currentSession.exercises) {
      const exercise = currentSession.exercises[currentSession.activeExerciseId];
      if (
        exercise &&
        (exercise.status === "active" ||
          exercise.status === "pending_review" ||
          exercise.status === "needs_retry")
      ) {
        setActiveExercise(exercise);
      }
    }
  }, [currentSession?.activeExerciseId, currentSession?.exercises, setActiveExercise]);

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
      sendMessage(message, "message", undefined, undefined, testingMode);
    },
    [sendMessage, testingMode]
  );

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
    <SidebarProvider className="h-svh overflow-hidden">
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
      <SidebarInset className="flex flex-col overflow-hidden">
        {/* Loading State */}
        {sessionLoading && !currentSession ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <Spinner size={32} className="mx-auto mb-4" />
              <p className="text-muted-foreground">Loading session...</p>
            </div>
          </div>
        ) : sessionError ? (
          <div className="flex items-center justify-center h-full">
            <div className="text-center">
              <p className="text-destructive mb-4">Error: {sessionError}</p>
              <Button onClick={() => selectSession(projectId, sessionId)}>Retry</Button>
            </div>
          </div>
        ) : (
          <Chat
            messages={messages}
            exercises={exercises}
            conceptQuestions={conceptQuestions}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            streamingToolCalls={streamingToolCalls}
            streamingContentBlocks={streamingContentBlocks}
            loading={sessionLoading || !currentSession}
            onSendMessage={handleSendMessage}
            activeExercise={activeExercise}
            onExerciseSubmit={submitExercise}
            onExerciseSkip={skipExercise}
            onExerciseReset={() => {}}
            onExerciseRetry={retryExercise}
            onConceptAnswer={answerConceptQuestion}
            testingMode={testingMode}
            onTestingModeChange={setTestingMode}
          />
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
