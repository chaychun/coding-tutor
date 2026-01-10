"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Message, Exercise, ToolCall } from "@/lib/types";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";

interface ChatProps {
  messages: Message[];
  currentExercise: Exercise | null;
  isStreaming: boolean;
  streamingContent: string;
  streamingToolCalls: ToolCall[];
  loading?: boolean;
  onSendMessage: (message: string) => void;
  className?: string;
}

export default function Chat({
  messages,
  currentExercise,
  isStreaming,
  streamingContent,
  streamingToolCalls,
  loading = false,
  onSendMessage,
  className = "",
}: ChatProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isUserScrolledUpRef = useRef(false);

  // Track if user has scrolled up from bottom
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    // Consider "at bottom" if within 100px of the bottom
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 100;
    isUserScrolledUpRef.current = !isAtBottom;
  }, []);

  // Auto-scroll to bottom when content changes, but only if user hasn't scrolled up
  useEffect(() => {
    if (scrollRef.current && !isUserScrolledUpRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingToolCalls.length]);

  // Also scroll on streaming content updates, but only if user hasn't scrolled up
  useEffect(() => {
    if (scrollRef.current && !isUserScrolledUpRef.current && streamingContent) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [streamingContent]);

  return (
    <div className={`flex flex-col ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-200 dark:border-gray-800">
        <h2 className="font-semibold">Chat</h2>
      </div>

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto p-4">
        {loading ? (
          // Skeleton that matches the empty state layout
          <div className="h-full flex items-center justify-center">
            <div className="text-center">
              <div className="h-7 w-32 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto mb-2"></div>
              <div className="h-5 w-56 bg-gray-200 dark:bg-gray-700 rounded animate-pulse mx-auto"></div>
            </div>
          </div>
        ) : messages.length === 0 && !streamingContent && streamingToolCalls.length === 0 ? (
          <div className="h-full flex items-center justify-center">
            <div className="text-center text-gray-500">
              <p className="text-lg mb-2">Ready to learn!</p>
              <p className="text-sm">Tell me what you&apos;d like to learn today.</p>
            </div>
          </div>
        ) : (
          <MessageList
            messages={messages}
            currentExercise={currentExercise}
            streamingContent={streamingContent}
            streamingToolCalls={streamingToolCalls}
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
