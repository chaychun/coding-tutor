"use client";

import { CaretDown, CaretRight, ArrowClockwise } from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ExerciseStatus } from "@/lib/types";

interface ExerciseHeaderProps {
  title: string;
  language: string;
  status: ExerciseStatus;
  isCollapsed: boolean;
  onToggle: () => void;
}

export default function ExerciseHeader({
  title,
  language,
  status,
  isCollapsed,
  onToggle,
}: ExerciseHeaderProps) {
  const isRetry = status === "needs_retry";

  return (
    <Button
      variant="ghost"
      className="w-full justify-start gap-2 px-3 py-2 h-auto font-normal hover:bg-muted/50"
      onClick={onToggle}
    >
      {isCollapsed ? (
        <CaretRight className="size-4 shrink-0" />
      ) : (
        <CaretDown className="size-4 shrink-0" />
      )}
      <span className="font-semibold text-sm flex-1 text-left">{title}</span>
      {isRetry && (
        <Badge variant="retry">
          <ArrowClockwise className="w-3 h-3 mr-1" />
          Try again
        </Badge>
      )}
      <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-sm">
        {language}
      </span>
    </Button>
  );
}
