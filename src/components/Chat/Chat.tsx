"use client";

import { useRef, useEffect, useCallback } from "react";
import type { Message, Exercise, ToolCall, ContentBlock } from "@/lib/types";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import ExercisePanel from "@/components/Exercise/ExercisePanel";
import { ScrollArea } from "@/components/ui/scroll-area";
import { GraduationCap, Code, Lightning, BookOpen } from "@phosphor-icons/react";

const suggestions = [
  {
    icon: Code,
    title: "Python basics",
    description: "Variables, loops, and functions",
  },
  {
    icon: Lightning,
    title: "JavaScript fundamentals",
    description: "DOM, events, and async",
  },
  {
    icon: BookOpen,
    title: "Data structures",
    description: "Arrays, trees, and graphs",
  },
];

function EmptyState({
  onSuggestionClick,
  onSendMessage,
}: {
  onSuggestionClick: (message: string) => void;
  onSendMessage: (message: string) => void;
}) {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center py-12">
      <div className="flex flex-col items-center gap-6 w-full max-w-xl">
        {/* Icon */}
        <div className="p-4 bg-primary/10 text-primary">
          <GraduationCap size={48} weight="duotone" />
        </div>

        {/* Text */}
        <div className="text-center space-y-2">
          <h2 className="text-xl font-semibold text-foreground">Ready to learn?</h2>
          <p className="text-muted-foreground">
            Ask me anything about programming. I&apos;ll explain concepts and give you exercises to
            practice.
          </p>
        </div>

        {/* Centered Input */}
        <div className="w-full">
          <MessageInput onSend={onSendMessage} />
        </div>

        {/* Subtle Suggestions */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.title}
              onClick={() => onSuggestionClick(`Teach me ${suggestion.title.toLowerCase()}`)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground hover:bg-muted border border-transparent hover:border-border"
            >
              <suggestion.icon size={14} weight="bold" />
              {suggestion.title}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

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

  const isEmptyState =
    !loading && messages.length === 0 && !streamingContent && streamingToolCalls.length === 0;

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
            ) : isEmptyState ? (
              <EmptyState onSuggestionClick={onSendMessage} onSendMessage={onSendMessage} />
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

      {/* Input - hidden when showing empty state (input is embedded there) */}
      {!isEmptyState && (
        <div className="px-4 pb-4">
          <div className="max-w-3xl mx-auto">
            <MessageInput onSend={onSendMessage} disabled={isStreaming} />
          </div>
        </div>
      )}
    </div>
  );
}
