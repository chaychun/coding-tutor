"use client";

import type { Exercise } from "@/lib/types";

interface ExerciseBlockProps {
  exercise: Exercise;
}

export default function ExerciseBlock({ exercise }: ExerciseBlockProps) {
  return (
    <div className="my-4 border border-blue-200 dark:border-blue-800 rounded-lg overflow-hidden">
      {/* Header */}
      <div className="bg-blue-50 dark:bg-blue-900/30 px-4 py-2 flex items-center justify-between">
        <h3 className="font-semibold text-blue-700 dark:text-blue-300">
          {exercise.title}
        </h3>
        <span className="text-xs px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-600 dark:text-blue-200 rounded">
          {exercise.language}
        </span>
      </div>

      {/* Instructions */}
      <div className="p-4 space-y-3">
        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">
            Instructions
          </h4>
          <p className="text-sm">{exercise.instructions}</p>
        </div>

        <div>
          <h4 className="text-xs font-semibold text-gray-500 uppercase mb-1">
            Expected Behavior
          </h4>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            {exercise.expectedBehavior}
          </p>
        </div>
      </div>

      {/* Hint */}
      <div className="px-4 py-2 bg-gray-50 dark:bg-gray-800/50 text-xs text-gray-500">
        Code is ready in the editor. Write your solution and click Submit!
      </div>
    </div>
  );
}
