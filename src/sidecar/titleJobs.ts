import { query } from "@anthropic-ai/claude-agent-sdk";
import type { Message } from "../lib/types";
import * as storage from "./storage";
import { broadcastGlobal } from "./globalEventBus";

export interface GlobalSessionUpdateEvent {
  projectId: string;
  sessionId: string;
  title?: string;
}

export function broadcastSessionUpdate(payload: GlobalSessionUpdateEvent): void {
  broadcastGlobal("session_update", payload);
}

const inFlight = new Set<string>();

const SYSTEM_PROMPT =
  "You generate ultra-short session titles for a coding tutor app. " +
  "Output ONLY the title — 3 to 6 words, no quotes, no trailing punctuation, " +
  "Title Case. Capture the topic, not the action.";

function buildTranscript(messages: Message[]): string {
  return messages
    .filter((m) => m.content && m.content.trim().length > 0)
    .map((m) => `${m.role === "user" ? "Student" : "Tutor"}: ${m.content.trim()}`)
    .join("\n\n");
}

function cleanTitle(raw: string): string {
  let t = raw.trim();
  t = t.replace(/^["'`]+|["'`]+$/g, "");
  t = t.replace(/[.!?]+$/g, "");
  t = t.replace(/\s+/g, " ").trim();
  if (t.length > 60) t = t.slice(0, 57).trimEnd() + "...";
  return t;
}

interface AssistantSdkBlock {
  type: string;
  text?: string;
}
interface SdkEnvelope {
  type: string;
  message?: { content?: AssistantSdkBlock[] };
}

/**
 * Decide whether to regenerate the title after an assistant turn finalizes.
 * Counts assistant messages: trigger at 1, then every 10 (11, 21, 31, ...).
 */
export function shouldRegenerateTitle(messages: Message[]): boolean {
  const assistantCount = messages.filter((m) => m.role === "assistant").length;
  if (assistantCount === 1) return true;
  if (assistantCount > 1 && (assistantCount - 1) % 10 === 0) return true;
  return false;
}

export async function regenerateTitleHaiku(
  projectId: string,
  sessionId: string,
  messages: Message[]
): Promise<void> {
  if (inFlight.has(sessionId)) return;
  inFlight.add(sessionId);

  try {
    const transcript = buildTranscript(messages);
    if (!transcript) return;

    const prompt = `Session transcript:\n\n${transcript}\n\nReturn the title only.`;

    let collected = "";
    for await (const sdkMessage of query({
      prompt,
      options: {
        model: "haiku",
        systemPrompt: SYSTEM_PROMPT,
        tools: [],
        allowedTools: [],
        maxTurns: 1,
        permissionMode: "bypassPermissions",
        env: { ...process.env, ENABLE_TOOL_SEARCH: "0" },
        ...(process.env.CLAUDE_PATH ? { pathToClaudeCodeExecutable: process.env.CLAUDE_PATH } : {}),
      },
    })) {
      const env = sdkMessage as unknown as SdkEnvelope;
      if (env.type === "assistant" && env.message?.content) {
        for (const block of env.message.content) {
          if (block.type === "text" && block.text) collected += block.text;
        }
      }
    }

    const title = cleanTitle(collected);
    if (!title) return;

    await storage.updateSession(projectId, sessionId, { title });
    broadcastSessionUpdate({ projectId, sessionId, title });
  } catch (err) {
    console.error("[titleJobs] haiku regen failed:", err);
  } finally {
    inFlight.delete(sessionId);
  }
}
