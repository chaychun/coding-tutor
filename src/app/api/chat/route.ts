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
  action: "message" | "submit" | "hint";
  editorCode?: string;
}

export async function POST(request: Request) {
  const body: ChatRequest = await request.json();
  const { message, projectId, sessionId, resumeSessionId, action, editorCode } = body;

  // Build the prompt based on action type
  let promptText: string;

  if (action === "submit") {
    promptText = `The student has submitted their code for evaluation:

\`\`\`
${editorCode}
\`\`\`

Please evaluate this solution. Check if it meets the expected behavior, point out what was done correctly, explain any errors or areas for improvement, and decide the next step (another exercise, harder variant, or move on).`;
  } else if (action === "hint") {
    promptText = `The student is asking for a hint. Their current code is:

\`\`\`
${editorCode}
\`\`\`

Provide a helpful hint that guides them toward the solution without giving away the answer. Focus on the concept they might be missing or a small nudge in the right direction.`;
  } else {
    promptText = message;
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Query the Claude Agent SDK with string prompt
        // Note: MCP servers work with string prompts too
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
              "mcp__coding-tutor__wrap_up_session",
              "WebSearch",
              "WebFetch",
            ],
            systemPrompt: getTutorSystemPrompt(projectId, sessionId),
            resume: resumeSessionId,
            permissionMode: "bypassPermissions",
            maxTurns: 10,
          },
        })) {
          // Stream each message as an SSE event
          const data = JSON.stringify({
            ...sdkMessage,
            // Include metadata for client-side processing
            _meta: { projectId, sessionId },
          });
          controller.enqueue(encoder.encode(`data: ${data}\n\n`));
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
