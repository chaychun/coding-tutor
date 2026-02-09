"use client";

import { useRef, useEffect } from "react";
import type { Message, Exercise, ToolCall, ContentBlock, ConceptQuestion } from "@/lib/types";
import ChatMessage from "./Message";
import ExerciseBlock from "./ExerciseBlock";
import { TextShimmer } from "@/components/motion-primitives/text-shimmer";

interface MessageListProps {
  messages: Message[];
  exercises?: Record<string, Exercise>;
  conceptQuestions?: Record<string, ConceptQuestion>;
  streamingContent: string;
  streamingToolCalls: ToolCall[];
  streamingContentBlocks: ContentBlock[];
  isStreaming: boolean;
  onExerciseRetry?: (exerciseId: string, code: string) => void;
  onConceptAnswer?: (questionId: string, optionIndex: number) => void;
}

export default function MessageList({
  messages,
  exercises,
  conceptQuestions,
  streamingContent,
  streamingToolCalls,
  streamingContentBlocks,
  isStreaming,
  onExerciseRetry,
  onConceptAnswer,
}: MessageListProps) {
  const isInitialRender = useRef(true);
  const prevMessageCount = useRef(messages.length);

  useEffect(() => {
    // After first render, mark as no longer initial
    isInitialRender.current = false;
  }, []);

  // Track previous message count for animation gating
  const animateFromIndex = isInitialRender.current ? Infinity : prevMessageCount.current;

  useEffect(() => {
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  return (
    <div className="w-full space-y-4">
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={
            index >= animateFromIndex
              ? "animate-in fade-in slide-in-from-bottom-2 duration-200"
              : ""
          }
        >
          <ChatMessage
            message={message}
            exercises={exercises}
            conceptQuestions={conceptQuestions}
            onRetry={onExerciseRetry}
            onConceptAnswer={onConceptAnswer}
          />
          {/* Show exercise block if this message has one */}
          {message.exercise && <ExerciseBlock exercise={message.exercise} />}
        </div>
      ))}

      {/* Show streaming content with interleaved blocks */}
      {(streamingContent || streamingToolCalls.length > 0 || streamingContentBlocks.length > 0) && (
        <div className="animate-in fade-in slide-in-from-bottom-2 duration-200">
          <ChatMessage
            message={{
              id: "streaming",
              role: "assistant",
              content: streamingContent,
              timestamp: new Date().toISOString(),
              toolCalls: streamingToolCalls.length > 0 ? streamingToolCalls : undefined,
              contentBlocks: streamingContentBlocks.length > 0 ? streamingContentBlocks : undefined,
            }}
            exercises={exercises}
            conceptQuestions={conceptQuestions}
            onConceptAnswer={onConceptAnswer}
          />
        </div>
      )}

      {/* Show thinking indicator */}
      {isStreaming && !streamingContent && streamingToolCalls.length === 0 && (
        <div className="animate-in fade-in duration-300">
          <TextShimmer duration={1.5} className="text-sm font-medium">
            Thinking...
          </TextShimmer>
        </div>
      )}
    </div>
  );
}
