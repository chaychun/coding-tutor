"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { memo } from "react";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { oneDark } from "react-syntax-highlighter/dist/esm/styles/prism";

interface MarkdownContentProps {
  content: string;
}

export const MarkdownContent = memo(function MarkdownContent({ content }: MarkdownContentProps) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        h1: ({ children }) => <h1 className="text-xl font-bold mt-4 mb-2">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold mt-3 mb-2">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-semibold mt-2 mb-1">{children}</h3>,
        h4: ({ children }) => <h4 className="text-sm font-semibold mt-2 mb-1">{children}</h4>,
        p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
        ul: ({ children }) => <ul className="list-disc ml-4 mb-2">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal ml-4 mb-2">{children}</ol>,
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
        strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        code: ({ className, children }) => {
          const match = /language-(\w+)/.exec(className || "");
          const language = match ? match[1] : "";
          const codeString = String(children).replace(/\n$/, "");

          // Check if this is a code block (has language class or contains newlines)
          const isCodeBlock = match || codeString.includes("\n");

          if (isCodeBlock) {
            return (
              <div className="my-2 rounded-lg overflow-hidden">
                {language && (
                  <div className="bg-gray-800 text-gray-400 text-xs px-3 py-1">{language}</div>
                )}
                <SyntaxHighlighter
                  style={oneDark}
                  language={language || "text"}
                  PreTag="div"
                  customStyle={{
                    margin: 0,
                    borderRadius: language ? "0 0 0.5rem 0.5rem" : "0.5rem",
                    fontSize: "0.75rem",
                  }}
                >
                  {codeString}
                </SyntaxHighlighter>
              </div>
            );
          }
          return (
            <code className="px-1 py-0.5 bg-gray-200 dark:bg-gray-700 rounded text-xs">
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
        thead: ({ children }) => <thead className="bg-gray-100 dark:bg-gray-700">{children}</thead>,
        th: ({ children }) => (
          <th className="border border-gray-300 dark:border-gray-600 px-2 py-1 font-semibold text-left">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-gray-300 dark:border-gray-600 px-2 py-1">{children}</td>
        ),
        hr: () => <hr className="my-4 border-gray-300 dark:border-gray-600" />,
      }}
    >
      {content}
    </ReactMarkdown>
  );
});
