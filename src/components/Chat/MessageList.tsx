"use client";

import { useRef, useEffect } from "react";
import type { Message, Exercise, ConceptQuestion } from "@/lib/types";
import ChatMessage from "./Message";
import ExerciseBlock from "./ExerciseBlock";
import { TextShimmer } from "@/components/motion-primitives/text-shimmer";

interface MessageListProps {
  messages: Message[];
  exercises?: Record<string, Exercise>;
  conceptQuestions?: Record<string, ConceptQuestion>;
  isStreaming: boolean;
  onExerciseRetry?: (exerciseId: string, code: string) => void;
  onConceptAnswer?: (questionId: string, optionIndex: number) => void;
}

export default function MessageList({
  messages,
  exercises,
  conceptQuestions,
  isStreaming,
  onExerciseRetry,
  onConceptAnswer,
}: MessageListProps) {
  const isInitialRender = useRef(true);
  const prevMessageCount = useRef(messages.length);

  useEffect(() => {
    isInitialRender.current = false;
  }, []);

  const animateFromIndex = isInitialRender.current ? Infinity : prevMessageCount.current;

  useEffect(() => {
    prevMessageCount.current = messages.length;
  }, [messages.length]);

  // Show a thinking indicator only when the agent is running and there's no
  // assistant message yet for this turn (i.e. the last message is from the user).
  const showThinking =
    isStreaming &&
    (messages.length === 0 || messages[messages.length - 1].role === "user");

  return (
    <div className="w-full space-y-4">
      {messages.map((message, index) => (
        <div
          key={message.id}
          className={
            index >= animateFromIndex
              ? "animate-in fade-in slide-in-from-bottom-2 duration-200"
              : ""
          }
        >
          <ChatMessage
            message={message}
            exercises={exercises}
            conceptQuestions={conceptQuestions}
            onRetry={onExerciseRetry}
            onConceptAnswer={onConceptAnswer}
          />
          {message.exercise && <ExerciseBlock exercise={message.exercise} />}
        </div>
      ))}

      {showThinking && (
        <div className="animate-in fade-in duration-300">
          <TextShimmer duration={1.5} className="text-sm font-medium">
            Thinking...
          </TextShimmer>
        </div>
      )}
    </div>
  );
}
