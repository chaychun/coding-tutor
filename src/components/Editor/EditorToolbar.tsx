"use client";

interface EditorToolbarProps {
  language: string;
  hasExercise: boolean;
  isSubmitting: boolean;
  onSubmit: () => void;
  onHint: () => void;
}

export default function EditorToolbar({
  language,
  hasExercise,
  isSubmitting,
  onSubmit,
  onHint,
}: EditorToolbarProps) {
  return (
    <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900">
      {/* Language Badge */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-400">
          Language:
        </span>
        <span className="px-2 py-1 text-xs font-medium bg-gray-200 dark:bg-gray-700 rounded">
          {language || "plaintext"}
        </span>
      </div>

      {/* Actions */}
      {hasExercise && (
        <div className="flex gap-2">
          <button
            onClick={onHint}
            disabled={isSubmitting}
            className="px-3 py-1.5 text-sm border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            💡 Hint
          </button>
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="px-4 py-1.5 text-sm bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? "Evaluating..." : "Submit"}
          </button>
        </div>
      )}
    </div>
  );
}
