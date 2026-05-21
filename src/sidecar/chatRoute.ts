import type { Request, Response } from "express";
import {
  abortJob,
  getSnapshot,
  isRunning,
  startJob,
  subscribe,
} from "./chatJobs";
import type { ChatAction, StartJobOptions } from "./chatJobs";
import type { ExerciseSubmission, ConceptQuestionAnswer } from "../lib/types";

interface ChatStartBody {
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

const VALID_ACTIONS: ReadonlySet<ChatAction> = new Set([
  "message",
  "submit",
  "hint",
  "skip",
  "concept_answer",
]);

export async function handleChatStart(req: Request, res: Response): Promise<void> {
  const body = req.body as Partial<ChatStartBody>;
  const { projectId, sessionId, action, message } = body;

  if (!projectId || !sessionId || !action) {
    res.status(400).json({ error: "projectId, sessionId, and action are required" });
    return;
  }
  if (!VALID_ACTIONS.has(action)) {
    res.status(400).json({ error: `Invalid action: ${action}` });
    return;
  }
  if (action !== "hint" && typeof message !== "string") {
    res.status(400).json({ error: "message is required for this action" });
    return;
  }

  const opts: StartJobOptions = {
    projectId,
    sessionId,
    action,
    message: message ?? "",
    userMessageId: body.userMessageId,
    editorCode: body.editorCode,
    exerciseSubmission: body.exerciseSubmission,
    conceptQuestionAnswer: body.conceptQuestionAnswer,
    testingMode: body.testingMode,
  };

  const result = await startJob(opts);
  if (!result.ok) {
    if (result.reason === "already_running") {
      res.status(409).json({ error: "already_running" });
      return;
    }
    if (result.reason === "session_not_found") {
      res.status(404).json({ error: "session_not_found" });
      return;
    }
  }
  res.status(202).json({ ok: true });
}

export async function handleChatEvents(req: Request, res: Response): Promise<void> {
  const projectId = req.params.projectId as string | undefined;
  const sessionId = req.params.sessionId as string | undefined;
  if (!projectId || !sessionId) {
    res.status(400).json({ error: "projectId and sessionId are required" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  // Emit the current snapshot (job state if running, else from storage) and the
  // running flag so the client can drive UI without an extra round-trip.
  const snapshot = await getSnapshot(projectId, sessionId);
  if (!snapshot) {
    res.write(
      `event: error\ndata: ${JSON.stringify({ message: "session_not_found" })}\n\n`
    );
    res.end();
    return;
  }
  res.write(
    `event: snapshot\ndata: ${JSON.stringify({
      state: snapshot,
      running: isRunning(sessionId),
    })}\n\n`
  );

  const unsubscribe = subscribe(sessionId, res);

  // Heartbeat keeps intermediaries (and the client EventSource polyfill) honest.
  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      // ignore — close handler cleans up
    }
  }, 25_000);

  const cleanup = (): void => {
    clearInterval(heartbeat);
    unsubscribe();
  };

  req.on("close", cleanup);
  req.on("aborted", cleanup);
  res.on("close", cleanup);
  res.on("error", cleanup);
}

export async function handleChatAbort(req: Request, res: Response): Promise<void> {
  const sessionId = req.params.sessionId as string | undefined;
  if (!sessionId) {
    res.status(400).json({ error: "sessionId is required" });
    return;
  }
  const ok = abortJob(sessionId);
  res.json({ ok });
}
