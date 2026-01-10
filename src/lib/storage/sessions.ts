import * as path from "path";
import type { Session, Message, ExerciseRecord } from "../types";
import { getDataPath, readJsonFile, writeJsonFile, listFiles, generateId } from "./utils";

// Get sessions directory for a project
function getSessionsDir(projectId: string): string {
  return path.join(getDataPath(), "projects", projectId, "sessions");
}

// Get session file path
function getSessionFilePath(projectId: string, sessionId: string): string {
  return path.join(getSessionsDir(projectId), `${sessionId}.json`);
}

// Create a new session
export async function createSession(projectId: string, title?: string): Promise<Session> {
  const id = generateId();
  const now = new Date().toISOString();

  const session: Session = {
    id,
    projectId,
    createdAt: now,
    updatedAt: now,
    topics: [],
    title: title || "Untitled Session",
    messages: [],
    exercises: [],
    status: "active",
  };

  await writeJsonFile(getSessionFilePath(projectId, id), session);
  return session;
}

// Get a session by ID
export async function getSession(projectId: string, sessionId: string): Promise<Session | null> {
  return readJsonFile<Session>(getSessionFilePath(projectId, sessionId));
}

// Update a session
export async function updateSession(
  projectId: string,
  sessionId: string,
  updates: Partial<Omit<Session, "id" | "projectId" | "createdAt">>
): Promise<Session | null> {
  const session = await getSession(projectId, sessionId);
  if (!session) return null;

  const updatedSession: Session = {
    ...session,
    ...updates,
    updatedAt: new Date().toISOString(),
  };

  await writeJsonFile(getSessionFilePath(projectId, sessionId), updatedSession);
  return updatedSession;
}

// Add a message to a session
export async function addMessageToSession(
  projectId: string,
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<Message | null> {
  const session = await getSession(projectId, sessionId);
  if (!session) return null;

  const message: Message = {
    id: generateId(),
    role,
    content,
    timestamp: new Date().toISOString(),
  };

  session.messages.push(message);
  session.updatedAt = new Date().toISOString();

  await writeJsonFile(getSessionFilePath(projectId, sessionId), session);
  return message;
}

// Add an exercise record to a session
export async function addExerciseToSession(
  projectId: string,
  sessionId: string,
  title: string
): Promise<ExerciseRecord | null> {
  const session = await getSession(projectId, sessionId);
  if (!session) return null;

  const exercise: ExerciseRecord = {
    id: generateId(),
    title,
    submitted: false,
  };

  session.exercises.push(exercise);
  session.updatedAt = new Date().toISOString();

  await writeJsonFile(getSessionFilePath(projectId, sessionId), session);
  return exercise;
}

// Update an exercise record
export async function updateExerciseInSession(
  projectId: string,
  sessionId: string,
  exerciseId: string,
  updates: Partial<Omit<ExerciseRecord, "id">>
): Promise<ExerciseRecord | null> {
  const session = await getSession(projectId, sessionId);
  if (!session) return null;

  const exerciseIndex = session.exercises.findIndex((e) => e.id === exerciseId);
  if (exerciseIndex === -1) return null;

  session.exercises[exerciseIndex] = {
    ...session.exercises[exerciseIndex],
    ...updates,
  };
  session.updatedAt = new Date().toISOString();

  await writeJsonFile(getSessionFilePath(projectId, sessionId), session);
  return session.exercises[exerciseIndex];
}

// Set agent session ID for resumption
export async function setAgentSessionId(
  projectId: string,
  sessionId: string,
  agentSessionId: string
): Promise<void> {
  await updateSession(projectId, sessionId, { agentSessionId });
}

// Wrap up a session
export async function wrapUpSession(
  projectId: string,
  sessionId: string,
  summary: string,
  topicsUpdated: string[]
): Promise<Session | null> {
  return updateSession(projectId, sessionId, {
    status: "completed",
    wrapUpSummary: summary,
    topics: topicsUpdated,
  });
}

// List all sessions for a project
export async function listSessions(projectId: string): Promise<Session[]> {
  const sessionsDir = getSessionsDir(projectId);
  const files = await listFiles(sessionsDir);

  const sessions: Session[] = [];
  for (const file of files) {
    if (file.endsWith(".json")) {
      const sessionId = file.replace(".json", "");
      const session = await getSession(projectId, sessionId);
      if (session) {
        sessions.push(session);
      }
    }
  }

  // Sort by updatedAt descending (most recent first)
  return sessions.sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}
