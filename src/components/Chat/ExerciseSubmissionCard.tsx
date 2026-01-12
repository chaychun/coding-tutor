"use client";

import { useState, useMemo } from "react";
import type { ExerciseSubmission, Exercise, ExerciseStatus } from "@/lib/types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/components/theme-provider";
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
  exercise?: Exercise; // Linked exercise for status (may be undefined)
  onRetry?: (exerciseId: string, code: string) => void;
}

// Custom light theme matching the Lyra stone/yellow palette
// Using hex fallbacks for browser compatibility (oklch not supported in Safari <15.4)
const lightTheme = {
  'pre[class*="language-"]': {
    background: "#f7f6f4", // oklch(0.97 0.001 106.424)
    color: "#1c1917", // oklch(0.147 0.004 49.25)
  },
  'code[class*="language-"]': {
    background: "#f7f6f4", // oklch(0.97 0.001 106.424)
    color: "#1c1917", // oklch(0.147 0.004 49.25)
  },
  comment: { color: "#78716c" }, // oklch(0.553 0.013 58.071)
  prolog: { color: "#78716c" },
  doctype: { color: "#78716c" },
  cdata: { color: "#78716c" },
  punctuation: { color: "#6b5c4d" }, // oklch(0.421 0.095 57.708)
  property: { color: "#c2410c" }, // oklch(0.577 0.245 27.325)
  tag: { color: "#c2410c" },
  boolean: { color: "#c2410c" },
  number: { color: "#c2410c" },
  constant: { color: "#c2410c" },
  symbol: { color: "#c2410c" },
  deleted: { color: "#c2410c" },
  selector: { color: "#a16207" }, // oklch(0.681 0.162 75.834)
  "attr-name": { color: "#a16207" },
  string: { color: "#a16207" },
  char: { color: "#a16207" },
  builtin: { color: "#a16207" },
  inserted: { color: "#a16207" },
  operator: { color: "#6b5c4d" }, // oklch(0.421 0.095 57.708)
  entity: { color: "#6b5c4d" },
  url: { color: "#6b5c4d" },
  ".language-css .token.string": { color: "#6b5c4d" },
  ".style .token.string": { color: "#6b5c4d" },
  atrule: { color: "#eab308" }, // oklch(0.852 0.199 91.936)
  "attr-value": { color: "#eab308" },
  keyword: { color: "#eab308" },
  function: { color: "#92400e" }, // oklch(0.554 0.135 66.442)
  "class-name": { color: "#92400e" },
  regex: { color: "#a16207" },
  important: { color: "#a16207", fontWeight: "bold" },
  variable: { color: "#6b5c4d" },
};

export function ExerciseSubmissionCard({
  submission,
  exercise,
  onRetry,
}: ExerciseSubmissionCardProps) {
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === "dark";

  // Detect language from exercise or submission
  const language = exercise?.language || "text";

  // Truncate instructions to ~100 chars
  const truncateInstructions = (text: string, maxLength: number = 100) => {
    if (text.length <= maxLength) return text;
    return text.slice(0, maxLength).trim() + "...";
  };

  // Count lines in code
  const codeLines = submission.code.split("\n");
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
    <Card className="border shadow-none">
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
            {/* Show retry button for skipped/failed exercises where the user may want to revisit.
                Don't show for needs_retry since the exercise block is already shown for that.
                Use exercise.status (not attempt status) to determine if retry should be shown,
                since we want to allow retry only after the exercise has been finalized. */}
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
      {displayStatus !== "skipped" && submission.code && (
        <CardContent className="pt-0">
          <div className="ring-1 ring-border overflow-hidden">
            {language && (
              <div className="bg-muted/80 text-muted-foreground text-[10px] font-medium uppercase tracking-wider px-3 py-1.5 border-b border-border">
                {language}
              </div>
            )}
            <SyntaxHighlighter
              style={isDark ? oneDark : lightTheme}
              language={language || "text"}
              PreTag="div"
              codeTagProps={{
                style: { borderRadius: 0 },
              }}
              customStyle={{
                margin: 0,
                borderRadius: 0,
                fontSize: "0.75rem",
                lineHeight: "1.6",
                padding: "1rem",
                background: isDark ? undefined : "#f7f6f4", // oklch(0.97 0.001 106.424)
              }}
            >
              {displayCode}
            </SyntaxHighlighter>
          </div>
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
        </CardContent>
      )}
    </Card>
  );
}
