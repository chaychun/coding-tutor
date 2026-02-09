import { query } from "@anthropic-ai/claude-agent-sdk";
import { tutorServer } from "@/lib/agent/tutorServer";
import { getTutorSystemPrompt } from "@/lib/agent/systemPrompt";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface ChatRequest {
  message: string;
  projectId: string;
  sessionId: string;
  resumeSessionId?: string;
  action: "message" | "submit" | "hint" | "skip" | "concept_answer";
  editorCode?: string;
  testingMode?: boolean;
}

export async function POST(request: Request) {
  const body: ChatRequest = await request.json();
  const { message, projectId, sessionId, resumeSessionId, action, editorCode, testingMode } = body;

  // Build the prompt based on action type
  let promptText: string;

  // Debug prefix for testing mode — echoes raw input so the developer can verify data flow
  const debugPrefix = testingMode
    ? `[DEBUG — Testing Mode]\nAction: ${action}\n`
    : "";

  if (action === "submit") {
    promptText = `${debugPrefix}${testingMode ? `Editor code received:\n\`\`\`\n${editorCode}\n\`\`\`\n\n` : ""}The student has submitted their code for evaluation:

\`\`\`
${editorCode}
\`\`\`

Please evaluate this solution. Check if it meets the expected behavior, point out what was done correctly, explain any errors or areas for improvement, and decide the next step (another exercise, harder variant, or move on).`;
  } else if (action === "hint") {
    promptText = `${debugPrefix}${testingMode ? `Editor code received:\n\`\`\`\n${editorCode}\n\`\`\`\n\n` : ""}The student is asking for a hint. Their current code is:

\`\`\`
${editorCode}
\`\`\`

Provide a helpful hint that guides them toward the solution without giving away the answer. Focus on the concept they might be missing or a small nudge in the right direction.`;
  } else if (action === "skip") {
    // For skip action, pass the message through as-is (it contains the skip notification)
    promptText = debugPrefix + message;
  } else if (action === "concept_answer") {
    promptText = debugPrefix + message;
  } else {
    promptText = debugPrefix + message;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Query the Claude Agent SDK with string prompt
        // Note: MCP servers work with string prompts too
        // Track whether to stop after a concept question tool call.
        // Once the AI calls ask_concept_question, we yield that message and any
        // intermediate tool result messages, then break before the AI generates
        // follow-up text — the student needs to answer first.
        let stopBeforeNextAssistant = false;

        for await (const sdkMessage of query({
          prompt: promptText,
          options: {
            mcpServers: {
              "coding-tutor": tutorServer,
            },
            allowedTools: [
              "mcp__coding-tutor__read_progress",
              "mcp__coding-tutor__update_progress",
              "mcp__coding-tutor__create_exercise",
              "mcp__coding-tutor__update_exercise",
              "mcp__coding-tutor__list_topics",
              "mcp__coding-tutor__ask_concept_question",
              "mcp__coding-tutor__wrap_up_session",
              "WebSearch",
              "WebFetch",
            ],
            systemPrompt: getTutorSystemPrompt(projectId, sessionId, testingMode ?? false),
            resume: resumeSessionId,
            permissionMode: "bypassPermissions",
            maxTurns: 10,
          },
        })) {
          const msg = sdkMessage as Record<string, unknown>;

          // After concept question tool is processed, stop before AI generates
          // follow-up text — the next assistant message would be the unwanted response
          if (stopBeforeNextAssistant && msg.type === "assistant") {
            break;
          }

          // Stream each message as an SSE event
          const data = JSON.stringify({
            ...sdkMessage,
            // Include metadata for client-side processing
            _meta: { projectId, sessionId },
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));

          // Detect ask_concept_question tool use in assistant messages
          if (msg.type === "assistant") {
            const message = msg.message as
              | { content?: Array<{ type: string; name?: string }> }
              | undefined;
            if (message?.content) {
              for (const block of message.content) {
                if (
                  block.type === "tool_use" &&
                  block.name === "mcp__coding-tutor__ask_concept_question"
                ) {
                  stopBeforeNextAssistant = true;
                }
              }
            }
          }
        }

        // Signal completion
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (error) {
        console.error("Chat API error:", error);
        const errorData = JSON.stringify({
          type: "error",
          error: error instanceof Error ? error.message : "Unknown error occurred",
        });
        controller.enqueue(encoder.encode(`data: ${errorData}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
