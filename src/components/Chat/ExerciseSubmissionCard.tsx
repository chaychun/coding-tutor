"use client";

import { useState } from "react";
import type { ExerciseSubmission, Exercise } from "@/lib/types";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";
import { useTheme } from "@/components/theme-provider";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Check, Ban, Clock, ChevronDown, ChevronUp } from "lucide-react";

interface ExerciseSubmissionCardProps {
  submission: ExerciseSubmission;
  exercise?: Exercise; // Linked exercise for status (may be undefined)
}

// Custom light theme matching the Lyra stone/yellow palette
const lightTheme = {
  'pre[class*="language-"]': {
    background: "oklch(0.97 0.001 106.424)",
    color: "oklch(0.147 0.004 49.25)",
  },
  'code[class*="language-"]': {
    background: "oklch(0.97 0.001 106.424)",
    color: "oklch(0.147 0.004 49.25)",
  },
  comment: { color: "oklch(0.553 0.013 58.071)" },
  prolog: { color: "oklch(0.553 0.013 58.071)" },
  doctype: { color: "oklch(0.553 0.013 58.071)" },
  cdata: { color: "oklch(0.553 0.013 58.071)" },
  punctuation: { color: "oklch(0.421 0.095 57.708)" },
  property: { color: "oklch(0.577 0.245 27.325)" },
  tag: { color: "oklch(0.577 0.245 27.325)" },
  boolean: { color: "oklch(0.577 0.245 27.325)" },
  number: { color: "oklch(0.577 0.245 27.325)" },
  constant: { color: "oklch(0.577 0.245 27.325)" },
  symbol: { color: "oklch(0.577 0.245 27.325)" },
  deleted: { color: "oklch(0.577 0.245 27.325)" },
  selector: { color: "oklch(0.681 0.162 75.834)" },
  "attr-name": { color: "oklch(0.681 0.162 75.834)" },
  string: { color: "oklch(0.681 0.162 75.834)" },
  char: { color: "oklch(0.681 0.162 75.834)" },
  builtin: { color: "oklch(0.681 0.162 75.834)" },
  inserted: { color: "oklch(0.681 0.162 75.834)" },
  operator: { color: "oklch(0.421 0.095 57.708)" },
  entity: { color: "oklch(0.421 0.095 57.708)" },
  url: { color: "oklch(0.421 0.095 57.708)" },
  ".language-css .token.string": { color: "oklch(0.421 0.095 57.708)" },
  ".style .token.string": { color: "oklch(0.421 0.095 57.708)" },
  atrule: { color: "oklch(0.852 0.199 91.936)" },
  "attr-value": { color: "oklch(0.852 0.199 91.936)" },
  keyword: { color: "oklch(0.852 0.199 91.936)" },
  function: { color: "oklch(0.554 0.135 66.442)" },
  "class-name": { color: "oklch(0.554 0.135 66.442)" },
  regex: { color: "oklch(0.681 0.162 75.834)" },
  important: { color: "oklch(0.681 0.162 75.834)", fontWeight: "bold" },
  variable: { color: "oklch(0.421 0.095 57.708)" },
};

export function ExerciseSubmissionCard({ submission, exercise }: ExerciseSubmissionCardProps) {
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

  // Determine status badge
  const getStatusBadge = () => {
    if (!exercise) {
      return (
        <Badge
          variant="secondary"
          className="bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300"
        >
          <Clock className="w-3 h-3 mr-1" />
          Pending
        </Badge>
      );
    }

    switch (exercise.status) {
      case "passed":
        return (
          <Badge
            variant="secondary"
            className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300"
          >
            <Check className="w-3 h-3 mr-1" />
            Passed
          </Badge>
        );
      case "skipped":
        return (
          <Badge
            variant="secondary"
            className="bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300"
          >
            <Ban className="w-3 h-3 mr-1" />
            Skipped
          </Badge>
        );
      case "pending_review":
        return (
          <Badge
            variant="secondary"
            className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
          >
            <Clock className="w-3 h-3 mr-1" />
            Pending
          </Badge>
        );
      default:
        return null;
    }
  };

  const displayCode = isExpanded ? submission.code : codeLines.slice(0, 10).join("\n");

  return (
    <Card className="border-2">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1">
            <h3 className="font-semibold text-sm">{submission.title}</h3>
            <p className="text-xs text-muted-foreground mt-1">
              {truncateInstructions(submission.instructions)}
            </p>
          </div>
          {getStatusBadge()}
        </div>
      </CardHeader>
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
              background: isDark ? undefined : "oklch(0.97 0.001 106.424)",
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
                <ChevronUp className="w-3 h-3 mr-1" />
                Show less
              </>
            ) : (
              <>
                <ChevronDown className="w-3 h-3 mr-1" />
                Show more ({codeLines.length - 10} more lines)
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
