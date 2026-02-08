"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ArrowUp } from "@phosphor-icons/react";
import { PromptInput, PromptInputTextarea, PromptInputActions } from "@/components/ui/prompt-input";

interface MessageInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
  placeholder?: string;
}

export default function MessageInput({
  onSend,
  disabled = false,
  placeholder = "What would you like to learn?",
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
        <Button size="icon-sm" onClick={handleSubmit} disabled={disabled || !input.trim()}>
          <ArrowUp size={16} weight="bold" />
        </Button>
      </PromptInputActions>
    </PromptInput>
  );
}
