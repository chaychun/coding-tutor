"use client";

import { useState, useEffect, useRef } from "react";
import type { Exercise } from "@/lib/types";
import ExerciseHeader from "./ExerciseHeader";
import ExerciseInstructions from "./ExerciseInstructions";
import ExerciseEditor from "./ExerciseEditor";
import ExerciseActions from "./ExerciseActions";

interface ExercisePanelProps {
  exercise: Exercise;
  onSubmit: (code: string) => void;
  onSkip: () => void;
  onReset: () => void;
  disabled?: boolean;
}

export default function ExercisePanel({
  exercise,
  onSubmit,
  onSkip,
  onReset,
  disabled = false,
}: ExercisePanelProps) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [code, setCode] = useState(() => {
    // Initialize from last attempt if exists, otherwise use starter code
    if (exercise.attempts.length > 0) {
      return exercise.attempts[exercise.attempts.length - 1].code;
    }
    return exercise.starterCode;
  });
  const [isPending, setIsPending] = useState(false);
  const pendingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Clear timeout on unmount or when exercise changes to prevent memory leak
  // and avoid state updates after the component is no longer relevant
  useEffect(() => {
    return () => {
      if (pendingTimeoutRef.current) {
        clearTimeout(pendingTimeoutRef.current);
        pendingTimeoutRef.current = null;
      }
    };
  }, [exercise.id]);

  // Update code when exercise changes
  useEffect(() => {
    // Reset pending state when exercise changes
    setIsPending(false);

    if (exercise.attempts.length > 0) {
      setCode(exercise.attempts[exercise.attempts.length - 1].code);
    } else {
      setCode(exercise.starterCode);
    }
  }, [exercise.id, exercise.attempts, exercise.starterCode]);

  const handleSubmit = () => {
    setIsPending(true);
    // Store timeout ref BEFORE calling onSubmit to ensure cleanup can happen
    // even if onSubmit triggers a synchronous unmount
    const timeoutId = setTimeout(() => setIsPending(false), 1000);
    pendingTimeoutRef.current = timeoutId;
    onSubmit(code);
  };

  const handleReset = () => {
    setCode(exercise.starterCode);
    onReset();
  };

  return (
    <div className="ring-1 ring-border bg-background overflow-hidden">
      <ExerciseHeader
        title={exercise.title}
        language={exercise.language}
        status={exercise.status}
        isCollapsed={isCollapsed}
        onToggle={() => setIsCollapsed(!isCollapsed)}
      />

      {!isCollapsed && (
        <div className="animate-in slide-in-from-top-2 duration-200">
          <ExerciseInstructions instructions={exercise.instructions} hints={exercise.hints} />
          <ExerciseEditor
            code={code}
            language={exercise.language}
            onChange={setCode}
            disabled={disabled}
          />
          <ExerciseActions
            onSubmit={handleSubmit}
            onSkip={onSkip}
            onReset={handleReset}
            disabled={disabled}
            isPending={isPending}
          />
        </div>
      )}
    </div>
  );
}
