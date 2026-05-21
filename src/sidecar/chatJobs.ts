import type { Response } from "express";
import { query } from "@anthropic-ai/claude-agent-sdk";
import type {
  Message,
  Exercise,
  ConceptQuestion,
  ToolCall,
  ContentBlock,
  ExerciseSubmission,
  ConceptQuestionAnswer,
} from "../lib/types";
import { tutorServer } from "./tutorServer";
import { getTutorSystemPrompt } from "../lib/agent/systemPrompt";
import * as storage from "./storage";
import { nowIso } from "./storage/utils";
import { onSessionChanged } from "./storage/events";
import { generateTitleFromMessage } from "../lib/utils/generateTitle";
import {
  regenerateTitleHaiku,
  shouldRegenerateTitle,
  broadcastSessionUpdate,
} from "./titleJobs";
import { broadcastGlobal } from "./globalEventBus";

export type ChatAction = "message" | "submit" | "hint" | "skip" | "concept_answer";

export interface ChatJobState {
  messages: Message[];
  exercises: Record<string, Exercise>;
  conceptQuestions: Record<string, ConceptQuestion>;
  activeExerciseId: string | null;
  agentSessionId?: string;
  inProgressMessage: Message | null;
  status: "running" | "idle" | "error";
  error?: string;
}

interface ChatJob {
  projectId: string;
  sessionId: string;
  abort: AbortController;
  state: ChatJobState;
  done: Promise<void>;
}

const jobs = new Map<string, ChatJob>();
const subscribers = new Map<string, Set<Response>>();

export type GlobalJobStatus = "running" | "finished" | "error" | "aborted";

export interface GlobalJobEvent {
  sessionId: string;
  projectId: string;
  status: GlobalJobStatus;
  error?: string;
}

export function getGlobalJobsSnapshot(): Array<{ sessionId: string; projectId: string }> {
  return Array.from(jobs.values()).map((j) => ({
    sessionId: j.sessionId,
    projectId: j.projectId,
  }));
}

// Storage layer fires session:changed on every mutation. Refresh subscribers' state
// from storage so we never miss an update — replaces the fragile manual
// publishStateRefresh calls scattered through route handlers.
onSessionChanged(({ projectId, sessionId }) => {
  void publishStateRefresh(projectId, sessionId);
});

function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

function broadcast(sessionId: string, event: string, payload: unknown): void {
  const subs = subscribers.get(sessionId);
  if (!subs || subs.size === 0) return;
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of subs) {
    try {
      res.write(chunk);
    } catch {
      // dead connection — unsubscribe will clean up on close handler
    }
  }
}

export function subscribe(sessionId: string, res: Response): () => void {
  let subs = subscribers.get(sessionId);
  if (!subs) {
    subs = new Set();
    subscribers.set(sessionId, subs);
  }
  subs.add(res);
  return () => {
    const current = subscribers.get(sessionId);
    if (!current) return;
    current.delete(res);
    if (current.size === 0) subscribers.delete(sessionId);
  };
}

async function snapshotFromStorage(
  projectId: string,
  sessionId: string
): Promise<ChatJobState | null> {
  const session = await storage.getSession(projectId, sessionId);
  if (!session) return null;
  return {
    messages: session.messages,
    exercises: session.exercises,
    conceptQuestions: session.conceptQuestions,
    activeExerciseId: session.activeExerciseId,
    agentSessionId: session.agentSessionId,
    inProgressMessage: null,
    status: "idle",
  };
}

export async function getSnapshot(
  projectId: string,
  sessionId: string
): Promise<ChatJobState | null> {
  const job = jobs.get(sessionId);
  if (job) return job.state;
  return snapshotFromStorage(projectId, sessionId);
}

export function isRunning(sessionId: string): boolean {
  return jobs.has(sessionId);
}

async function publishStateRefresh(projectId: string, sessionId: string): Promise<void> {
  const subs = subscribers.get(sessionId);
  if (!subs || subs.size === 0) return;
  const session = await storage.getSession(projectId, sessionId);
  if (!session) return;
  const job = jobs.get(sessionId);
  if (job) {
    job.state.exercises = session.exercises;
    job.state.conceptQuestions = session.conceptQuestions;
    job.state.activeExerciseId = session.activeExerciseId;
    broadcast(sessionId, "state", job.state);
    return;
  }
  const state: ChatJobState = {
    messages: session.messages,
    exercises: session.exercises,
    conceptQuestions: session.conceptQuestions,
    activeExerciseId: session.activeExerciseId,
    agentSessionId: session.agentSessionId,
    inProgressMessage: null,
    status: "idle",
  };
  broadcast(sessionId, "state", state);
}

