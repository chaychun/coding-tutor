"use client";

import { useState, useMemo } from "react";
import type { ExerciseSubmission, Exercise, ExerciseStatus } from "@/lib/types";
import { CodeBlock, CodeBlockCode, CodeBlockHeader } from "@/components/ui/code-block";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Check,
  Prohibit,
  Clock,
  CaretDown,
  CaretUp,
  ArrowClockwise,
  X,
} from "@phosphor-icons/react";

interface ExerciseSubmissionCardProps {
  submission: ExerciseSubmission;
  exercise?: Exercise;
  onRetry?: (exerciseId: string, code: string) => void;
}

export function ExerciseSubmissionCard({
  submission,
  exercise,
  onRetry,
}: ExerciseSubmissionCardProps) {
  // Detect language from exercise or submission
  const language = exercise?.language || "text";

  // Truncate instructions to ~100 chars
  const truncateInstructions = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + "...";
  };

  // Count lines in code
  const codeLines = (submission.code || "").split("\n");
  const shouldCollapse = codeLines.length > 10;
  const [isExpanded, setIsExpanded] = useState(!shouldCollapse);

  // Find this attempt in the exercise's attempts array
  const attemptInfo = useMemo(() => {
    if (!exercise?.attempts) return null;
    const attemptIndex = exercise.attempts.findIndex((a) => a.id === submission.attemptId);
    if (attemptIndex === -1) return null;
    return {
      attempt: exercise.attempts[attemptIndex],
      attemptNumber: attemptIndex + 1,
      totalAttempts: exercise.attempts.length,
    };
  }, [exercise?.attempts, submission.attemptId]);

  // Get status: prefer attempt-level status, fall back to exercise status
  const displayStatus: ExerciseStatus | undefined =
    attemptInfo?.attempt?.status ?? exercise?.status;

  // Show attempt badge if there are multiple attempts
  const showAttemptBadge = attemptInfo && attemptInfo.totalAttempts > 1;

  // Determine status badge based on attempt status (not exercise status)
  const getStatusBadge = () => {
    if (!displayStatus) {
      return (
        <Badge variant="pending">
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }

    switch (displayStatus) {
      case "passed":
        return (
          <Badge variant="success">
            <Check className="w-3 h-3 mr-1" />
            Passed
          </Badge>
        );
      case "skipped":
        return (
          <Badge variant="muted">
            <Prohibit className="w-3 h-3 mr-1" />
            Skipped
          </Badge>
        );
      case "active":
      case "pending_review":
        return (
          <Badge variant="warning">
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      case "needs_retry":
        return (
          <Badge variant="retry">
            <ArrowClockwise className="w-3 h-3 mr-1" />
            Needs Retry
          </Badge>
        );
      case "failed":
        return (
          <Badge variant="error">
            <X className="w-3 h-3 mr-1" />
            Failed
          </Badge>
        );
      case "passed_with_feedback":
        return (
          <Badge variant="feedback">
            <Check className="w-3 h-3 mr-1" />
            Passed with feedback
          </Badge>
        );
      default:
        return null;
    }
  };

  const displayCode = isExpanded ? submission.code : codeLines.slice(0, 10).join("\n");

  return (
    <Card className="border shadow-none animate-in fade-in slide-in-from-bottom-2 duration-200">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h3 className="font-semibold text-sm">{submission.title}</h3>
              {showAttemptBadge && (
                <Badge variant="outline" className="text-xs font-normal">
                  Attempt {attemptInfo.attemptNumber}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1">
              {truncateInstructions(submission.instructions)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {getStatusBadge()}
            {(exercise?.status === "skipped" || exercise?.status === "failed") && onRetry && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRetry(submission.exerciseId, submission.code)}
              >
                <ArrowClockwise className="w-3 h-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      {/* Hide code section for skipped exercises (no code was submitted) */}
      {displayStatus !== "skipped" && (submission.blankValues || submission.code) && (
        <CardContent className="pt-0">
          {submission.blankValues && Object.keys(submission.blankValues).length > 0 ? (
            <div className="space-y-1.5">
              {Object.entries(submission.blankValues)
                .sort(([a], [b]) => Number(a) - Number(b))
                .map(([idx, value]) => (
                  <div key={idx} className="flex items-center gap-2 text-sm font-mono">
                    <span className="text-muted-foreground text-xs">Blank {Number(idx) + 1}:</span>
                    <code className="bg-muted px-2 py-0.5">{value}</code>
                  </div>
                ))}
            </div>
          ) : submission.code ? (
            <>
              <CodeBlock>
                <CodeBlockHeader language={language} />
                <CodeBlockCode code={displayCode} language={language || "text"} />
              </CodeBlock>
              {shouldCollapse && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="w-full mt-2 text-xs"
                >
                  {isExpanded ? (
                    <>
                      <CaretUp className="w-3 h-3 mr-1" />
                      Show less
                    </>
                  ) : (
                    <>
                      <CaretDown className="w-3 h-3 mr-1" />
                      Show more ({codeLines.length - 10} more lines)
                    </>
                  )}
                </Button>
              )}
            </>
          ) : null}
        </CardContent>
      )}
    </Card>
  );
}
