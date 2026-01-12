"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Message, Exercise, ToolCall, ContentBlock } from "@/lib/types";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import ExercisePanel from "@/components/Exercise/ExercisePanel";
import { ScrollArea } from "@/components/ui/scroll-area";

interface ChatProps {
  messages: Message[];
  exercises?: Record<string, Exercise>;
  isStreaming: boolean;
  streamingContent: string;
  streamingToolCalls: ToolCall[];
  streamingContentBlocks: ContentBlock[];
  loading?: boolean;
  onSendMessage: (message: string) => void;
  activeExercise?: Exercise | null;
  onExerciseSubmit?: (code: string) => void;
  onExerciseSkip?: () => void;
  onExerciseReset?: () => void;
  className?: string;
}

export default function Chat({
  messages,
  exercises,
  isStreaming,
  streamingContent,
  streamingToolCalls,
  streamingContentBlocks,
  loading = false,
  onSendMessage,
  activeExercise,
  onExerciseSubmit,
  onExerciseSkip,
  onExerciseReset,
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
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <ScrollArea
          className="h-full"
          viewportRef={scrollRef}
          onScroll={handleScroll}
          viewportClassName="px-4 pt-4 pb-8"
        >
          <div className="max-w-3xl mx-auto">
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
                exercises={exercises}
                streamingContent={streamingContent}
                streamingToolCalls={streamingToolCalls}
                streamingContentBlocks={streamingContentBlocks}
                isStreaming={isStreaming}
              />
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Exercise Panel - shows when there's an active exercise */}
      {activeExercise && (
        <div className="border-t border-border">
          <div className="max-w-3xl mx-auto">
            <ExercisePanel
              exercise={activeExercise}
              onSubmit={onExerciseSubmit || (() => {})}
              onSkip={onExerciseSkip || (() => {})}
              onReset={onExerciseReset || (() => {})}
              disabled={isStreaming}
            />
          </div>
        </div>
      )}

      {/* Input */}
      <div className="px-4 pb-4">
        <div className="max-w-3xl mx-auto">
          <MessageInput onSend={onSendMessage} disabled={isStreaming} />
        </div>
      </div>
    </div>
  );
}
