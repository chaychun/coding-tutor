"use client";

import { useState, useEffect, useCallback } from "react";
import dynamic from "next/dynamic";
import Sidebar from "@/components/Sidebar/Sidebar";
import Chat from "@/components/Chat/Chat";
import EditorToolbar from "@/components/Editor/EditorToolbar";
import { useProjects } from "@/hooks/useProjects";
import { useSessions } from "@/hooks/useSessions";
import { useChat } from "@/hooks/useChat";
import type { Exercise } from "@/lib/types";

// Dynamically import Monaco editor to avoid SSR issues
const CodeEditor = dynamic(() => import("@/components/Editor/CodeEditor"), {
  ssr: false,
  loading: () => (
    <div className="h-full flex items-center justify-center bg-gray-900 text-gray-400">
      Loading editor...
    </div>
  ),
});

export default function Home() {
  // Project and session state
  const { projects, createProject } = useProjects();
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [agentSessionId, setAgentSessionId] = useState<string | undefined>();

  const {
    sessions,
    currentSession,
    fetchSessions,
    createSession,
    selectSession,
  } = useSessions(currentProjectId);

  // Editor state
  const [editorCode, setEditorCode] = useState("// Start coding here...\n");
  const [editorLanguage, setEditorLanguage] = useState("javascript");
  const [currentExercise, setCurrentExercise] = useState<Exercise | null>(null);

  // Chat hook
  const {
    messages,
    isStreaming,
    streamingContent,
    sendMessage,
    loadMessages,
    clearMessages,
  } = useChat({
    projectId: currentProjectId,
    sessionId: currentSessionId,
    agentSessionId,
    onExercise: (exercise) => {
      setCurrentExercise(exercise);
      setEditorCode(exercise.starterCode);
      setEditorLanguage(exercise.language);
    },
    onSessionId: setAgentSessionId,
  });

  // Fetch sessions when project changes
  useEffect(() => {
    if (currentProjectId) {
      fetchSessions(currentProjectId);
    }
  }, [currentProjectId, fetchSessions]);

  // Load session messages when session changes
  useEffect(() => {
    if (currentSession) {
      loadMessages(currentSession.messages);
      if (currentSession.agentSessionId) {
        setAgentSessionId(currentSession.agentSessionId);
      }
    } else {
      clearMessages();
      setAgentSessionId(undefined);
    }
  }, [currentSession, loadMessages, clearMessages]);

  // Handlers
  const handleSelectProject = useCallback((projectId: string) => {
    setCurrentProjectId(projectId);
    setCurrentSessionId(null);
    setCurrentExercise(null);
    setEditorCode("// Start coding here...\n");
  }, []);

  const handleSelectSession = useCallback(
    async (projectId: string, sessionId: string) => {
      setCurrentProjectId(projectId);
      setCurrentSessionId(sessionId);
      await selectSession(projectId, sessionId);
    },
    [selectSession]
  );

  const handleCreateProject = useCallback(
    async (name: string) => {
      const project = await createProject(name);
      setCurrentProjectId(project.id);
      // Auto-create first session
      const session = await createSession(project.id);
      setCurrentSessionId(session.id);
    },
    [createProject, createSession]
  );

  const handleCreateSession = useCallback(
    async (projectId: string) => {
      const session = await createSession(projectId);
      setCurrentSessionId(session.id);
      setCurrentExercise(null);
      setEditorCode("// Start coding here...\n");
      clearMessages();
    },
    [createSession, clearMessages]
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

  // Check if we need to show welcome screen
  const showWelcome = !currentProjectId || !currentSessionId;

  return (
    <div className="flex h-screen">
      {/* Sidebar */}
      <Sidebar
        projects={projects}
        sessions={sessions}
        currentProjectId={currentProjectId}
        currentSessionId={currentSessionId}
        onSelectProject={handleSelectProject}
        onSelectSession={handleSelectSession}
        onCreateProject={handleCreateProject}
        onCreateSession={handleCreateSession}
        className="w-64 border-r border-gray-200 dark:border-gray-800"
      />

      {/* Main Content */}
      {showWelcome ? (
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
      ) : (
        <main className="flex-1 flex">
          {/* Code Editor */}
          <div className="w-1/2 flex flex-col border-r border-gray-200 dark:border-gray-800">
            <EditorToolbar
              language={editorLanguage}
              hasExercise={!!currentExercise}
              isSubmitting={isStreaming}
              onSubmit={handleSubmit}
              onHint={handleHint}
            />
            <div className="flex-1">
              <CodeEditor
                code={editorCode}
                language={editorLanguage}
                onChange={setEditorCode}
              />
            </div>
          </div>

          {/* Chat */}
          <Chat
            messages={messages}
            currentExercise={currentExercise}
            isStreaming={isStreaming}
            streamingContent={streamingContent}
            onSendMessage={handleSendMessage}
            className="w-1/2"
          />
        </main>
      )}
    </div>
  );
}
