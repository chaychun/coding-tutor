"use client";

import { cn } from "@/lib/utils";

export interface LoaderProps {
  variant?: "circular" | "typing" | "dots" | "text-shimmer" | "loading-dots";
  size?: "sm" | "md" | "lg";
  text?: string;
  className?: string;
}

function TypingLoader({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const dotSizes = { sm: "h-1 w-1", md: "h-1.5 w-1.5", lg: "h-2 w-2" };
  const containerSizes = { sm: "h-4", md: "h-5", lg: "h-6" };

  return (
    <div className={cn("flex items-center space-x-1", containerSizes[size], className)}>
      {[...Array(3)].map((_, i) => (
        <div
          key={i}
          className={cn("bg-muted-foreground/50 animate-bounce rounded-full", dotSizes[size])}
          style={{ animationDelay: `${i * 150}ms` }}
        />
      ))}
      <span className="sr-only">Loading</span>
    </div>
  );
}

function CircularLoader({ className, size = "md" }: { className?: string; size?: "sm" | "md" | "lg" }) {
  const sizeClasses = { sm: "size-4", md: "size-5", lg: "size-6" };

  return (
    <div
      className={cn("border-primary animate-spin rounded-full border-2 border-t-transparent", sizeClasses[size], className)}
    >
      <span className="sr-only">Loading</span>
    </div>
  );
}

function TextShimmerLoader({
  text = "Thinking",
  className,
  size = "md",
}: {
  text?: string;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const textSizes = { sm: "text-xs", md: "text-sm", lg: "text-base" };

  return (
    <div
      className={cn(
        "bg-[linear-gradient(to_right,var(--muted-foreground)_40%,var(--foreground)_60%,var(--muted-foreground)_80%)]",
        "bg-[length:200%_auto] bg-clip-text font-medium text-transparent",
        "animate-[shimmer_4s_infinite_linear]",
        textSizes[size],
        className,
      )}
    >
      {text}
    </div>
  );
}

function TextDotsLoader({
  className,
  text = "Thinking",
  size = "md",
}: {
  className?: string;
  text?: string;
  size?: "sm" | "md" | "lg";
}) {
  const textSizes = { sm: "text-xs", md: "text-sm", lg: "text-base" };

  return (
    <div className={cn("inline-flex items-center", className)}>
      <span className={cn("text-muted-foreground font-medium", textSizes[size])}>{text}</span>
      <span className="inline-flex text-muted-foreground">
        <span className="animate-[loading-dots_1.4s_infinite_0.2s]">.</span>
        <span className="animate-[loading-dots_1.4s_infinite_0.4s]">.</span>
        <span className="animate-[loading-dots_1.4s_infinite_0.6s]">.</span>
      </span>
    </div>
  );
}

function Loader({ variant = "circular", size = "md", text, className }: LoaderProps) {
  switch (variant) {
    case "typing":
      return <TypingLoader size={size} className={className} />;
    case "text-shimmer":
      return <TextShimmerLoader text={text} size={size} className={className} />;
    case "loading-dots":
      return <TextDotsLoader text={text} size={size} className={className} />;
    default:
      return <CircularLoader size={size} className={className} />;
  }
}

export { Loader };
