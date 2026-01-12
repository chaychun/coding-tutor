"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Message, Exercise, ToolCall, ContentBlock } from "@/lib/types";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatProps {
  messages: Message[];
  currentExercise: Exercise | null;
  exercises?: Record<string, Exercise>;
  isStreaming: boolean;
  streamingContent: string;
  streamingToolCalls: ToolCall[];
  streamingContentBlocks: ContentBlock[];
  loading?: boolean;
  onSendMessage: (message: string) => void;
  className?: string;
}

export default function Chat({
  messages,
  currentExercise,
  exercises,
  isStreaming,
  streamingContent,
  streamingToolCalls,
  streamingContentBlocks,
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
    <div className={`flex flex-col overflow-hidden ${className}`}>
      {/* Header */}
      <div className="px-4 py-3 border-b border-border">
        <h2 className="font-semibold">Chat</h2>
      </div>

      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <ScrollArea
          className="h-full"
          viewportRef={scrollRef}
          onScroll={handleScroll}
          viewportClassName="px-6 pt-4 pb-8"
        >
          {loading ? (
            // Skeleton that matches the empty state layout
            <div className="h-full flex items-center justify-center">
              <div className="text-center">
                <div className="h-7 w-32 bg-muted animate-pulse mx-auto mb-2"></div>
                <div className="h-5 w-56 bg-muted animate-pulse mx-auto"></div>
              </div>
            </div>
          ) : messages.length === 0 && !streamingContent && streamingToolCalls.length === 0 ? (
            <div className="h-full flex items-center justify-center">
              <div className="text-center text-muted-foreground">
                <p className="text-lg mb-2">Ready to learn!</p>
                <p className="text-sm">Tell me what you&apos;d like to learn today.</p>
              </div>
            </div>
          ) : (
            <MessageList
              messages={messages}
              currentExercise={currentExercise}
              exercises={exercises}
              streamingContent={streamingContent}
              streamingToolCalls={streamingToolCalls}
              streamingContentBlocks={streamingContentBlocks}
              isStreaming={isStreaming}
            />
          )}
        </ScrollArea>
      </div>

      {/* Input - wider than message content area */}
      <div className="px-4 pb-4">
        <MessageInput onSend={onSendMessage} disabled={isStreaming} />
      </div>
    </div>
  );
}
