"use client";

import type { Message } from "@/lib/types";

interface ChatMessageProps {
  message: Message;
}

export default function ChatMessage({ message }: ChatMessageProps) {
  const isUser = message.role === "user";

  return (
    <div className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[85%] rounded-lg px-4 py-2 ${
          isUser
            ? "bg-blue-500 text-white"
            : "bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100"
        }`}
      >
        {/* Render content with basic formatting */}
        <div className="whitespace-pre-wrap text-sm">
          {formatContent(message.content)}
        </div>
      </div>
    </div>
  );
}

// Basic formatting for code blocks and inline code
function formatContent(content: string) {
  // Split by code blocks
  const parts = content.split(/(```[\s\S]*?```)/g);

  return parts.map((part, index) => {
    if (part.startsWith("```") && part.endsWith("```")) {
      // Code block
      const lines = part.slice(3, -3).split("\n");
      const language = lines[0] || "";
      const code = lines.slice(1).join("\n");

      return (
        <pre
          key={index}
          className="my-2 p-3 bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg overflow-x-auto text-xs"
        >
          {language && (
            <div className="text-gray-400 text-xs mb-2">{language}</div>
          )}
          <code>{code}</code>
        </pre>
      );
    }

    // Handle inline code
    const inlineParts = part.split(/(`[^`]+`)/g);
    return inlineParts.map((inline, inlineIndex) => {
      if (inline.startsWith("`") && inline.endsWith("`")) {
        return (
          <code
            key={`${index}-${inlineIndex}`}
            className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs"
          >
            {inline.slice(1, -1)}
          </code>
        );
      }
      return <span key={`${index}-${inlineIndex}`}>{inline}</span>;
    });
  });
}
