"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { memo } from "react";

interface MarkdownContentProps {
  content: string;
}

export const MarkdownContent = memo(function MarkdownContent({
  content,
}: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => (
          <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>
        ),
        h2: ({ children }) => (
          <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>
        ),
        h3: ({ children }) => (
          <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>
        ),
        h4: ({ children }) => (
          <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>
        ),
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => (
          <ul className="list-disc ml-4 mb-2">{children}</ul>
        ),
        ol: ({ children }) => (
          <ol className="list-decimal ml-4 mb-2">{children}</ol>
        ),
        li: ({ children }) => <li className="mb-1">{children}</li>,
        a: ({ href, children }) => (
          <a
            href={href}
            className="text-blue-500 hover:underline"
            target="_blank"
            rel="noopener noreferrer"
          >
            {children}
          </a>
        ),
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 italic my-2">
            {children}
          </blockquote>
        ),
        strong: ({ children }) => (
          <strong className="font-semibold">{children}</strong>
        ),
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ className, children, ...props }) => {
          const isCodeBlock = className?.startsWith("language-");
          if (isCodeBlock) {
            const language = className?.replace("language-", "") || "";
            return (
              <pre className="my-2 p-3 bg-gray-900 dark:bg-gray-950 text-gray-100 rounded-lg overflow-x-auto text-xs">
                {language && (
                  <div className="text-gray-400 text-xs mb-2">{language}</div>
                )}
                <code {...props}>{children}</code>
              </pre>
            );
          }
          return (
            <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs" {...props}>
              {children}
            </code>
          );
        },
        pre: ({ children }) => <>{children}</>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-2">
            <table className="border-collapse border border-gray-300 dark:border-gray-600 text-sm">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-gray-100 dark:bg-gray-700">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 font-semibold text-left">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">
            {children}
          </td>
        ),
        hr: () => <hr className="my-4 border-gray-300 dark:border-gray-600" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
