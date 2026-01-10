"use client";

import type { Message, Exercise } from "@/lib/types";
import ChatMessage from "./Message";
import ExerciseBlock from "./ExerciseBlock";

interface MessageListProps {
  messages: Message[];
  currentExercise: Exercise | null;
  streamingContent: string;
  isStreaming: boolean;
}

export default function MessageList({
  messages,
  currentExercise,
  streamingContent,
  isStreaming,
}: MessageListProps) {
  return (
    <div className="space-y-4">
      {messages.map((message) => (
        <div key={message.id}>
          <ChatMessage message={message} />
          {/* Show exercise block if this message has one */}
          {message.exercise && <ExerciseBlock exercise={message.exercise} />}
        </div>
      ))}

      {/* Show streaming content */}
      {streamingContent && (
        <ChatMessage
          message={{
            id: "streaming",
            role: "assistant",
            content: streamingContent,
            timestamp: new Date().toISOString(),
          }}
        />
      )}

      {/* Show typing indicator */}
      {isStreaming && !streamingContent && (
        <div className="flex items-center gap-2 text-gray-500">
          <div className="flex gap-1">
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
            <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
          </div>
          <span className="text-sm">Thinking...</span>
        </div>
      )}

      {/* Show current exercise after messages */}
      {currentExercise && !messages.some((m) => m.exercise?.title === currentExercise.title) && (
        <ExerciseBlock exercise={currentExercise} />
      )}
    </div>
  );
}
