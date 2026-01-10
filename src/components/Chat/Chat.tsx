"use client";

import { useRef, useEffect } from "react";
import type { Message, Exercise } from "@/lib/types";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

interface ChatProps {
  messages: Message[];
  currentExercise: Exercise | null;
  isStreaming: boolean;
  streamingContent: string;
  onSendMessage: (message: string) => void;
  className?: string;
}

export default function Chat({
  messages,
  currentExercise,
  isStreaming,
  streamingContent,
  onSendMessage,
  className = "",
}: ChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h2 className="font-semibold">Chat</h2>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4">
        {messages.length === 0 && !streamingContent ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">Ready to learn!</p>
              <p className="text-sm">
                Tell me what you&apos;d like to learn today.
              </p>
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            currentExercise={currentExercise}
            streamingContent={streamingContent}
            isStreaming={isStreaming}
          />
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-800">
        <MessageInput onSend={onSendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
}