export function abortJob(sessionId: string): boolean {
  const job = jobs.get(sessionId);
  if (!job) return false;
  job.abort.abort();
  return true;
}

export interface StartJobOptions {
  projectId: string;
  sessionId: string;
  action: ChatAction;
  message: string;
  userMessageId?: string;
  editorCode?: string;
  exerciseSubmission?: ExerciseSubmission;
  conceptQuestionAnswer?: ConceptQuestionAnswer;
  testingMode?: boolean;
}

export type StartJobResult =
  | { ok: true }
  | { ok: false; reason: "already_running" | "session_not_found" };

export async function startJob(opts: StartJobOptions): Promise<StartJobResult> {
  const { projectId, sessionId, action } = opts;
  if (jobs.has(sessionId)) return { ok: false, reason: "already_running" };

  const session = await storage.getSession(projectId, sessionId);
  if (!session) return { ok: false, reason: "session_not_found" };

  const state: ChatJobState = {
    messages: session.messages,
    exercises: session.exercises,
    conceptQuestions: session.conceptQuestions,
    activeExerciseId: session.activeExerciseId,
    agentSessionId: session.agentSessionId,
    inProgressMessage: null,
    status: "running",
  };

  // Append user message for all actions except "hint" (no user-visible turn)
  if (action !== "hint") {
    const userMessage: Message = {
      id: opts.userMessageId ?? generateMessageId(),
      role: "user",
      content: opts.message,
      timestamp: nowIso(),
      ...(opts.exerciseSubmission ? { exerciseSubmission: opts.exerciseSubmission } : {}),
      ...(opts.conceptQuestionAnswer ? { conceptQuestionAnswer: opts.conceptQuestionAnswer } : {}),
    };
    const isFirstUserMessage =
      session.messages.length === 0 && action === "message" && opts.message.trim().length > 0;
    const initialTitle = isFirstUserMessage ? generateTitleFromMessage(opts.message) : undefined;
    state.messages = [...state.messages, userMessage];
    await storage.updateSession(projectId, sessionId, {
      messages: state.messages,
      ...(initialTitle ? { title: initialTitle } : {}),
    });
    if (initialTitle) {
      broadcastSessionUpdate({ projectId, sessionId, title: initialTitle });
    }
  }

  const abortCtrl = new AbortController();
  const job: ChatJob = {
    projectId,
    sessionId,
    abort: abortCtrl,
    state,
    done: Promise.resolve(),
  };
  jobs.set(sessionId, job);
  broadcast(sessionId, "state", state);
  broadcastGlobal("state", { sessionId, projectId, status: "running" } satisfies GlobalJobEvent);

  job.done = runJob(job, opts).catch((err) => {
    console.error("[chatJobs] runJob crashed:", err);
  });

  return { ok: true };
}

function buildPrompt(opts: StartJobOptions): string {
  const { action, editorCode, testingMode, message } = opts;
  const debugPrefix = testingMode ? `[DEBUG — Testing Mode]\nAction: ${action}\n` : "";

  if (action === "submit") {
    return `${debugPrefix}${
      testingMode ? `Submission received:\n\`\`\`\n${editorCode ?? ""}\n\`\`\`\n\n` : ""
    }The student has submitted their answer for evaluation:

${editorCode ?? ""}

Please evaluate this solution. Check if it meets the expected behavior, point out what was done correctly, explain any errors or areas for improvement, and decide the next step (another exercise, harder variant, or move on).`;
  }
  if (action === "hint") {
    return `${debugPrefix}${
      testingMode ? `Editor code received:\n\`\`\`\n${editorCode ?? ""}\n\`\`\`\n\n` : ""
    }The student is asking for a hint. Their current code is:

\`\`\`
${editorCode ?? ""}
\`\`\`

Provide a helpful hint that guides them toward the solution without giving away the answer. Focus on the concept they might be missing or a small nudge in the right direction.`;
  }
  return debugPrefix + message;
}

