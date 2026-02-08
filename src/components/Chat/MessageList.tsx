"use client";

import { useRef, useEffect } from "react";
import type { Message, Exercise, ToolCall, ContentBlock } from "@/lib/types";
import ChatMessage from "./Message";
import ExerciseBlock from "./ExerciseBlock";
import { Loader } from "@/components/ui/loader";

interface MessageListProps {
  messages: Message[];
  exercises?: Record<string, Exercise>;
  streamingContent: string;
  streamingToolCalls: ToolCall[];
  streamingContentBlocks: ContentBlock[];
  isStreaming: boolean;
  onExerciseRetry?: (exerciseId: string, code: string) => void;
}

export default function MessageList({
  messages,
  exercises,
  streamingContent,
  streamingToolCalls,
  streamingContentBlocks,
  isStreaming,
  onExerciseRetry,
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
          className={index >= animateFromIndex ? "animate-in fade-in slide-in-from-bottom-2 duration-200" : ""}
        >
          <ChatMessage message={message} exercises={exercises} onRetry={onExerciseRetry} />
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
          />
        </div>
      )}

      {/* Show typing indicator */}
      {isStreaming && !streamingContent && streamingToolCalls.length === 0 && (
        <div className="flex items-center gap-2 text-muted-foreground animate-in fade-in duration-200">
          <Loader variant="typing" size="sm" />
          <span className="text-xs">Thinking...</span>
        </div>
      )}
    </div>
  );
}
