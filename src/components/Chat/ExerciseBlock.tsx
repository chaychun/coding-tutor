"use client";

import type { Exercise } from "@/lib/types";
import { Markdown } from "@/components/ui/markdown";

interface ExerciseBlockProps {
  exercise: Exercise;
}

export default function ExerciseBlock({ exercise }: ExerciseBlockProps) {
  return (
    <div className="my-4 ring-1 ring-border overflow-hidden animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Header */}
      <div className="bg-primary/10 px-4 py-2 flex items-center justify-between border-b border-border">
        <h3 className="font-semibold text-primary">{exercise.title}</h3>
        <span className="text-xs px-2 py-1 bg-primary/20 text-primary font-medium">
          {exercise.language}
        </span>
      </div>

      {/* Instructions */}
      <div className="p-4 space-y-3">
        <div>
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
            Instructions
          </h4>
          <div className="text-sm">
            <Markdown>{exercise.instructions}</Markdown>
          </div>
        </div>

        <div>
          <h4 className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-1.5">
            Expected Behavior
          </h4>
          <div className="text-sm text-muted-foreground">
            <Markdown>{exercise.expectedBehavior}</Markdown>
          </div>
        </div>
      </div>

      {/* Hint */}
      <div className="px-4 py-2 bg-muted/50 border-t border-border text-xs text-muted-foreground">
        Code is ready in the editor. Write your solution and click Submit!
      </div>
    </div>
  );
}
