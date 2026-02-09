"use client";

import type { Message, Exercise, ToolCall, ConceptQuestion } from "@/lib/types";
import { Markdown } from "@/components/ui/markdown";
import { Tool } from "@/components/ui/tool";
import { ExerciseSubmissionCard } from "./ExerciseSubmissionCard";
import ExerciseBlock from "./ExerciseBlock";
import ConceptQuestionBlock from "./ConceptQuestionBlock";
import { useStreamBuffer } from "@/hooks/useStreamBuffer";

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

/**
 * Extract questionId from an ask_concept_question tool call output
 */
function getQuestionIdFromToolCall(toolCall: ToolCall): string | null {
  if (
    toolCall.name !== "mcp__coding-tutor__ask_concept_question" ||
    toolCall.status !== "completed" ||
    !toolCall.output
  ) {
    return null;
  }

  try {
    const result = JSON.parse(toolCall.output);
    return result.questionId ?? null;
  } catch {
    return null;
  }
}

interface ChatMessageProps {
  message: Message;
  exercises?: Record<string, Exercise>;
  conceptQuestions?: Record<string, ConceptQuestion>;
  onRetry?: (exerciseId: string, code: string) => void;
  onConceptAnswer?: (questionId: string, optionIndex: number) => void;
}

export default function ChatMessage({
  message,
  exercises,
  conceptQuestions,
  onRetry,
  onConceptAnswer,
}: ChatMessageProps) {
  const isUser = message.role === "user";
  const isStreaming = message.id === "streaming";

  // Buffer the raw streaming content for word-by-word reveal
  const bufferedText = useStreamBuffer(isStreaming ? message.content || "" : "");

  // Concept question answers are invisible — the ConceptQuestionBlock itself
  // shows the selected answer inline, so no separate user bubble is needed.
  if (isUser && message.conceptQuestionAnswer) {
    return null;
  }

  // For user messages with exercise submission, render ExerciseSubmissionCard
  if (isUser && message.exerciseSubmission) {
    const exercise = exercises?.[message.exerciseSubmission.exerciseId];
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%]">
          <ExerciseSubmissionCard
            submission={message.exerciseSubmission}
            exercise={exercise}
            onRetry={onRetry}
          />
        </div>
      </div>
    );
  }

  // Use contentBlocks if available for interleaved rendering
  if (message.contentBlocks && message.contentBlocks.length > 0) {
    // For streaming: distribute the buffered text across text blocks.
    // Each finalized text block gets its full length; the last (growing) block
    // gets whatever the buffer has revealed so far.
    let charBudget = isStreaming ? bufferedText.length : Infinity;

    return (
      <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
        <div
          className={`${isUser ? "max-w-[85%] px-4 py-2 bg-primary text-primary-foreground" : "w-[80%] text-foreground"}`}
        >
          <div className="space-y-2">
            {message.contentBlocks.map((block, index) => {
              if (block.type === "text") {
                let displayText = block.text;
                if (isStreaming) {
                  // Take up to blockLength chars from the remaining budget
                  const take = Math.min(block.text.length, charBudget);
                  displayText = block.text.slice(0, take);
                  charBudget -= take;
                }

                // Don't render empty text blocks during streaming
                if (isStreaming && !displayText) return null;

                return (
                  <div key={`text-${index}`} className="text-sm">
                    <Markdown id={message.id}>{displayText}</Markdown>
                  </div>
                );
              }
              if (block.type === "tool_call") {
                const exerciseId = getExerciseIdFromToolCall(block.toolCall);
                const exercise = exerciseId ? exercises?.[exerciseId] : null;
                const questionId = getQuestionIdFromToolCall(block.toolCall);
                const question = questionId ? conceptQuestions?.[questionId] : null;
                return (
                  <div key={block.toolCall.id}>
                    <Tool toolCall={block.toolCall} />
                    {exercise && <ExerciseBlock exercise={exercise} />}
                    {question && (
                      <ConceptQuestionBlock question={question} onAnswer={onConceptAnswer} />
                    )}
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
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] px-4 py-2 ${
          isUser ? "bg-primary text-primary-foreground" : "text-foreground"
        }`}
      >
        <div className="space-y-2">
          {/* Tool calls */}
          {message.toolCalls?.map((toolCall) => {
            const exerciseId = getExerciseIdFromToolCall(toolCall);
            const exercise = exerciseId ? exercises?.[exerciseId] : null;
            const questionId = getQuestionIdFromToolCall(toolCall);
            const question = questionId ? conceptQuestions?.[questionId] : null;
            return (
              <div key={toolCall.id}>
                <Tool toolCall={toolCall} />
                {exercise && <ExerciseBlock exercise={exercise} />}
                {question && (
                  <ConceptQuestionBlock question={question} onAnswer={onConceptAnswer} />
                )}
              </div>
            );
          })}

          {/* Message content with markdown */}
          {(isStreaming ? bufferedText : message.content) && (
            <div className="text-sm">
              <Markdown id={message.id}>
                {isStreaming ? bufferedText : message.content || ""}
              </Markdown>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
