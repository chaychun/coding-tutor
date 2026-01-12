"use client";

import { useState, useCallback, useRef } from "react";
import type { Message, Exercise, ToolCall, ContentBlock, ExerciseSubmission } from "@/lib/types";
import { generateTitleFromMessage } from "@/lib/utils/generateTitle";

interface SDKContentBlock {
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
    content: SDKContentBlock[];
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
  onExerciseCreated?: (exercise: Exercise) => void;
  onSessionId?: (sessionId: string) => void;
  onTitleGenerated?: (title: string) => void;
}

export function useChat({
  projectId,
  sessionId,
  agentSessionId,
  onExerciseCreated,
  onSessionId,
  onTitleGenerated,
}: UseChatOptions) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [streamingToolCalls, setStreamingToolCalls] = useState<ToolCall[]>([]);
  const [streamingContentBlocks, setStreamingContentBlocks] = useState<ContentBlock[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [activeExercise, setActiveExercise] = useState<Exercise | null>(null);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const titleGeneratedRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);

  // Generate a unique message ID
  const generateMessageId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Send a message
  const sendMessage = useCallback(
    async (
      content: string,
      action: "message" | "submit" | "hint" = "message",
      exerciseSubmission?: ExerciseSubmission,
      editorCode?: string
    ) => {
      if (!projectId || !sessionId) {
        setError("No project or session selected");
        return;
      }

      // Add user message immediately (for regular messages and submissions)
      if (action === "message" || action === "submit") {
        const userMessage: Message = {
          id: generateMessageId(),
          role: "user",
          content,
          timestamp: new Date().toISOString(),
          exerciseSubmission,
        };
        messagesRef.current = [...messagesRef.current, userMessage];
        setMessages(messagesRef.current);
      }

      setIsStreaming(true);
      setStreamingContent("");
      setStreamingToolCalls([]);
      setStreamingContentBlocks([]);
      setError(null);

      // Create abort controller for this request
      abortControllerRef.current = new AbortController();

      // Track tool calls during streaming
      const toolCallMap = new Map<string, ToolCall>();
      // Track content blocks in order
      const contentBlocksList: ContentBlock[] = [];
      // Track pending exercise fetches to ensure they complete before finalizing message
      const pendingExerciseFetches: Promise<void>[] = [];
      let currentTextBlock: { type: "text"; text: string } | null = null;

      // Helper function to update content blocks state
      const updateContentBlocks = () => {
        // Build blocks list including current text block
        const blocks = [...contentBlocksList];
        if (currentTextBlock && currentTextBlock.text) {
          // Check if the last block is text - if so, update it
          const lastBlock = blocks[blocks.length - 1];
          if (lastBlock && lastBlock.type === "text") {
            blocks[blocks.length - 1] = currentTextBlock;
          } else {
            blocks.push(currentTextBlock);
          }
        }
        setStreamingContentBlocks(blocks);
      };

      // Helper function to process tool_result blocks
      const processToolResult = async (block: SDKContentBlock) => {
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
            existingCall.status = block.is_error ? "error" : "completed";
            if (block.is_error) {
              existingCall.error = outputText;
            }
            toolCallMap.set(block.tool_use_id, existingCall);
            setStreamingToolCalls(Array.from(toolCallMap.values()));

            // Update the tool call in content blocks
            for (let i = 0; i < contentBlocksList.length; i++) {
              const cb = contentBlocksList[i];
              if (cb.type === "tool_call" && cb.toolCall.id === block.tool_use_id) {
                contentBlocksList[i] = { type: "tool_call", toolCall: existingCall };
                break;
              }
            }
            updateContentBlocks();

            // Detect exercise creation from tool call result
            if (
              existingCall.name === "mcp__coding-tutor__create_exercise" &&
              existingCall.status === "completed" &&
              existingCall.output
            ) {
              // Track this fetch so we can await it before finalizing the message
              const fetchPromise = (async () => {
                try {
                  const result = JSON.parse(existingCall.output);
                  if (result.exerciseId) {
                    // Retry fetching session a few times with delay to handle race condition
                    // where the MCP tool has written to disk but read returns stale data
                    let exercise = null;
                    for (let attempt = 0; attempt < 3; attempt++) {
                      if (attempt > 0) {
                        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
                      }

                      const response = await fetch(
                        `/api/projects/${projectId}/sessions/${sessionId}`,
                        { cache: "no-store" }
                      );

                      if (response.ok) {
                        const session = await response.json();

                        // Update the full exercises map
                        if (session.exercises && Object.keys(session.exercises).length > 0) {
                          setExercises(session.exercises);
                        }

                        exercise = session.exercises?.[result.exerciseId];

                        if (exercise) {
                          setActiveExercise(exercise);
                          onExerciseCreated?.(exercise);
                          break;
                        }
                      }
                    }

                    if (!exercise) {
                      console.warn(
                        "[useChat] Exercise not found after retries:",
                        result.exerciseId
                      );
                    }
                  }
                } catch (e) {
                  console.error("Failed to parse exercise creation result:", e);
                }
              })();
              pendingExerciseFetches.push(fetchPromise);
            }

            // Detect exercise update from tool call result (status changes, etc.)
            if (
              existingCall.name === "mcp__coding-tutor__update_exercise" &&
              existingCall.status === "completed" &&
              existingCall.output
            ) {
              const fetchPromise = (async () => {
                try {
                  const result = JSON.parse(existingCall.output);
                  if (result.exerciseId) {
                    // Fetch updated session to get new exercise status
                    for (let attempt = 0; attempt < 3; attempt++) {
                      if (attempt > 0) {
                        await new Promise((resolve) => setTimeout(resolve, 200 * attempt));
                      }

                      const response = await fetch(
                        `/api/projects/${projectId}/sessions/${sessionId}`,
                        { cache: "no-store" }
                      );

                      if (response.ok) {
                        const session = await response.json();

                        // Update the full exercises map to reflect status changes
                        if (session.exercises && Object.keys(session.exercises).length > 0) {
                          setExercises(session.exercises);
                          break;
                        }
                      }
                    }
                  }
                } catch (e) {
                  console.error("Failed to parse exercise update result:", e);
                }
              })();
              pendingExerciseFetches.push(fetchPromise);
            }
          }
        }
      };

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
                if (sdkMessage.type === "assistant" && sdkMessage.message?.content) {
                  for (const block of sdkMessage.message.content) {
                    if (block.type === "text" && block.text) {
                      accumulatedContent += block.text;
                      setStreamingContent(accumulatedContent);

                      // Add to content blocks
                      if (!currentTextBlock) {
                        currentTextBlock = { type: "text", text: block.text };
                      } else {
                        currentTextBlock.text += block.text;
                      }
                      updateContentBlocks();
                    }

                    // Handle tool_use blocks
                    if (block.type === "tool_use" && block.id && block.name) {
                      // Finalize current text block before adding tool call
                      if (currentTextBlock && currentTextBlock.text) {
                        contentBlocksList.push(currentTextBlock);
                        currentTextBlock = null;
                      }

                      const toolCall: ToolCall = {
                        id: block.id,
                        name: block.name,
                        input: (block.input as Record<string, unknown>) || {},
                        status: "pending",
                      };
                      toolCallMap.set(block.id, toolCall);
                      setStreamingToolCalls(Array.from(toolCallMap.values()));

                      // Add tool call to content blocks
                      contentBlocksList.push({ type: "tool_call", toolCall });
                      updateContentBlocks();
                    }

                    // Handle tool_result blocks in assistant messages
                    await processToolResult(block);
                  }
                }

                // Handle tool results from non-assistant messages (user messages contain tool_result blocks)
                // Also check for tool_result at top level (some SDK versions might send this way)
                if (sdkMessage.type !== "assistant") {
                  // Check top-level for tool_result
                  if (
                    (sdkMessage as unknown as SDKContentBlock).type === "tool_result" &&
                    (sdkMessage as unknown as SDKContentBlock).tool_use_id
                  ) {
                    await processToolResult(sdkMessage as unknown as SDKContentBlock);
                  }

                  // Check content array for tool_result blocks
                  if (sdkMessage.message?.content) {
                    for (const block of sdkMessage.message.content) {
                      await processToolResult(block);
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

        // Finalize content blocks - add any remaining text block
        if (currentTextBlock && currentTextBlock.text) {
          contentBlocksList.push(currentTextBlock);
        }

        // Wait for any pending exercise fetches to complete before updating messages
        // This ensures exercises are in state when the message renders
        if (pendingExerciseFetches.length > 0) {
          await Promise.all(pendingExerciseFetches);
        }

        if (accumulatedContent || finalToolCalls.length > 0) {
          const assistantMessage: Message = {
            id: generateMessageId(),
            role: "assistant",
            content: accumulatedContent,
            timestamp: new Date().toISOString(),
            toolCalls: finalToolCalls.length > 0 ? finalToolCalls : undefined,
            contentBlocks: contentBlocksList.length > 0 ? contentBlocksList : undefined,
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
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ title: generatedTitle }),
              })
                .then((response) => {
                  if (response.ok) {
                    onTitleGenerated?.(generatedTitle);
                  }
                })
                .catch((err) => {
                  console.error("Failed to update session title:", err);
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
        setStreamingContentBlocks([]);
        abortControllerRef.current = null;
      }
    },
    [projectId, sessionId, agentSessionId, onExerciseCreated, onSessionId, onTitleGenerated]
  );

  // Submit exercise
  const submitExercise = useCallback(
    async (code: string) => {
      if (!activeExercise || !sessionId) return;

      const attemptId = crypto.randomUUID();

      // Create the submission message content for the AI
      const submissionContent = `[Exercise Submission]
Title: ${activeExercise.title}

Code:
\`\`\`${activeExercise.language}
${code}
\`\`\``;

      // Create exerciseSubmission for the message
      const exerciseSubmission: ExerciseSubmission = {
        exerciseId: activeExercise.id,
        attemptId,
        code,
        title: activeExercise.title,
        instructions: activeExercise.instructions,
      };

      // Clear active exercise first (panel disappears)
      setActiveExercise(null);

      // Send the message with exercise submission metadata and editor code
      await sendMessage(submissionContent, "submit", exerciseSubmission, code);
    },
    [activeExercise, sessionId, sendMessage]
  );

  // Skip exercise
  const skipExercise = useCallback(async () => {
    if (!activeExercise || !sessionId) return;

    // Clear active exercise
    setActiveExercise(null);

    // Send skip message to AI
    await sendMessage(`[Skipped exercise: ${activeExercise.title}]`, "message");
  }, [activeExercise, sessionId, sendMessage]);

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
    setStreamingContentBlocks([]);
    setError(null);
  }, []);

  // Load messages from session
  const loadMessages = useCallback((sessionMessages: Message[]) => {
    // Normalize tool call statuses - historical tool calls that are still "pending"
    // should be treated as completed since they're part of persisted messages
    const normalizedMessages = sessionMessages.map((message) => {
      let normalizedToolCalls = message.toolCalls;
      let normalizedContentBlocks = message.contentBlocks;

      if (message.toolCalls && message.toolCalls.length > 0) {
        normalizedToolCalls = message.toolCalls.map((tc) => ({
          ...tc,
          status: tc.status === "pending" ? "completed" : tc.status,
        })) as typeof message.toolCalls;
      }

      // Also normalize tool calls within content blocks
      if (message.contentBlocks && message.contentBlocks.length > 0) {
        normalizedContentBlocks = message.contentBlocks.map((block) => {
          if (block.type === "tool_call" && block.toolCall.status === "pending") {
            return {
              ...block,
              toolCall: { ...block.toolCall, status: "completed" as const },
            };
          }
          return block;
        });
      }

      if (
        normalizedToolCalls !== message.toolCalls ||
        normalizedContentBlocks !== message.contentBlocks
      ) {
        return {
          ...message,
          toolCalls: normalizedToolCalls,
          contentBlocks: normalizedContentBlocks,
        };
      }
      return message;
    });

    messagesRef.current = normalizedMessages;
    setMessages(normalizedMessages);
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
    streamingContentBlocks,
    error,
    sendMessage,
    cancelRequest,
    clearMessages,
    loadMessages,
    activeExercise,
    setActiveExercise,
    exercises,
    setExercises,
    submitExercise,
    skipExercise,
  };
}
