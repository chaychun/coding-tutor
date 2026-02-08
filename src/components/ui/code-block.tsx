"use client";

import { cn } from "@/lib/utils";
import React, { useEffect, useState } from "react";
import { codeToHtml } from "shiki";
import { useTheme } from "@/components/theme-provider";

export type CodeBlockProps = {
  children?: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn("not-prose flex w-full flex-col overflow-clip ring-1 ring-border bg-card text-card-foreground", className)}
      {...props}
    >
      {children}
    </div>
  );
}

export type CodeBlockHeaderProps = {
  language?: string;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlockHeader({ language, className, ...props }: CodeBlockHeaderProps) {
  if (!language) return null;
  return (
    <div
      className={cn(
        "bg-muted/80 text-muted-foreground text-[10px] font-medium uppercase tracking-wider px-3 py-1.5 border-b border-border",
        className,
      )}
      {...props}
    >
      {language}
    </div>
  );
}

export type CodeBlockCodeProps = {
  code: string;
  language?: string;
  theme?: string;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlockCode({ code, language = "tsx", theme, className, ...props }: CodeBlockCodeProps) {
  const { resolvedTheme } = useTheme();
  const resolvedShikiTheme = theme ?? (resolvedTheme === "dark" ? "github-dark" : "github-light");

  const [highlightedHtml, setHighlightedHtml] = useState<string | null>(null);

  useEffect(() => {
    async function highlight() {
      if (!code) {
        setHighlightedHtml("<pre><code></code></pre>");
        return;
      }

      const html = await codeToHtml(code, { lang: language, theme: resolvedShikiTheme });
      setHighlightedHtml(html);
    }
    highlight();
  }, [code, language, resolvedShikiTheme]);

  const classNames = cn(
    "w-full overflow-x-auto text-xs leading-relaxed [&>pre]:px-4 [&>pre]:py-4 [&_pre]:!bg-transparent",
    className,
  );

  return highlightedHtml ? (
    <div className={classNames} dangerouslySetInnerHTML={{ __html: highlightedHtml }} {...props} />
  ) : (
    <div className={classNames} {...props}>
      <pre>
        <code>{code}</code>
      </pre>
    </div>
  );
}

export type CodeBlockGroupProps = React.HTMLAttributes<HTMLDivElement>;

function CodeBlockGroup({ children, className, ...props }: CodeBlockGroupProps) {
  return (
    <div className={cn("flex items-center justify-between", className)} {...props}>
      {children}
    </div>
  );
}

export { CodeBlockGroup, CodeBlockCode, CodeBlockHeader, CodeBlock };
