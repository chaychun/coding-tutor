"use client";

import { useState, useEffect } from "react";
import type { ToolCall } from "@/lib/types";
import { Button, Spinner, ScrollArea } from "@/components/ui";
import { CaretDown, CaretRight, Check, X } from "@phosphor-icons/react";

interface ToolProps {
  toolCall: ToolCall;
}

const OUTPUT_PREVIEW_LIMIT = 500;

function Tool({ toolCall }: ToolProps) {
  const [isExpanded, setIsExpanded] = useState(toolCall.status === "error");
  const [showFullOutput, setShowFullOutput] = useState(false);

  useEffect(() => {
    if (toolCall.status === "error") {
      setIsExpanded(true);
    }
  }, [toolCall.status]);

  const displayName = toolCall.name.replace(/^mcp__[^_]+__/, "");

  const renderStatusIcon = () => {
    if (toolCall.status === "pending") {
      return <Spinner size={14} />;
    }
    if (toolCall.status === "completed") {
      return (
        <span className="animate-in fade-in zoom-in-50 duration-200">
          <Check size={14} weight="bold" className="text-primary" />
        </span>
      );
    }
    return (
      <span className="animate-in fade-in zoom-in-50 duration-200">
        <X size={14} weight="bold" className="text-destructive" />
      </span>
    );
  };

  return (
    <div className="ring-1 ring-border overflow-hidden bg-card animate-in fade-in slide-in-from-bottom-1 duration-200">
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full flex items-center gap-2 px-3 py-2.5 hover:bg-muted/50 transition-colors text-left"
      >
        <span className="text-muted-foreground">
          {isExpanded ? <CaretDown size={12} /> : <CaretRight size={12} />}
        </span>
        <span className="font-mono text-xs flex-1 truncate">{displayName}</span>
        {renderStatusIcon()}
      </button>

      {isExpanded && (
        <div className="border-t border-border">
          <div className="px-3 py-2.5">
            <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Input</div>
            <ScrollArea orientation="horizontal" className="bg-muted/50">
              <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                {JSON.stringify(toolCall.input, null, 2)}
              </pre>
            </ScrollArea>
          </div>

          {toolCall.output && (
            <div className="px-3 py-2.5 border-t border-border">
              <div className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Output</div>
              <ScrollArea orientation="both" className="max-h-48 bg-muted/50">
                <pre className="p-3 text-xs font-mono whitespace-pre-wrap break-all">
                  {showFullOutput || toolCall.output.length <= OUTPUT_PREVIEW_LIMIT
                    ? toolCall.output
                    : toolCall.output.slice(0, OUTPUT_PREVIEW_LIMIT) + "..."}
                </pre>
              </ScrollArea>
              {toolCall.output.length > OUTPUT_PREVIEW_LIMIT && (
                <Button
                  variant="link"
                  size="xs"
                  onClick={(e) => {
                    e.stopPropagation();
                    setShowFullOutput(!showFullOutput);
                  }}
                  className="mt-2 h-auto p-0 text-[10px]"
                >
                  {showFullOutput ? "Show less" : "Show full output"}
                </Button>
              )}
            </div>
          )}

          {toolCall.error && (
            <div className="px-3 py-2.5 border-t border-border bg-destructive/5">
              <div className="text-[10px] font-medium uppercase tracking-wider text-destructive mb-2">Error</div>
              <p className="text-xs text-destructive">{toolCall.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export { Tool };