interface AssistantSdkBlock {
  type: string;
  text?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | Array<{ type: string; text?: string }>;
  is_error?: boolean;
}

interface SdkEnvelope {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: { content?: AssistantSdkBlock[] };
}

function extractToolResultText(
  content: string | Array<{ type: string; text?: string }> | undefined
): string {
  if (typeof content === "string") return content;
  if (Array.isArray(content)) {
    return content
      .filter((c): c is { type: string; text: string } => c.type === "text" && typeof c.text === "string")
      .map((c) => c.text)
      .join("\n");
  }
  return "";
}

function normalizeFinalizedMessage(msg: Message): Message {
  const normalized: Message = { ...msg };
  if (normalized.toolCalls) {
    normalized.toolCalls = normalized.toolCalls.map((tc) =>
      tc.status === "pending" ? { ...tc, status: "completed" as const } : tc
    );
  }
  if (normalized.contentBlocks) {
    normalized.contentBlocks = normalized.contentBlocks.map((b) =>
      b.type === "tool_call" && b.toolCall.status === "pending"
        ? { type: "tool_call" as const, toolCall: { ...b.toolCall, status: "completed" as const } }
        : b
    );
  }
  return normalized;
}

async function runJob(job: ChatJob, opts: StartJobOptions): Promise<void> {
  const { projectId, sessionId, testingMode } = opts;
  const promptText = buildPrompt(opts);

  const inProgress: Message = {
    id: generateMessageId(),
    role: "assistant",
    content: "",
    timestamp: nowIso(),
    contentBlocks: [],
  };
  const toolCallMap = new Map<string, ToolCall>();
  let currentTextBlock: { type: "text"; text: string } | null = null;
  let stopBeforeNextAssistant = false;

  const publishInProgress = (): void => {
    const blocks: ContentBlock[] = inProgress.contentBlocks ? [...inProgress.contentBlocks] : [];
    if (currentTextBlock && currentTextBlock.text) {
      const last = blocks[blocks.length - 1];
      if (last && last.type === "text") blocks[blocks.length - 1] = { ...currentTextBlock };
      else blocks.push({ ...currentTextBlock });
    }
    const snapshot: Message = {
      ...inProgress,
      contentBlocks: blocks.length > 0 ? blocks : undefined,
      toolCalls: toolCallMap.size > 0 ? Array.from(toolCallMap.values()).map((t) => ({ ...t })) : undefined,
    };
    job.state.inProgressMessage = snapshot;
    broadcast(sessionId, "state", job.state);
  };

  const processToolResult = async (
    toolUseId: string,
    content: AssistantSdkBlock["content"],
    isError: boolean | undefined
  ): Promise<void> => {
    const existing = toolCallMap.get(toolUseId);
    if (!existing) return;
    const outputText = extractToolResultText(content);
    existing.output = outputText;
    existing.status = isError ? "error" : "completed";
    if (isError) existing.error = outputText;
    toolCallMap.set(toolUseId, existing);

    if (inProgress.contentBlocks) {
      for (let i = 0; i < inProgress.contentBlocks.length; i++) {
        const cb = inProgress.contentBlocks[i];
        if (cb.type === "tool_call" && cb.toolCall.id === toolUseId) {
          inProgress.contentBlocks[i] = { type: "tool_call", toolCall: { ...existing } };
          break;
        }
      }
    }

    publishInProgress();
  };

  try {
    for await (const sdkMessage of query({
      prompt: promptText,
      options: {
        mcpServers: { mula: tutorServer },
        allowedTools: [
          "mcp__mula__read_progress",
          "mcp__mula__update_progress",
          "mcp__mula__create_exercise",
          "mcp__mula__update_exercise",
          "mcp__mula__list_topics",
          "mcp__mula__ask_concept_question",
          "mcp__mula__wrap_up_session",
          "WebSearch",
          "WebFetch",
        ],
        systemPrompt: getTutorSystemPrompt(projectId, sessionId, testingMode ?? false),
        resume: job.state.agentSessionId,
        permissionMode: "bypassPermissions",
        maxTurns: 10,
        ...(process.env.CLAUDE_PATH ? { pathToClaudeCodeExecutable: process.env.CLAUDE_PATH } : {}),
      },
    })) {
      if (job.abort.signal.aborted) break;

      const env = sdkMessage as unknown as SdkEnvelope;

      if (stopBeforeNextAssistant && env.type === "assistant") break;

      if (env.type === "system" && env.subtype === "init" && env.session_id) {
        job.state.agentSessionId = env.session_id;
        await storage.updateSession(projectId, sessionId, { agentSessionId: env.session_id });
      }

      if (env.type === "assistant" && env.message?.content) {
        for (const block of env.message.content) {
          if (block.type === "text" && block.text) {
            inProgress.content += block.text;
            if (!currentTextBlock) currentTextBlock = { type: "text", text: block.text };
            else currentTextBlock.text += block.text;
          }
          if (block.type === "tool_use" && block.id && block.name) {
            if (currentTextBlock && currentTextBlock.text) {
              inProgress.contentBlocks = inProgress.contentBlocks ?? [];
              inProgress.contentBlocks.push(currentTextBlock);
              currentTextBlock = null;
            }
            const toolCall: ToolCall = {
              id: block.id,
              name: block.name,
              input: (block.input as Record<string, unknown>) || {},
              status: "pending",
            };
            toolCallMap.set(block.id, toolCall);
            inProgress.contentBlocks = inProgress.contentBlocks ?? [];
            inProgress.contentBlocks.push({ type: "tool_call", toolCall });

            if (
              block.name === "mcp__mula__ask_concept_question" ||
              block.name === "mcp__mula__create_exercise"
            ) {
              stopBeforeNextAssistant = true;
            }
            if (block.name === "mcp__mula__update_exercise") {
              const status = block.input?.status as string | undefined;
              if (status && status !== "passed" && status !== "passed_with_feedback") {
                stopBeforeNextAssistant = true;
              }
            }
          }
        }
        publishInProgress();
      }

      // tool_result blocks come in non-assistant ("user") envelopes
      if (env.type !== "assistant" && env.message?.content) {
        for (const block of env.message.content) {
          if (block.type === "tool_result" && typeof block.tool_use_id === "string") {
            await processToolResult(block.tool_use_id, block.content, block.is_error);
          }
        }
      }
    }

    // Finalize trailing text block
    if (currentTextBlock && currentTextBlock.text) {
      inProgress.contentBlocks = inProgress.contentBlocks ?? [];
      inProgress.contentBlocks.push(currentTextBlock);
      currentTextBlock = null;
    }

    const hasContent =
      inProgress.content.length > 0 ||
      (inProgress.contentBlocks && inProgress.contentBlocks.length > 0);

    if (hasContent && !job.abort.signal.aborted) {
      if (toolCallMap.size > 0) {
        inProgress.toolCalls = Array.from(toolCallMap.values());
      }
      if (inProgress.contentBlocks && inProgress.contentBlocks.length === 0) {
        delete inProgress.contentBlocks;
      }
      const finalized = normalizeFinalizedMessage(inProgress);
      job.state.messages = [...job.state.messages, finalized];
      job.state.inProgressMessage = null;
      await storage.updateSession(projectId, sessionId, {
        messages: job.state.messages,
        agentSessionId: job.state.agentSessionId,
      });
      if (shouldRegenerateTitle(job.state.messages)) {
        void regenerateTitleHaiku(projectId, sessionId, job.state.messages);
      }
    } else {
      job.state.inProgressMessage = null;
    }

    job.state.status = "idle";
    broadcast(sessionId, "state", job.state);
    broadcast(sessionId, "done", { aborted: job.abort.signal.aborted });
    broadcastGlobal("state", {
      sessionId,
      projectId,
      status: job.abort.signal.aborted ? "aborted" : "finished",
    } satisfies GlobalJobEvent);
  } catch (err) {
    console.error("[chatJobs] agent error:", err);
    job.state.status = "error";
    job.state.error = err instanceof Error ? err.message : String(err);
    job.state.inProgressMessage = null;
    broadcast(sessionId, "state", job.state);
    broadcast(sessionId, "error", { message: job.state.error });
    broadcastGlobal("state", {
      sessionId,
      projectId,
      status: "error",
      error: job.state.error,
    } satisfies GlobalJobEvent);
  } finally {
    jobs.delete(sessionId);
  }
}
