"use client";

import type { Message, Exercise, ToolCall, ContentBlock, ConceptQuestion } from "@/lib/types";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import ExercisePanel from "@/components/Exercise/ExercisePanel";
import { ChatContainerRoot, ChatContainerContent } from "@/components/ui/chat-container";
import { ScrollButton } from "@/components/ui/scroll-button";
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
    description: "Arrays, linked lists, and trees",
  },
];

function EmptyState({
  onSuggestionClick,
  onSendMessage,
  testingMode,
  onTestingModeChange,
}: {
  onSuggestionClick: (message: string) => void;
  onSendMessage: (message: string) => void;
  testingMode?: boolean;
  onTestingModeChange?: (enabled: boolean) => void;
}) {
  return (
    <div className="min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center py-12">
      <div className="flex flex-col items-center w-full max-w-xl">
        {/* Icon + Text */}
        <div className="flex flex-col items-center gap-4">
          <div className="p-3.5 bg-primary/10 text-primary">
            <GraduationCap size={36} weight="duotone" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">What do you want to learn?</h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Describe what you&apos;re trying to learn. I&apos;ll teach the concepts and give you
              hands-on exercises.
            </p>
          </div>
        </div>

        {/* Input */}
        <div className="w-full mb-8 mt-8">
          <MessageInput
            onSend={onSendMessage}
            testingMode={testingMode}
            onTestingModeChange={onTestingModeChange}
          />
        </div>

        {/* Suggestion Chips */}
        <div className="flex flex-wrap justify-center gap-3 mb-4">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion.title}
              onClick={() => onSuggestionClick(`Teach me ${suggestion.title.toLowerCase()}`)}
              className="flex items-start gap-3 flex-1 min-w-[160px] px-3.5 py-3 text-left border border-border bg-card hover:bg-muted hover:border-muted-foreground/20 transition-colors"
            >
              <suggestion.icon
                size={18}
                weight="duotone"
                className="text-primary mt-0.5 shrink-0"
              />
              <div>
                <div className="text-sm font-medium text-foreground">{suggestion.title}</div>
                <div className="text-xs text-muted-foreground">{suggestion.description}</div>
              </div>
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
  conceptQuestions?: Record<string, ConceptQuestion>;
  isStreaming: boolean;
  streamingContent: string;
  streamingToolCalls: ToolCall[];
  streamingContentBlocks: ContentBlock[];
  loading?: boolean;
  onSendMessage: (message: string) => void;
  activeExercise?: Exercise | null;
  onExerciseSubmit?: (code: string, blankValues?: Record<string, string>) => void;
  onExerciseSkip?: () => void;
  onExerciseReset?: () => void;
  onExerciseRetry?: (exerciseId: string, code: string) => void;
  onConceptAnswer?: (questionId: string, optionIndex: number) => void;
  testingMode?: boolean;
  onTestingModeChange?: (enabled: boolean) => void;
  className?: string;
}

export default function Chat({
  messages,
  exercises,
  conceptQuestions,
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
  onExerciseRetry,
  onConceptAnswer,
  testingMode,
  onTestingModeChange,
  className = "",
}: ChatProps) {
  const isEmptyState =
    !loading && messages.length === 0 && !streamingContent && streamingToolCalls.length === 0;

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <ChatContainerRoot className="h-full">
          <ChatContainerContent className="px-4 pt-4 pb-8">
            <div className="w-full max-w-3xl mx-auto">
              {loading ? (
                <div className="h-full flex items-center justify-center">
                  <div className="text-center">
                    <div className="h-7 w-32 bg-muted animate-pulse mx-auto mb-2"></div>
                    <div className="h-5 w-56 bg-muted animate-pulse mx-auto"></div>
                  </div>
                </div>
              ) : isEmptyState ? (
                <EmptyState
                  onSuggestionClick={onSendMessage}
                  onSendMessage={onSendMessage}
                  testingMode={testingMode}
                  onTestingModeChange={onTestingModeChange}
                />
              ) : (
                <MessageList
                  messages={messages}
                  exercises={exercises}
                  conceptQuestions={conceptQuestions}
                  streamingContent={streamingContent}
                  streamingToolCalls={streamingToolCalls}
                  streamingContentBlocks={streamingContentBlocks}
                  isStreaming={isStreaming}
                  onExerciseRetry={onExerciseRetry}
                  onConceptAnswer={onConceptAnswer}
                />
              )}
            </div>
          </ChatContainerContent>
          <div className="absolute bottom-4 left-0 right-0 pointer-events-none px-4">
            <div className="w-full max-w-3xl mx-auto flex justify-end">
              <ScrollButton variant="solid" className="pointer-events-auto shadow-md" />
            </div>
          </div>
        </ChatContainerRoot>
      </div>

      {/* Exercise Panel - shows when there's an active exercise */}
      {activeExercise && (
        <div className="px-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
          <div className="w-full max-w-3xl mx-auto">
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
        <div className="relative z-10 px-4 pb-4">
          <div className="w-full max-w-3xl mx-auto">
            <MessageInput
              onSend={onSendMessage}
              disabled={isStreaming}
              testingMode={testingMode}
              onTestingModeChange={onTestingModeChange}
            />
          </div>
        </div>
      )}
    </div>
  );
}
