"use client";

import type { Message, Exercise, ToolCall, ConceptQuestion } from "@/lib/types";
import { Markdown } from "@/components/ui/markdown";
import { Tool } from "@/components/ui/tool";
import { ExerciseSubmissionCard } from "./ExerciseSubmissionCard";
import ExerciseBlock from "./ExerciseBlock";
import ExerciseUpdateBlock from "./ExerciseUpdateBlock";
import ConceptQuestionBlock from "./ConceptQuestionBlock";

/**
 * Extract exerciseId from a create_exercise tool call output
 */
function getExerciseIdFromToolCall(toolCall: ToolCall): string | null {
  if (
    toolCall.name !== "mcp__mula__create_exercise" ||
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
    toolCall.name !== "mcp__mula__ask_concept_question" ||
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

/**
 * Extract update info from an update_exercise tool call
 */
function getExerciseUpdateFromToolCall(
  toolCall: ToolCall
): { exerciseId: string; status: string; hint?: string } | null {
  if (toolCall.name !== "mcp__mula__update_exercise" || toolCall.status !== "completed") {
    return null;
  }

  const input = toolCall.input as { exerciseId?: string; status?: string; hint?: string };
  // Only render the card when there's an explicit status change
  if (!input.exerciseId || !input.status) return null;

  return {
    exerciseId: input.exerciseId,
    status: input.status,
    hint: input.hint,
  };
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
    if (isUser) {
      return (
        <div className="flex w-full justify-end items-start">
          <div className="max-w-[85%] px-4 py-2 bg-primary text-primary-foreground">
            <div className="space-y-2">
              {message.contentBlocks.map((block, index) => {
                if (block.type === "text") {
                  return (
                    <div key={`text-${index}`} className="text-sm">
                      <Markdown id={message.id}>{block.text}</Markdown>
                    </div>
                  );
                }
                if (block.type === "tool_call") {
                  return <Tool key={block.toolCall.id} toolCall={block.toolCall} />;
                }
                return null;
              })}
            </div>
          </div>
        </div>
      );
    }

    return (
      <div style={{ width: "85%" }} className="text-foreground">
        <div className="space-y-2">
          {message.contentBlocks.map((block, index) => {
            if (block.type === "text") {
              return (
                <div key={`text-${index}`} className="text-sm">
                  <Markdown id={message.id}>{block.text}</Markdown>
                </div>
              );
            }
            if (block.type === "tool_call") {
              const exerciseId = getExerciseIdFromToolCall(block.toolCall);
              const exercise = exerciseId ? exercises?.[exerciseId] : null;
              const questionId = getQuestionIdFromToolCall(block.toolCall);
              const question = questionId ? conceptQuestions?.[questionId] : null;
              const exerciseUpdate = getExerciseUpdateFromToolCall(block.toolCall);
              const updateExercise = exerciseUpdate ? exercises?.[exerciseUpdate.exerciseId] : null;
              return (
                <div key={block.toolCall.id}>
                  <Tool toolCall={block.toolCall} />
                  {exercise && <ExerciseBlock exercise={exercise} />}
                  {question && (
                    <ConceptQuestionBlock question={question} onAnswer={onConceptAnswer} />
                  )}
                  {exerciseUpdate && (
                    <ExerciseUpdateBlock
                      status={exerciseUpdate.status}
                      hint={exerciseUpdate.hint}
                      exerciseTitle={updateExercise?.title}
                    />
                  )}
                </div>
              );
            }
            return null;
          })}
        </div>
      </div>
    );
  }

  // Fallback to legacy rendering (tool calls first, then content)
  if (isUser) {
    return (
      <div className="flex w-full justify-end items-start">
        <div className="max-w-[85%] px-4 py-2 bg-primary text-primary-foreground">
          <div className="space-y-2">
            {message.content && (
              <div className="text-sm">
                <Markdown id={message.id}>{message.content}</Markdown>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: "85%" }} className="text-foreground">
      <div className="space-y-2">
        {/* Tool calls */}
        {message.toolCalls?.map((toolCall) => {
          const exerciseId = getExerciseIdFromToolCall(toolCall);
          const exercise = exerciseId ? exercises?.[exerciseId] : null;
          const questionId = getQuestionIdFromToolCall(toolCall);
          const question = questionId ? conceptQuestions?.[questionId] : null;
          const exerciseUpdate = getExerciseUpdateFromToolCall(toolCall);
          const updateExercise = exerciseUpdate ? exercises?.[exerciseUpdate.exerciseId] : null;
          return (
            <div key={toolCall.id}>
              <Tool toolCall={toolCall} />
              {exercise && <ExerciseBlock exercise={exercise} />}
              {question && <ConceptQuestionBlock question={question} onAnswer={onConceptAnswer} />}
              {exerciseUpdate && (
                <ExerciseUpdateBlock
                  status={exerciseUpdate.status}
                  hint={exerciseUpdate.hint}
                  exerciseTitle={updateExercise?.title}
                />
              )}
            </div>
          );
        })}

        {message.content && (
          <div className="text-sm">
            <Markdown id={message.id}>{message.content}</Markdown>
          </div>
        )}
      </div>
    </div>
  );
}
