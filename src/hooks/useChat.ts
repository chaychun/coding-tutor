"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import type {
  Message,
  Exercise,
  ToolCall,
  ContentBlock,
  ExerciseSubmission,
  ConceptQuestion,
  ConceptQuestionAnswer,
} from "@/lib/types";
import { generateTitleFromMessage } from "@/lib/utils/generateTitle";
import { sidecarFetch } from "@/lib/sidecar";

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
  testingMode?: boolean;
  onExerciseCreated?: (exercise: Exercise) => void;
  onSessionId?: (sessionId: string) => void;
  onTitleGenerated?: (title: string) => void;
}

export function useChat({
  projectId,
  sessionId,
  agentSessionId,
  testingMode,
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
  const [conceptQuestions, setConceptQuestions] = useState<Record<string, ConceptQuestion>>({});
  const abortControllerRef = useRef<AbortController | null>(null);
  const titleGeneratedRef = useRef(false);
  const messagesRef = useRef<Message[]>([]);
  // Track the latest agentSessionId to avoid stale closure in sendMessage
  const agentSessionIdRef = useRef<string | undefined>(agentSessionId);
  // Track testing mode via ref so all internal sendMessage calls use latest value
  const testingModeRef = useRef(testingMode ?? false);
  // Track mounted state to prevent state updates after unmount
  const mountedRef = useRef(true);

  // Keep agentSessionId ref in sync with prop (for when session loads from storage)
  useEffect(() => {
    agentSessionIdRef.current = agentSessionId;
  }, [agentSessionId]);

  // Keep testingMode ref in sync with prop
  useEffect(() => {
    testingModeRef.current = testingMode ?? false;
  }, [testingMode]);

  // Clean up on unmount
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Helper to fetch session with retries (handles race condition where MCP tool
  // has written to disk but read returns stale data)
  // Accepts an optional AbortSignal for cancellation
  const fetchSessionWithRetry = useCallback(
    async (maxAttempts = 3, signal?: AbortSignal): Promise<Record<string, Exercise> | null> => {
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        // Check cancellation before each attempt
        if (signal?.aborted || !mountedRef.current) {
          return null;
        }

        if (attempt > 0) {
          // Use a cancellable delay
          await new Promise<void>((resolve, reject) => {
            const timeoutId = setTimeout(resolve, 200 * attempt);
            signal?.addEventListener("abort", () => {
              clearTimeout(timeoutId);
              reject(new DOMException("Aborted", "AbortError"));
            });
          }).catch(() => null); // Swallow abort errors

          // Check again after delay
          if (signal?.aborted || !mountedRef.current) {
            return null;
          }
        }

        try {
          const response = await sidecarFetch(`/api/projects/${projectId}/sessions/${sessionId}`, {
            cache: "no-store",
            signal,
          });

          if (response.ok) {
            const session = await response.json();
            if (session.exercises && Object.keys(session.exercises).length > 0) {
              return session.exercises;
            }
          }
        } catch (err) {
          // Ignore abort errors, rethrow others
          if (err instanceof Error && err.name === "AbortError") {
            return null;
          }
          throw err;
        }
      }
      return null;
    },
    [projectId, sessionId]
  );

  // Generate a unique message ID
  const generateMessageId = () => `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Send a message
  const sendMessage = useCallback(
    async (
      content: string,
      action: "message" | "submit" | "hint" | "skip" | "concept_answer" = "message",
      exerciseSubmission?: ExerciseSubmission,
      editorCode?: string,
      testingMode?: boolean
    ) => {
      if (!projectId || !sessionId) {
        setError("No project or session selected");
        return;
      }

      // Add user message immediately (for regular messages, submissions, and skips)
      if (action === "message" || action === "submit" || action === "skip") {
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
              // Pass the abort signal so fetches can be cancelled if request is aborted
              const fetchPromise = (async () => {
                try {
                  const result = JSON.parse(existingCall.output);
                  if (result.exerciseId) {
                    const exercises = await fetchSessionWithRetry(
                      3,
                      abortControllerRef.current?.signal
                    );
                    // Check mounted state before updating state
                    if (exercises && mountedRef.current) {
                      setExercises(exercises);
                      const exercise = exercises[result.exerciseId];
                      if (exercise) {
                        setActiveExercise(exercise);
                        onExerciseCreated?.(exercise);
                      } else {
                        console.warn(
                          "[useChat] Exercise not found after retries:",
                          result.exerciseId
                        );
                      }
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
                    const exercises = await fetchSessionWithRetry(
                      3,
                      abortControllerRef.current?.signal
                    );
                    // Check mounted state before updating state
                    if (exercises && mountedRef.current) {
                      setExercises(exercises);

                      // If the agent marked the exercise as needs_retry, show the exercise block
                      // so the user can immediately retry without clicking a button
                      const updatedExercise = exercises[result.exerciseId];
                      if (updatedExercise && updatedExercise.status === "needs_retry") {
                        setActiveExercise(updatedExercise);
                      }
                    }
                  }
                } catch (e) {
                  console.error("Failed to parse exercise update result:", e);
                }
              })();
              pendingExerciseFetches.push(fetchPromise);
            }

            // Detect concept question creation — construct from tool call data
            // (no server fetch needed, input has question/options, output has questionId)
            if (
              existingCall.name === "mcp__coding-tutor__ask_concept_question" &&
              existingCall.status === "completed" &&
              existingCall.output
            ) {
              try {
                const result = JSON.parse(existingCall.output);
                const input = existingCall.input as {
                  question: string;
                  options: Array<{ text: string; correctness: string }>;
                };
                if (result.questionId && input.question && input.options) {
                  setConceptQuestions((prev) => ({
                    ...prev,
                    [result.questionId]: {
                      id: result.questionId,
                      question: input.question,
                      options: input.options as ConceptQuestion["options"],
                      selectedOptionIndex: null,
                      status: "unanswered",
                      createdAt: new Date().toISOString(),
                    },
                  }));
                }
              } catch (e) {
                console.error("Failed to parse concept question result:", e);
              }
            }
          }
        }
      };

      try {
        const response = await sidecarFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: content,
            projectId,
            sessionId,
            resumeSessionId: agentSessionIdRef.current,
            action,
            editorCode,
            testingMode: testingMode ?? testingModeRef.current,
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
                  agentSessionIdRef.current = sdkMessage.session_id;
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
          sidecarFetch(`/api/projects/${projectId}/sessions/${sessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              messages: updatedMessages,
              agentSessionId: agentSessionIdRef.current,
            }),
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
              sidecarFetch(`/api/projects/${projectId}/sessions/${sessionId}`, {
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
    [projectId, sessionId, onExerciseCreated, onSessionId, onTitleGenerated, fetchSessionWithRetry]
  );

  // Submit exercise
  const submitExercise = useCallback(
    async (code: string, blankValues?: Record<string, string>) => {
      if (!activeExercise || !projectId || !sessionId) return;

      // Store exercise context for recovery in case of error
      const exerciseToSubmit = activeExercise;
      const attemptId = crypto.randomUUID();
      const exerciseType = exerciseToSubmit.type;

      // Build submission content based on exercise type
      let submissionContent: string;
      let editorCodeForAI: string;

      if (exerciseType === "fill_in_blank" && !blankValues) {
        setActiveExercise(exerciseToSubmit);
        setError("Fill-in-blank submission is missing blank values");
        return;
      }

      if (exerciseType === "fill_in_blank" && blankValues) {
        const blankList = Object.entries(blankValues)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([idx, val]) => `Blank ${Number(idx) + 1}: ${val}`)
          .join("\n");
        submissionContent = `[Exercise Submission — Fill in the Blank]\nTitle: ${exerciseToSubmit.title}\n\nAnswers:\n${blankList}`;
        editorCodeForAI = `Template:\n${exerciseToSubmit.starterCode}\n\nAnswers:\n${blankList}`;
      } else {
        submissionContent = `[Exercise Submission]\nTitle: ${exerciseToSubmit.title}\n\nCode:\n\`\`\`${exerciseToSubmit.language}\n${code}\n\`\`\``;
        editorCodeForAI = code;
      }

      // Create exerciseSubmission for the message
      const exerciseSubmission: ExerciseSubmission = {
        exerciseId: exerciseToSubmit.id,
        attemptId,
        code,
        title: exerciseToSubmit.title,
        instructions: exerciseToSubmit.instructions,
        blankValues,
      };

      // Clear active exercise (panel disappears) - do this before sending
      // so the UI feels responsive
      setActiveExercise(null);

      try {
        // Add attempt to storage and update exercise status to pending_review
        const attemptResponse = await sidecarFetch(
          `/api/projects/${projectId}/sessions/${sessionId}/exercises/${exerciseToSubmit.id}/attempts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId, code, blankValues }),
          }
        );

        if (!attemptResponse.ok) {
          console.error("Failed to submit attempt:", attemptResponse.status);
          setActiveExercise(exerciseToSubmit);
          setError("Failed to submit exercise attempt");
          return;
        }

        const attempt = await attemptResponse.json();
        // Update local exercises state with the new attempt
        setExercises((prev) => {
          const exercise = prev[exerciseToSubmit.id];
          if (!exercise) return prev;
          return {
            ...prev,
            [exerciseToSubmit.id]: {
              ...exercise,
              status: "pending_review",
              attempts: [...exercise.attempts, attempt],
            },
          };
        });

        // Send the message with exercise submission metadata and editor code
        await sendMessage(submissionContent, "submit", exerciseSubmission, editorCodeForAI);
      } catch (err) {
        // Restore exercise context on error so user can retry
        setActiveExercise(exerciseToSubmit);
        throw err;
      }
    },
    [activeExercise, projectId, sessionId, sendMessage]
  );

  // Skip exercise - handles the skip directly without relying on AI to update status
  const skipExercise = useCallback(async () => {
    if (!activeExercise || !sessionId || !projectId) return;

    const exerciseToSkip = activeExercise;

    // Clear active exercise immediately for responsive UI
    setActiveExercise(null);

    // Update the exercise status to skipped via API
    try {
      const response = await sidecarFetch(
        `/api/projects/${projectId}/sessions/${sessionId}/exercises/${exerciseToSkip.id}/skip`,
        { method: "POST" }
      );

      if (!response.ok) {
        console.error("Failed to skip exercise:", await response.text());
      }
    } catch (err) {
      console.error("Error calling skip API:", err);
    }

    // Update local exercises state
    setExercises((prev) => ({
      ...prev,
      [exerciseToSkip.id]: {
        ...prev[exerciseToSkip.id],
        status: "skipped",
        updatedAt: new Date().toISOString(),
      },
    }));

    // Create exerciseSubmission for the skip card (no code, no attemptId needed)
    const exerciseSubmission: ExerciseSubmission = {
      exerciseId: exerciseToSkip.id,
      attemptId: "", // Empty since no actual submission
      code: "", // Empty since skipped
      title: exerciseToSkip.title,
      instructions: exerciseToSkip.instructions,
    };

    // Notify AI that the exercise was skipped (status already updated, AI should just acknowledge)
    // Pass exerciseSubmission so it renders as a card instead of a plain message
    // Use a clear skip message format so the AI understands no code was submitted intentionally
    await sendMessage(
      `[Exercise Skipped]
Title: ${exerciseToSkip.title}

The student chose to skip this exercise. No code was submitted. The exercise status has been automatically updated to "skipped". Please acknowledge this and offer to help with something else or continue to the next topic.`,
      "skip",
      exerciseSubmission
    );
  }, [activeExercise, sessionId, projectId, sendMessage]);

  // Retry exercise - reactivates the exercise panel with the previous code
  const retryExercise = useCallback(
    async (exerciseId: string, _previousCode: string) => {
      const exercise = exercises[exerciseId];
      if (!exercise || !projectId || !sessionId) return;

      // Create copy with active status
      const retryingExercise: Exercise = {
        ...exercise,
        status: "active",
      };

      // Update local state immediately for responsive UI
      setActiveExercise(retryingExercise);
      setExercises((prev) => ({
        ...prev,
        [exerciseId]: retryingExercise,
      }));

      // Persist to server so status survives page refresh
      try {
        const response = await sidecarFetch(
          `/api/projects/${projectId}/sessions/${sessionId}/exercises/${exerciseId}/retry`,
          { method: "POST" }
        );

        if (!response.ok) {
          console.error("Failed to retry exercise:", await response.text());
        }
      } catch (err) {
        console.error("Error calling retry API:", err);
      }
    },
    [exercises, projectId, sessionId]
  );

  // Answer a concept question
  const answerConceptQuestion = useCallback(
    async (questionId: string, selectedOptionIndex: number) => {
      if (!projectId || !sessionId) return;

      const question = conceptQuestions[questionId];
      if (!question) return;

      const selectedOption = question.options[selectedOptionIndex];

      // Update local state immediately for instant feedback
      setConceptQuestions((prev) => ({
        ...prev,
        [questionId]: {
          ...prev[questionId],
          selectedOptionIndex,
          status: selectedOption.correctness,
        },
      }));

      // Persist to server
      try {
        await sidecarFetch(
          `/api/projects/${projectId}/sessions/${sessionId}/concept-questions/${questionId}/answer`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ selectedOptionIndex }),
          }
        );
      } catch (err) {
        console.error("Error answering concept question:", err);
      }

      // Build answer metadata for the message
      const conceptQuestionAnswer: ConceptQuestionAnswer = {
        questionId,
        question: question.question,
        selectedOption: selectedOption.text,
        correctness: selectedOption.correctness,
      };

      // Send answer to AI
      const answerContent = `[Concept Answer]
Question: "${question.question}"
Selected: "${selectedOption.text}"
Result: ${selectedOption.correctness}

Please provide feedback on this answer. Explain why it is ${selectedOption.correctness === "correct" ? "correct" : selectedOption.correctness === "partial" ? "partially correct — what's missing or what would be a better answer" : "incorrect — what the correct answer is and why"}.`;

      // Add user message with concept question answer metadata
      const userMessage: Message = {
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        role: "user",
        content: answerContent,
        timestamp: new Date().toISOString(),
        conceptQuestionAnswer,
      };
      messagesRef.current = [...messagesRef.current, userMessage];
      setMessages(messagesRef.current);

      // Send to AI for feedback
      await sendMessage(answerContent, "concept_answer");
    },
    [projectId, sessionId, conceptQuestions, sendMessage]
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
    retryExercise,
    conceptQuestions,
    setConceptQuestions,
    answerConceptQuestion,
  };
}
