// Project types
export interface Project {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  updatedAt: string;
}

// Session types
export interface Session {
  id: string;
  projectId: string;
  agentSessionId?: string; // Claude Agent SDK session ID for resumption
  createdAt: string;
  updatedAt: string;
  topics: string[];
  title: string;
  messages: Message[];
  exercises: Record<string, Exercise>; // Keyed by exercise ID
  activeExerciseId: string | null; // Currently active exercise
  conceptQuestions: Record<string, ConceptQuestion>; // Keyed by question ID
  status: "active" | "completed";
  wrapUpSummary?: string;
}

// Content block types for interleaved text and tool calls
export type ContentBlock =
  | { type: "text"; text: string }
  | { type: "tool_call"; toolCall: ToolCall };

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  exercise?: Exercise; // If this message contains an exercise (legacy)
  exerciseSubmission?: ExerciseSubmission; // Exercise submission in message
  conceptQuestionAnswer?: ConceptQuestionAnswer; // Concept question answer in message
  toolCalls?: ToolCall[]; // Tool calls made during this message (legacy)
  contentBlocks?: ContentBlock[]; // Interleaved content blocks (new)
}

export interface ExerciseRecord {
  id: string;
  title: string;
  submitted: boolean;
  userCode?: string;
  passed?: boolean;
}

// Exercise status type
export type ExerciseStatus =
  | "active"
  | "pending_review"
  | "passed"
  | "skipped"
  | "needs_retry"
  | "failed"
  | "passed_with_feedback";

export const MAX_EXERCISE_RETRIES = 3;

export type ExerciseType = "write_code" | "fill_in_blank";
export const DEFAULT_EXERCISE_TYPE: ExerciseType = "fill_in_blank";

// Exercise attempt - tracks each submission with its evaluated status
export interface ExerciseAttempt {
  id: string;
  code: string;
  submittedAt: string;
  status: ExerciseStatus; // Status of this specific attempt (mirrors exercise.status at evaluation time)
  feedback?: string;
  blankValues?: Record<string, string>;
}

// Exercise types
export interface Exercise {
  id: string;
  type: ExerciseType;
  title: string;
  language: string;
  instructions: string;
  starterCode: string;
  expectedBehavior: string;
  status: ExerciseStatus;
  attempts: ExerciseAttempt[];
  hints: string[];
  createdAt: string;
  updatedAt: string;
}

// Concept question types
export type OptionCorrectness = "correct" | "partial" | "incorrect";
export type ConceptQuestionStatus = "unanswered" | "correct" | "partial" | "incorrect";

export interface ConceptQuestionOption {
  text: string;
  correctness: OptionCorrectness;
}

export interface ConceptQuestion {
  id: string;
  question: string;
  options: ConceptQuestionOption[];
  selectedOptionIndex: number | null;
  status: ConceptQuestionStatus;
  createdAt: string;
}

// Concept question answer metadata in messages
export interface ConceptQuestionAnswer {
  questionId: string;
  question: string;
  selectedOption: string;
  correctness: OptionCorrectness;
}

// Exercise submission in messages
export interface ExerciseSubmission {
  exerciseId: string;
  attemptId: string;
  code: string;
  title: string;
  instructions: string;
  blankValues?: Record<string, string>;
}

// Tool call types
export interface ToolCall {
  id: string;
  name: string;
  input: Record<string, unknown>;
  output?: string;
  status: "pending" | "completed" | "error";
  error?: string;
}

// Progress types
export interface Progress {
  topic: string;
  lastUpdated: string;
  overallLevel: "beginner" | "intermediate" | "advanced";
  summary: string;
  recentSessions: SessionNote[];
  masteredConcepts: string[];
  needsReinforcement: string[];
}

export interface SessionNote {
  date: string;
  covered: string[];
  performance: string;
  notes: string | null;
}

export interface TopicSummary {
  topic: string;
  level: "beginner" | "intermediate" | "advanced";
  lastUpdated: string;
}

// Progress update types
export interface ProgressUpdate {
  overallLevel?: "beginner" | "intermediate" | "advanced";
  addToMastered?: string[];
  addToReinforcement?: string[];
  removeFromReinforcement?: string[];
  sessionNote?: {
    covered: string[];
    performance: string;
    notes?: string;
  };
}

// Config types
export interface Config {
  dataPath: string;
  lastProjectId?: string;
}
