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
  exercises: ExerciseRecord[];
  status: "active" | "completed";
  wrapUpSummary?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  exercise?: Exercise; // If this message contains an exercise
}

export interface ExerciseRecord {
  id: string;
  title: string;
  submitted: boolean;
  userCode?: string;
  passed?: boolean;
}

// Exercise types
export interface Exercise {
  type: "exercise";
  title: string;
  language: string;
  instructions: string;
  starterCode: string;
  expectedBehavior: string;
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
