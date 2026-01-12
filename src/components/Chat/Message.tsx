"use client";

import type { Message, Exercise, ToolCall } from "@/lib/types";
import { MarkdownContent } from "./MarkdownContent";
import { ToolCallBlock } from "./ToolCallBlock";
import { ExerciseSubmissionCard } from "./ExerciseSubmissionCard";
import ExerciseBlock from "./ExerciseBlock";

/**
 * Extract exerciseId from a create_exercise tool call output
 */
function getExerciseIdFromToolCall(toolCall: ToolCall): string | null {
  if (
    toolCall.name !== "mcp__coding-tutor__create_exercise" ||
    toolCall.status !== "completed" ||
    !toolCall.output
  ) {
    return null;
  }

  try {
    const result = JSON.parse(toolCall.output);
    return result.exerciseId ?? null;
  } catch {
    return null;
  }
}

interface ChatMessageProps {
  message: Message;
  exercises?: Record<string, Exercise>;
}

export default function ChatMessage({ message, exercises }: ChatMessageProps) {
  const isUser = message.role === "user";

  // For user messages with exercise submission, render ExerciseSubmissionCard
  if (isUser && message.exerciseSubmission) {
    const exercise = exercises?.[message.exerciseSubmission.exerciseId];
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <ExerciseSubmissionCard submission={message.exerciseSubmission} exercise={exercise} />
        </div>
      </div>
    );
  }

  // Use contentBlocks if available for interleaved rendering
  if (message.contentBlocks && message.contentBlocks.length > 0) {
    return (
      <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`max-w-[85%] px-4 py-2 ${
            isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
          }`}
        >
          <div className="space-y-2">
            {message.contentBlocks.map((block, index) => {
              if (block.type === "text") {
                return (
                  <div key={`text-${index}`} className="text-sm">
                    <MarkdownContent content={block.text} />
                  </div>
                );
              }
              if (block.type === "tool_call") {
                const exerciseId = getExerciseIdFromToolCall(block.toolCall);
                const exercise = exerciseId ? exercises?.[exerciseId] : null;
                return (
                  <div key={block.toolCall.id}>
                    <ToolCallBlock toolCall={block.toolCall} />
                    {exercise && <ExerciseBlock exercise={exercise} />}
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      </div>
    );
  }

  // Fallback to legacy rendering (tool calls first, then content)
  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-4 py-2 ${
          isUser ? "bg-primary text-primary-foreground" : "bg-muted text-foreground"
        }`}
      >
        <div className="space-y-2">
          {/* Tool calls */}
          {message.toolCalls?.map((toolCall) => {
            const exerciseId = getExerciseIdFromToolCall(toolCall);
            const exercise = exerciseId ? exercises?.[exerciseId] : null;
            return (
              <div key={toolCall.id}>
                <ToolCallBlock toolCall={toolCall} />
                {exercise && <ExerciseBlock exercise={exercise} />}
              </div>
            );
          })}

          {/* Message content with markdown */}
          {message.content && (
            <div className="text-sm">
              <MarkdownContent content={message.content} />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
