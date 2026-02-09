"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { Exercise } from "@/lib/types";
import ExerciseHeader from "./ExerciseHeader";
import ExerciseInstructions from "./ExerciseInstructions";
import ExerciseEditor from "./ExerciseEditor";
import FillInBlankEditor from "./FillInBlankEditor";
import ExerciseActions from "./ExerciseActions";

interface ExercisePanelProps {
  exercise: Exercise;
  onSubmit: (code: string, blankValues?: Record<string, string>) => void;
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
  const exerciseType = exercise.type;
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [resetKey, setResetKey] = useState(0);

  // Code state — used for write_code exercises
  const [code, setCode] = useState(() => {
    if (exercise.attempts.length > 0) {
      return exercise.attempts[exercise.attempts.length - 1].code;
    }
    return exercise.starterCode;
  });

  // Blank values state — used for fill_in_blank exercises
  const [, setBlankValues] = useState<Record<string, string>>(() => {
    if (exercise.attempts.length > 0) {
      return exercise.attempts[exercise.attempts.length - 1].blankValues ?? {};
    }
    return {};
  });

  // Ref tracks latest blank values for reliable access at submit time
  // (avoids stale closure if React hasn't re-rendered yet)
  const blankValuesRef = useRef<Record<string, string>>(
    exercise.attempts.length > 0
      ? (exercise.attempts[exercise.attempts.length - 1].blankValues ?? {})
      : {}
  );
  const handleBlankValuesChange = useCallback((values: Record<string, string>) => {
    blankValuesRef.current = values;
    setBlankValues(values);
  }, []);

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

  // Update code and blank values when exercise changes
  useEffect(() => {
    setIsPending(false);
    if (exercise.attempts.length > 0) {
      const lastAttempt = exercise.attempts[exercise.attempts.length - 1];
      setCode(lastAttempt.code);
      const bv = lastAttempt.blankValues ?? {};
      setBlankValues(bv);
      blankValuesRef.current = bv;
    } else {
      setCode(exercise.starterCode);
      setBlankValues({});
      blankValuesRef.current = {};
    }
  }, [exercise.id, exercise.attempts, exercise.starterCode]);

  const handleSubmit = () => {
    setIsPending(true);
    // Store timeout ref BEFORE calling onSubmit to ensure cleanup can happen
    // even if onSubmit triggers a synchronous unmount
    const timeoutId = setTimeout(() => setIsPending(false), 1000);
    pendingTimeoutRef.current = timeoutId;

    if (exerciseType === "fill_in_blank") {
      onSubmit(exercise.starterCode, blankValuesRef.current);
    } else {
      onSubmit(code);
    }
  };

  const handleReset = () => {
    if (exerciseType === "fill_in_blank") {
      setBlankValues({});
      blankValuesRef.current = {};
      setResetKey((k) => k + 1);
    } else {
      setCode(exercise.starterCode);
    }
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

          {exerciseType === "fill_in_blank" ? (
            <FillInBlankEditor
              key={`${exercise.id}-${resetKey}`}
              starterCode={exercise.starterCode}
              language={exercise.language}
              onBlankValuesChange={handleBlankValuesChange}
              initialBlankValues={
                exercise.attempts.length > 0
                  ? exercise.attempts[exercise.attempts.length - 1].blankValues
                  : undefined
              }
            />
          ) : (
            <ExerciseEditor code={code} language={exercise.language} onChange={setCode} />
          )}

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
