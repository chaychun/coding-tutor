"use client";

import type { Message, Exercise, ConceptQuestion } from "@/lib/types";
import MessageList from "./MessageList";
import MessageInput from "./MessageInput";
import ExercisePanel from "@/components/Exercise/ExercisePanel";
import {
  ChatContainerRoot,
  ChatContainerContent,
} from "@/components/ui/chat-container";
import { ScrollButton } from "@/components/ui/scroll-button";
import {
  GraduationCapIcon,
  CodeIcon,
  LightningIcon,
  BookOpenIcon,
} from "@phosphor-icons/react";

const suggestions = [
  {
    icon: CodeIcon,
    title: "Python basics",
    description: "Variables, loops, and functions",
  },
  {
    icon: LightningIcon,
    title: "JavaScript fundamentals",
    description: "DOM, events, and async",
  },
  {
    icon: BookOpenIcon,
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
            <GraduationCapIcon size={36} weight="duotone" />
          </div>

          <div className="text-center space-y-2">
            <h2 className="text-xl font-semibold text-foreground">
              What do you want to learn?
            </h2>
            <p className="text-muted-foreground max-w-sm mx-auto">
              Describe what you&apos;re trying to learn. I&apos;ll teach the
              concepts and give you hands-on exercises.
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
              onClick={() =>
                onSuggestionClick(`Teach me ${suggestion.title.toLowerCase()}`)
              }
              className="flex items-start gap-3 flex-1 min-w-40 px-3.5 py-3 text-left border border-border bg-card hover:bg-muted hover:border-muted-foreground/20 transition-colors"
            >
              <suggestion.icon
                size={18}
                weight="duotone"
                className="text-primary mt-0.5 shrink-0"
              />
              <div>
                <div className="text-sm font-medium text-foreground">
                  {suggestion.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {suggestion.description}
                </div>
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
  onSendMessage: (message: string) => void;
  activeExercise?: Exercise | null;
  onExerciseSubmit?: (
    code: string,
    blankValues?: Record<string, string>,
  ) => void;
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
  const isEmptyState = messages.length === 0 && !isStreaming;

  return (
    <div className={`flex flex-col h-full overflow-hidden ${className}`}>
      {/* Messages */}
      <div className="relative flex-1 min-h-0">
        <ChatContainerRoot className="h-full">
          <ChatContainerContent className="px-4 pt-4 pb-8">
            <div className="w-full max-w-3xl mx-auto">
              {isEmptyState ? (
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
                  isStreaming={isStreaming}
                  onExerciseRetry={onExerciseRetry}
                  onConceptAnswer={onConceptAnswer}
                />
              )}
            </div>
          </ChatContainerContent>
          <div className="absolute bottom-4 left-0 right-0 pointer-events-none px-4">
            <div className="w-full max-w-3xl mx-auto flex justify-end">
              <ScrollButton
                variant="solid"
                className="pointer-events-auto shadow-md"
              />
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
