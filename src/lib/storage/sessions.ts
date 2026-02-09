import * as path from "path";
import type { Session, Message, Exercise, ExerciseAttempt, ConceptQuestion } from "../types";
import {
  getDataPath,
  readJsonFile,
  writeJsonFile,
  updateJsonFile,
  listFiles,
  generateId,
} from "./utils";

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
    exercises: {},
    activeExerciseId: null,
    conceptQuestions: {},
    status: "active",
  };

  await writeJsonFile(getSessionFilePath(projectId, id), session);
  return session;
}

// Get a session by ID
export async function getSession(projectId: string, sessionId: string): Promise<Session | null> {
  const filePath = getSessionFilePath(projectId, sessionId);
  const session = await readJsonFile<Session>(filePath);
  if (!session) {
    return null;
  }

  // In-memory migrations for backward compatibility with old session formats.
  // These run on every read without write-back by design - this is intentional to:
  // 1. Avoid write amplification on read-only operations
  // 2. Allow safe rollback if the new format has issues
  // 3. Lazily migrate when sessions are actually updated via updateSession()
  if (Array.isArray(session.exercises)) {
    session.exercises = {};
  }
  if (session.activeExerciseId === undefined) {
    session.activeExerciseId = null;
  }
  if (!session.conceptQuestions) {
    session.conceptQuestions = {};
  }

  // Migrate exercises missing `type` field — detect from starter code
  for (const exercise of Object.values(session.exercises)) {
    if (!exercise.type) {
      exercise.type = exercise.starterCode?.includes("___") ? "fill_in_blank" : "write_code";
    }
  }

  return session;
}

