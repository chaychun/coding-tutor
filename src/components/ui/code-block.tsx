"use client";

import { cn } from "@/lib/utils";
import React, { useCallback, useEffect, useRef, useState } from "react";
import { codeToHtml } from "shiki";
import { useTheme } from "@/components/theme-provider";
import { Copy, Check } from "@phosphor-icons/react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { motion, AnimatePresence } from "motion/react";

export type CodeBlockProps = {
  children?: React.ReactNode;
  className?: string;
} & React.HTMLProps<HTMLDivElement>;

function CodeBlock({ children, className, ...props }: CodeBlockProps) {
  return (
    <div
      className={cn(
        "not-prose flex w-full flex-col overflow-clip ring-1 ring-border bg-card text-card-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

const ICON_VARIANTS = {
  initial: { opacity: 0, filter: "blur(8px)" },
  animate: { opacity: 1, filter: "blur(0px)" },
  exit: { opacity: 0, filter: "blur(8px)" },
};

const ICON_TRANSITION = { duration: 0.15, ease: "easeOut" } as const;

function CopyButton({ code, className }: { code: string; className?: string }) {
  const [copied, setCopied] = useState(false);
  const [forceOpen, setForceOpen] = useState<boolean | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const releaseRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleCopy = useCallback(async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setForceOpen(true);
    clearTimeout(timeoutRef.current);
    clearTimeout(releaseRef.current);
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
      setForceOpen(false);
      releaseRef.current = setTimeout(() => setForceOpen(undefined), 150);
    }, 1000);
  }, [code]);

  return (
    <Tooltip open={forceOpen}>
      <TooltipTrigger
        onClick={handleCopy}
        className={cn(
          "relative inline-flex items-center justify-center size-6 text-muted-foreground hover:text-foreground cursor-pointer",
          className
        )}
        aria-label={copied ? "Copied" : "Copy code"}
      >
        <span className="relative size-3.5">
          <AnimatePresence mode="popLayout" initial={false}>
            {copied ? (
              <motion.span
                key="check"
                variants={ICON_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={ICON_TRANSITION}
                className="absolute inset-0 flex items-center justify-center text-emerald-500"
              >
                <Check className="size-3.5" />
              </motion.span>
            ) : (
              <motion.span
                key="copy"
                variants={ICON_VARIANTS}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={ICON_TRANSITION}
                className="absolute inset-0 flex items-center justify-center"
              >
                <Copy className="size-3.5" />
              </motion.span>
            )}
          </AnimatePresence>
        </span>
      </TooltipTrigger>
      <CopyTooltipContent copied={copied} label="Copy code" />
    </Tooltip>
  );
}

function CopyTooltipContent({ copied, label }: { copied: boolean; label: string }) {
  return (
    <TooltipContent sideOffset={6} className="!px-0 !py-0">
      <AnimatePresence mode="popLayout" initial={false}>
        <motion.div
          key={copied ? "copied" : "copy"}
          layout
          className="overflow-hidden px-3 py-1.5"
          initial={{ opacity: 0, filter: "blur(8px)" }}
          animate={{ opacity: 1, filter: "blur(0px)" }}
          exit={{ opacity: 0, filter: "blur(8px)" }}
          transition={{ duration: 0.15, ease: "easeOut" }}
        >
          <span className="block whitespace-nowrap">{copied ? "Copied!" : label}</span>
        </motion.div>
      </AnimatePresence>
    </TooltipContent>
  );
}

export type CodeBlockHeaderProps = {
  language?: string;
  code?: string;
  className?: string;
} & Omit<React.HTMLProps<HTMLDivElement>, "code">;

function CodeBlockHeader({ language, code, className, ...props }: CodeBlockHeaderProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-between bg-muted/80 text-muted-foreground text-[10px] font-medium uppercase tracking-wider px-3 py-1.5 border-b border-border",
        className
      )}
      {...props}
    >
      <span>{language}</span>
      {code && <CopyButton code={code} />}
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
    className
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

function InlineCode({ children }: { children: React.ReactNode }) {
  const [copied, setCopied] = useState(false);
  const [forceOpen, setForceOpen] = useState<boolean | undefined>(undefined);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>(undefined);
  const releaseRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  const handleClick = useCallback(async () => {
    const text = typeof children === "string" ? children : String(children);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setForceOpen(true);
    clearTimeout(timeoutRef.current);
    clearTimeout(releaseRef.current);
    timeoutRef.current = setTimeout(() => {
      setCopied(false);
      setForceOpen(false);
      releaseRef.current = setTimeout(() => setForceOpen(undefined), 150);
    }, 1000);
  }, [children]);

  return (
    <Tooltip open={forceOpen}>
      <TooltipTrigger
        onClick={handleClick}
        className="px-1.5 py-0.5 bg-yellow-100/50 dark:bg-yellow-900/20 text-[0.9em] font-mono border border-yellow-200/50 dark:border-yellow-700/30 cursor-pointer hover:bg-yellow-200/50 dark:hover:bg-yellow-800/30 transition-colors"
      >
        {children}
      </TooltipTrigger>
      <CopyTooltipContent copied={copied} label="Copy" />
    </Tooltip>
  );
}

export { CodeBlockGroup, CodeBlockCode, CodeBlockHeader, CodeBlock, CopyButton, InlineCode };
