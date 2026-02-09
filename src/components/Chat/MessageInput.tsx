"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp, Check } from "@phosphor-icons/react";
import { PromptInput, PromptInputTextarea, PromptInputActions } from "@/components/ui/prompt-input";

const showDevTools = process.env.NEXT_PUBLIC_DEV_TOOLS === "true";

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
  testingMode?: boolean;
  onTestingModeChange?: (enabled: boolean) => void;
}

export default function MessageInput({
  onSend,
  disabled = false,
  placeholder = "What would you like to learn?",
  testingMode,
  onTestingModeChange,
}: MessageInputProps) {
  const [input, setInput] = useState("");

  const handleSubmit = () => {
    const trimmed = input.trim();
    if (trimmed && !disabled) {
      onSend(trimmed);
      setInput("");
    }
  };

  return (
    <PromptInput value={input} onValueChange={setInput} onSubmit={handleSubmit} disabled={disabled}>
      <PromptInputTextarea placeholder={placeholder} />
      <PromptInputActions className="flex items-center justify-between px-3 py-2">
        <span className="text-[10px] text-muted-foreground">Press Enter to send</span>
        <div className="flex items-center gap-3">
          {showDevTools && onTestingModeChange && (
            <button
              type="button"
              onClick={() => onTestingModeChange(!testingMode)}
              className="flex items-center gap-1.5 cursor-pointer select-none group"
            >
              <span
                className={`flex items-center justify-center size-3.5 border transition-colors ${
                  testingMode
                    ? "bg-primary border-primary text-primary-foreground"
                    : "border-muted-foreground/40 group-hover:border-foreground/60"
                }`}
              >
                {testingMode && <Check size={10} weight="bold" />}
              </span>
              <span className="text-[10px] text-muted-foreground group-hover:text-foreground transition-colors">
                testing mode
              </span>
            </button>
          )}
          <Button size="icon-sm" onClick={handleSubmit} disabled={disabled || !input.trim()}>
            <ArrowUp size={16} weight="bold" />
          </Button>
        </div>
      </PromptInputActions>
    </PromptInput>
  );
}
