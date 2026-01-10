"use client";

import { useState, useCallback, useRef } from "react";
import type { Message, Exercise, ToolCall } from "@/lib/types";
import { generateTitleFromMessage } from "@/lib/utils/generateTitle";

interface ContentBlock {
  type: string;
  text?: string;
  name?: string;
  id?: string;
  input?: Record<string, unknown>;
  tool_use_id?: string;
  content?: string | Array<{ type: string; text?: string }>;
  is_error?: boolean;
}

interface SDKMessage {
  type: string;
  subtype?: string;
  message?: {
    content: ContentBlock[];
  };
  result?: string;
  session_id?: string;
  error?: string;
  _meta?: {
    projectId: string;
    sessionId: string;
  };
}

interface UseChatOptions {
  projectId: string | null;
  sessionId: string | null;
  agentSessionId?: string;
  onExercise?: (exercise: Exercise) => void;
  onSessionId?: (sessionId: string) => void;
  onTitleGenerated?: (title: string) => void;
}

export function useChat({
  projectId,
  sessionId,
  agentSessionId,
  onExercise,
  onSessionId,
  onTitleGenerated,
}: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([]);
  const [error, setError] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const titleGeneratedRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);

  // Generate a unique message ID
  const generateMessageId = () =>
    `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Send a message
  const sendMessage = useCallback(
    async (
      content: string,
      action: "message" | "submit" | "hint" = "message",
      editorCode?: string
    ) => {
      if (!projectId || !sessionId) {
        setError("No project or session selected");
        return;
      }

      // Add user message immediately (only for regular messages)
      if (action === "message") {
        const userMessage: Message = {
          id: generateMessageId(),
          role: "user",
          content,
          timestamp: new Date().toISOString(),
        };
        messagesRef.current = [...messagesRef.current, userMessage];
        setMessages(messagesRef.current);
      }

      setIsStreaming(true);
      setStreamingContent("");
      setStreamingToolCalls([]);
      setError(null);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Track tool calls during streaming
      const toolCallMap = new Map<string, ToolCall>();

      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            projectId,
            sessionId,
            resumeSessionId: agentSessionId,
            action,
            editorCode,
          }),
          signal: abortControllerRef.current.signal,
        });

        if (!response.ok) {
          throw new Error(`HTTP error: ${response.status}`);
        }

        const reader = response.body?.getReader();
        if (!reader) {
          throw new Error("No response body");
        }

        const decoder = new TextDecoder();
        let accumulatedContent = "";
        let detectedExercise: Exercise | null = null;

        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value);
          const lines = chunk.split("\n");

          for (const line of lines) {
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              if (data === "[DONE]") continue;

              try {
                const sdkMessage: SDKMessage = JSON.parse(data);

                // Handle different message types
                if (
                  sdkMessage.type === "assistant" &&
                  sdkMessage.message?.content
                ) {
                  for (const block of sdkMessage.message.content) {
                    if (block.type === "text" && block.text) {
                      // Check if this is an exercise JSON
                      try {
                        const parsed = JSON.parse(block.text);
                        if (parsed.type === "exercise") {
                          detectedExercise = parsed as Exercise;
                          onExercise?.(detectedExercise);
                          continue;
                        }
                      } catch {
                        // Not JSON, treat as regular text
                      }
                      accumulatedContent += block.text;
                      setStreamingContent(accumulatedContent);
                    }

                    // Handle tool_use blocks
                    if (block.type === "tool_use" && block.id && block.name) {
                      const toolCall: ToolCall = {
                        id: block.id,
                        name: block.name,
                        input: (block.input as Record<string, unknown>) || {},
                        status: "pending",
                      };
                      toolCallMap.set(block.id, toolCall);
                      setStreamingToolCalls(Array.from(toolCallMap.values()));

                      // Special handling for create_exercise
                      if (block.name.includes("create_exercise") && block.input) {
                        detectedExercise = block.input as unknown as Exercise;
                        onExercise?.(detectedExercise);
                      }
                    }

                    // Handle tool_result blocks
                    if (block.type === "tool_result" && block.tool_use_id) {
                      const existingCall = toolCallMap.get(block.tool_use_id);
                      if (existingCall) {
                        // Extract output text
                        let outputText = "";
                        if (typeof block.content === "string") {
                          outputText = block.content;
                        } else if (Array.isArray(block.content)) {
                          outputText = block.content
                            .filter(
                              (c): c is { type: string; text: string } =>
                                c.type === "text" && typeof c.text === "string"
                            )
                            .map((c) => c.text)
                            .join("\n");
                        }

                        existingCall.output = outputText;
                        existingCall.status = block.is_error
                          ? "error"
                          : "completed";
                        if (block.is_error) {
                          existingCall.error = outputText;
                        }
                        toolCallMap.set(block.tool_use_id, existingCall);
                        setStreamingToolCalls(Array.from(toolCallMap.values()));
                      }
                    }
                  }
                }

                // Capture session ID from init message
                if (
                  sdkMessage.type === "system" &&
                  sdkMessage.subtype === "init" &&
                  sdkMessage.session_id
                ) {
                  onSessionId?.(sdkMessage.session_id);
                }

                // Handle result message
                if (
                  sdkMessage.type === "result" &&
                  sdkMessage.subtype === "success" &&
                  sdkMessage.result
                ) {
                  // Final result - append if not already in content
                  if (!accumulatedContent.includes(sdkMessage.result)) {
                    accumulatedContent += sdkMessage.result;
                    setStreamingContent(accumulatedContent);
                  }
                }

                // Handle errors
                if (sdkMessage.type === "error" && sdkMessage.error) {
                  setError(sdkMessage.error);
                }
              } catch (parseError) {
                console.error("Failed to parse SSE message:", parseError);
              }
            }
          }
        }

        // Add the complete assistant message
        const finalToolCalls = Array.from(toolCallMap.values());
        if (accumulatedContent || finalToolCalls.length > 0) {
          const assistantMessage: Message = {
            id: generateMessageId(),
            role: "assistant",
            content: accumulatedContent,
            timestamp: new Date().toISOString(),
            exercise: detectedExercise || undefined,
            toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
          };

          // Update ref and state
          messagesRef.current = [...messagesRef.current, assistantMessage];
          const updatedMessages = messagesRef.current;
          setMessages(updatedMessages);

          // Persist messages and agentSessionId to storage (fire and forget, but with error handling)
          fetch(`/api/projects/${projectId}/sessions/${sessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ messages: updatedMessages, agentSessionId }),
          })
            .then((response) => {
              if (!response.ok) {
                console.error("Failed to persist messages:", response.status);
                setError("Failed to save messages");
              }
            })
            .catch((persistError) => {
              console.error("Failed to persist messages:", persistError);
              setError("Failed to save messages");
            });

          // Generate title from first user message (fire and forget)
          if (!titleGeneratedRef.current && updatedMessages.length === 2 && action === "message") {
            titleGeneratedRef.current = true;
            const firstUserMessage = updatedMessages.find((m) => m.role === "user");
            if (firstUserMessage) {
              const generatedTitle = generateTitleFromMessage(firstUserMessage.content);
              fetch(`/api/projects/${projectId}/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ title: generatedTitle }),
              })
                .then((response) => {
                  if (response.ok) {
                    onTitleGenerated?.(generatedTitle);
                  }
                })
                .catch((err) => {
                  console.error('Failed to update session title:', err);
                });
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === "AbortError") {
          // Request was cancelled
          return;
        }
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setIsStreaming(false);
        setStreamingContent("");
        setStreamingToolCalls([]);
        abortControllerRef.current = null;
      }
    },
    [projectId, sessionId, agentSessionId, onExercise, onSessionId, onTitleGenerated]
  );

  // Cancel ongoing request
  const cancelRequest = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  // Clear messages
  const clearMessages = useCallback(() => {
    messagesRef.current = [];
    titleGeneratedRef.current = false;
    setMessages([]);
    setStreamingContent("");
    setStreamingToolCalls([]);
    setError(null);
  }, []);

  // Load messages from session
  const loadMessages = useCallback((sessionMessages: Message[]) => {
    messagesRef.current = sessionMessages;
    setMessages(sessionMessages);
    // If session has messages, title was already generated
    if (sessionMessages.length > 0) {
      titleGeneratedRef.current = true;
    }
  }, []);

  return {
    messages,
    isStreaming,
    streamingContent,
    streamingToolCalls,
    error,
    sendMessage,
    cancelRequest,
    clearMessages,
    loadMessages,
  };
}
