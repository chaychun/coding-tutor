"use client";

import type { Message, Exercise, ToolCall, ContentBlock } from "@/lib/types";
import ChatMessage from "./Message";
import ExerciseBlock from "./ExerciseBlock";

interface MessageListProps {
  messages: Message[];
  currentExercise: Exercise | null;
  exercises?: Record<string, Exercise>;
  streamingContent: string;
  streamingToolCalls: ToolCall[];
  streamingContentBlocks: ContentBlock[];
  isStreaming: boolean;
}

export default function MessageList({
  messages,
  currentExercise,
  exercises,
  streamingContent,
  streamingToolCalls,
  streamingContentBlocks,
  isStreaming,
}: MessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div key={message.id}>
          <ChatMessage message={message} exercises={exercises} />
          {/* Show exercise block if this message has one */}
          {message.exercise && <ExerciseBlock exercise={message.exercise} />}
        </div>
      ))}

      {/* Show streaming content with interleaved blocks */}
      {(streamingContent || streamingToolCalls.length > 0 || streamingContentBlocks.length > 0) && (
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
      )}

      {/* Show typing indicator */}
      {isStreaming && !streamingContent && streamingToolCalls.length === 0 && (
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="flex gap-1">
            <span
              className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"
              style={{ animationDelay: "0ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"
              style={{ animationDelay: "150ms" }}
            />
            <span
              className="w-1.5 h-1.5 bg-muted-foreground/50 rounded-full animate-bounce"
              style={{ animationDelay: "300ms" }}
            />
          </div>
          <span className="text-xs">Thinking...</span>
        </div>
      )}

      {/* Show current exercise after messages */}
      {currentExercise && !messages.some((m) => m.exercise?.title === currentExercise.title) && (
        <ExerciseBlock exercise={currentExercise} />
      )}
    </div>
  );
}