// Update a session (atomic read-modify-write)
export async function updateSession(
  projectId: string,
  sessionId: string,
  updates: Partial<Omit<Session, "id" | "projectId" | "createdAt">>
): Promise<Session | null> {
  const filePath = getSessionFilePath(projectId, sessionId);

  return updateJsonFile<Session>(filePath, (session) => {
    if (!session) return null;

    // Apply migrations
    if (Array.isArray(session.exercises)) {
      session.exercises = {};
    }
    if (session.activeExerciseId === undefined) {
      session.activeExerciseId = null;
    }
    if (!session.conceptQuestions) {
      session.conceptQuestions = {};
    }

    // Migrate exercises missing `type` field — detect from starter code
    for (const exercise of Object.values(session.exercises)) {
      if (!exercise.type) {
        exercise.type = exercise.starterCode?.includes("___") ? "fill_in_blank" : "write_code";
      }
    }

    return {
      ...session,
      ...updates,
      updatedAt: new Date().toISOString(),
    };
  });
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

// Add an exercise to a session (atomic)
export async function addExerciseToSession(
  projectId: string,
  sessionId: string,
  exercise: Exercise
): Promise<void> {
  const filePath = getSessionFilePath(projectId, sessionId);

  await updateJsonFile<Session>(filePath, (session) => {
    if (!session) {
      return null;
    }

    // Apply migrations
    if (Array.isArray(session.exercises)) {
      session.exercises = {};
    }

    session.exercises[exercise.id] = exercise;
    session.updatedAt = new Date().toISOString();

    return session;
  });
}

// Update an exercise in a session (atomic)
// Returns true if exercise was found and updated, false if exercise doesn't exist
export async function updateExerciseInSession(
  projectId: string,
  sessionId: string,
  exerciseId: string,
  updates: Partial<Exercise>
): Promise<boolean> {
  const filePath = getSessionFilePath(projectId, sessionId);
  let exerciseFound = false;

  await updateJsonFile<Session>(filePath, (session) => {
    if (!session) return null;

    // Apply migrations
    if (Array.isArray(session.exercises)) {
      session.exercises = {};
    }

    const existingExercise = session.exercises[exerciseId];
    if (existingExercise) {
      exerciseFound = true;
      session.exercises[exerciseId] = {
        ...existingExercise,
        ...updates,
        updatedAt: new Date().toISOString(),
      };
      session.updatedAt = new Date().toISOString();
    }
    // Don't create exercise if it doesn't exist - return session unchanged

    return session;
  });

  return exerciseFound;
}

// Set the active exercise ID (atomic)
export async function setActiveExerciseId(
  projectId: string,
  sessionId: string,
  exerciseId: string | null
): Promise<void> {
  const filePath = getSessionFilePath(projectId, sessionId);

  await updateJsonFile<Session>(filePath, (session) => {
    if (!session) return null;

    session.activeExerciseId = exerciseId;
    session.updatedAt = new Date().toISOString();
    return session;
  });
}

// Add a concept question to a session (atomic)
export async function addConceptQuestionToSession(
  projectId: string,
  sessionId: string,
  question: ConceptQuestion
): Promise<void> {
  const filePath = getSessionFilePath(projectId, sessionId);

  await updateJsonFile<Session>(filePath, (session) => {
    if (!session) return null;

    if (!session.conceptQuestions) {
      session.conceptQuestions = {};
    }

    session.conceptQuestions[question.id] = question;
    session.updatedAt = new Date().toISOString();
    return session;
  });
}

// Answer a concept question (atomic)
export async function answerConceptQuestion(
  projectId: string,
  sessionId: string,
  questionId: string,
  selectedOptionIndex: number
): Promise<ConceptQuestion | null> {
  const filePath = getSessionFilePath(projectId, sessionId);
  let answeredQuestion: ConceptQuestion | null = null;

  await updateJsonFile<Session>(filePath, (session) => {
    if (!session) return null;

    const question = session.conceptQuestions?.[questionId];
    if (!question) return session;

    question.selectedOptionIndex = selectedOptionIndex;
    question.status = question.options[selectedOptionIndex].correctness;
    session.updatedAt = new Date().toISOString();

    answeredQuestion = question;
    return session;
  });

  return answeredQuestion;
}

// Add an attempt to an exercise (atomic)
export async function addExerciseAttempt(
  projectId: string,
  sessionId: string,
  exerciseId: string,
  attempt: ExerciseAttempt
): Promise<void> {
  const filePath = getSessionFilePath(projectId, sessionId);

  await updateJsonFile<Session>(filePath, (session) => {
    if (!session) return null;

    // Apply migrations
    if (Array.isArray(session.exercises)) {
      session.exercises = {};
    }

    const exercise = session.exercises[exerciseId];
    if (!exercise) return session;

    exercise.attempts.push(attempt);
    exercise.updatedAt = new Date().toISOString();
    session.updatedAt = new Date().toISOString();

    return session;
  });
}

// Submit an exercise attempt - adds attempt and updates exercise status to pending_review (atomic)
export async function submitExerciseAttempt(
  projectId: string,
  sessionId: string,
  exerciseId: string,
  attemptId: string,
  code: string,
  blankValues?: Record<string, string>
): Promise<ExerciseAttempt | null> {
  const filePath = getSessionFilePath(projectId, sessionId);
  let createdAttempt: ExerciseAttempt | null = null;

  await updateJsonFile<Session>(filePath, (session) => {
    if (!session) return null;

    // Apply migrations
    if (Array.isArray(session.exercises)) {
      session.exercises = {};
    }

    const exercise = session.exercises[exerciseId];
    if (!exercise) return session;

    // Create the attempt
    const attempt: ExerciseAttempt = {
      id: attemptId,
      code,
      blankValues,
      submittedAt: new Date().toISOString(),
      status: "pending_review",
    };

    exercise.attempts.push(attempt);
    exercise.status = "pending_review";
    exercise.updatedAt = new Date().toISOString();
    session.updatedAt = new Date().toISOString();

    createdAttempt = attempt;
    return session;
  });

  return createdAttempt;
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
