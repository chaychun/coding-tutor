"use client";

import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import type {
  Message,
  Exercise,
  ExerciseSubmission,
  ConceptQuestion,
  ConceptQuestionAnswer,
} from "@/lib/types";
import { sidecarFetch } from "@/lib/sidecar";

type ChatAction = "message" | "submit" | "hint" | "skip" | "concept_answer";

interface ChatJobState {
  messages: Message[];
  exercises: Record<string, Exercise>;
  conceptQuestions: Record<string, ConceptQuestion>;
  activeExerciseId: string | null;
  agentSessionId?: string;
  inProgressMessage: Message | null;
  status: "running" | "idle" | "error";
  error?: string;
}

interface UseChatOptions {
  projectId: string | null;
  sessionId: string | null;
  testingMode?: boolean;
}

function generateMessageId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function useChat({ projectId, sessionId, testingMode }: UseChatOptions) {
  const [serverMessages, setServerMessages] = useState<Message[]>([]);
  const [inProgressMessage, setInProgressMessage] = useState<Message | null>(null);
  const [optimisticUserMessage, setOptimisticUserMessage] = useState<Message | null>(null);
  const [exercises, setExercises] = useState<Record<string, Exercise>>({});
  const [conceptQuestions, setConceptQuestions] = useState<Record<string, ConceptQuestion>>({});
  const [activeExerciseId, setActiveExerciseId] = useState<string | null>(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeExercise, setActiveExerciseRaw] = useState<Exercise | null>(null);

  const testingModeRef = useRef(testingMode ?? false);
  useEffect(() => {
    testingModeRef.current = testingMode ?? false;
  }, [testingMode]);

  // Drop session-scoped state when the active session changes.
  useEffect(() => {
    setServerMessages([]);
    setInProgressMessage(null);
    setOptimisticUserMessage(null);
    setExercises({});
    setConceptQuestions({});
    setActiveExerciseId(null);
    setActiveExerciseRaw(null);
    setIsStreaming(false);
    setError(null);
  }, [projectId, sessionId]);

  // Apply a server-provided state snapshot to local state.
  const applyState = useCallback((state: ChatJobState) => {
    setServerMessages(state.messages);
    setExercises(state.exercises);
    setConceptQuestions(state.conceptQuestions);
    setActiveExerciseId(state.activeExerciseId);
    setInProgressMessage(state.inProgressMessage);
    if (state.status === "error" && state.error) setError(state.error);
    // Clear optimistic user msg once the server has echoed it (matched by id).
    setOptimisticUserMessage((prev) => {
      if (!prev) return prev;
      return state.messages.some((m) => m.id === prev.id) ? null : prev;
    });
  }, []);

  // Subscribe to the backend's event stream for this session. Reconnects on
  // session change. The snapshot frame populates initial state on attach.
  useEffect(() => {
    if (!projectId || !sessionId) return;
    const abortCtrl = new AbortController();
    let cancelled = false;

    const run = async () => {
      try {
        const response = await sidecarFetch(
          `/api/projects/${projectId}/sessions/${sessionId}/chat/events`,
          {
            signal: abortCtrl.signal,
            headers: { Accept: "text/event-stream" },
          }
        );
        if (!response.ok || !response.body) {
          throw new Error(`HTTP ${response.status}`);
        }
        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          let separatorIdx = buffer.indexOf("\n\n");
          while (separatorIdx !== -1) {
            const frame = buffer.slice(0, separatorIdx);
            buffer = buffer.slice(separatorIdx + 2);
            handleFrame(frame);
            separatorIdx = buffer.indexOf("\n\n");
          }
        }
      } catch (err) {
        if (cancelled) return;
        if (err instanceof Error && err.name === "AbortError") return;
        console.error("[useChat] events stream failed:", err);
      }
    };

    const handleFrame = (frame: string) => {
      if (!frame.trim() || frame.startsWith(":")) return;
      let event = "message";
      const dataLines: string[] = [];
      for (const line of frame.split("\n")) {
        if (line.startsWith("event:")) event = line.slice(6).trim();
        else if (line.startsWith("data:")) dataLines.push(line.slice(5).trim());
      }
      const raw = dataLines.join("\n");
      if (!raw) return;
      let payload: unknown;
      try {
        payload = JSON.parse(raw);
      } catch {
        return;
      }

      if (event === "snapshot") {
        const { state, running } = payload as { state: ChatJobState; running: boolean };
        applyState(state);
        setIsStreaming(running || state.status === "running");
      } else if (event === "state") {
        const state = payload as ChatJobState;
        applyState(state);
        setIsStreaming(state.status === "running");
      } else if (event === "done") {
        setIsStreaming(false);
      } else if (event === "error") {
        const { message } = payload as { message: string };
        setError(message);
        setIsStreaming(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      abortCtrl.abort();
    };
  }, [projectId, sessionId, applyState]);

  // Normalize historical tool calls to "completed" for display (mirror prior load logic).
  const normalizedServerMessages = useMemo(() => {
    return serverMessages.map((message) => {
      let normalizedToolCalls = message.toolCalls;
      let normalizedContentBlocks = message.contentBlocks;
      if (message.toolCalls && message.toolCalls.length > 0) {
        normalizedToolCalls = message.toolCalls.map((tc) =>
          tc.status === "pending" ? { ...tc, status: "completed" as const } : tc
        );
      }
      if (message.contentBlocks && message.contentBlocks.length > 0) {
        normalizedContentBlocks = message.contentBlocks.map((b) =>
          b.type === "tool_call" && b.toolCall.status === "pending"
            ? { ...b, toolCall: { ...b.toolCall, status: "completed" as const } }
            : b
        );
      }
      if (
        normalizedToolCalls === message.toolCalls &&
        normalizedContentBlocks === message.contentBlocks
      ) {
        return message;
      }
      return { ...message, toolCalls: normalizedToolCalls, contentBlocks: normalizedContentBlocks };
    });
  }, [serverMessages]);

  // Derived render list: server-confirmed + (optimistic user if not yet echoed) + (in-progress).
  const messages = useMemo<Message[]>(() => {
    const list = [...normalizedServerMessages];
    if (
      optimisticUserMessage &&
      !normalizedServerMessages.some((m) => m.id === optimisticUserMessage.id)
    ) {
      list.push(optimisticUserMessage);
    }
    if (inProgressMessage) list.push(inProgressMessage);
    return list;
  }, [normalizedServerMessages, optimisticUserMessage, inProgressMessage]);

  // Derive activeExercise from server's activeExerciseId.
  useEffect(() => {
    if (!activeExerciseId) {
      setActiveExerciseRaw(null);
      return;
    }
    const ex = exercises[activeExerciseId];
    if (!ex) return;
    if (
      ex.status === "active" ||
      ex.status === "pending_review" ||
      ex.status === "needs_retry"
    ) {
      setActiveExerciseRaw(ex);
    } else {
      setActiveExerciseRaw(null);
    }
  }, [activeExerciseId, exercises]);

  const sendMessage = useCallback(
    async (
      content: string,
      action: ChatAction = "message",
      exerciseSubmission?: ExerciseSubmission,
      editorCode?: string,
      overrideTestingMode?: boolean,
      conceptQuestionAnswer?: ConceptQuestionAnswer
    ) => {
      if (!projectId || !sessionId) {
        setError("No project or session selected");
        return;
      }
      setError(null);

      const userMessageId = action !== "hint" ? generateMessageId() : undefined;
      if (userMessageId) {
        const optimistic: Message = {
          id: userMessageId,
          role: "user",
          content,
          timestamp: new Date().toISOString(),
          ...(exerciseSubmission ? { exerciseSubmission } : {}),
          ...(conceptQuestionAnswer ? { conceptQuestionAnswer } : {}),
        };
        setOptimisticUserMessage(optimistic);
      }
      setIsStreaming(true);

      try {
        const response = await sidecarFetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            projectId,
            sessionId,
            action,
            message: content,
            userMessageId,
            editorCode,
            exerciseSubmission,
            conceptQuestionAnswer,
            testingMode: overrideTestingMode ?? testingModeRef.current,
          }),
        });
        if (response.status === 409) {
          // Another job is already running for this session — events stream will mirror it.
          return;
        }
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}`);
        }
        // 202 — done. State arrives via events stream.
      } catch (err) {
        setIsStreaming(false);
        setOptimisticUserMessage(null);
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    },
    [projectId, sessionId]
  );

  const cancelRequest = useCallback(async () => {
    if (!projectId || !sessionId) return;
    try {
      await sidecarFetch(
        `/api/projects/${projectId}/sessions/${sessionId}/chat/abort`,
        { method: "POST" }
      );
    } catch (err) {
      console.error("[useChat] abort failed:", err);
    }
  }, [projectId, sessionId]);

  // --- Exercise actions ---

  const submitExercise = useCallback(
    async (code: string, blankValues?: Record<string, string>) => {
      if (!activeExercise || !projectId || !sessionId) return;
      const exerciseToSubmit = activeExercise;
      const attemptId = crypto.randomUUID();
      const exerciseType = exerciseToSubmit.type;

      let submissionContent: string;
      let editorCodeForAI: string;

      if (exerciseType === "fill_in_blank" && !blankValues) {
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

      const exerciseSubmission: ExerciseSubmission = {
        exerciseId: exerciseToSubmit.id,
        attemptId,
        code,
        title: exerciseToSubmit.title,
        instructions: exerciseToSubmit.instructions,
        blankValues,
      };

      setActiveExerciseRaw(null);

      try {
        const attemptResponse = await sidecarFetch(
          `/api/projects/${projectId}/sessions/${sessionId}/exercises/${exerciseToSubmit.id}/attempts`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ attemptId, code, blankValues }),
          }
        );
        if (!attemptResponse.ok) {
          setActiveExerciseRaw(exerciseToSubmit);
          setError("Failed to submit exercise attempt");
          return;
        }
        await sendMessage(submissionContent, "submit", exerciseSubmission, editorCodeForAI);
      } catch (err) {
        setActiveExerciseRaw(exerciseToSubmit);
        throw err;
      }
    },
    [activeExercise, projectId, sessionId, sendMessage]
  );

  const skipExercise = useCallback(async () => {
    if (!activeExercise || !sessionId || !projectId) return;
    const exerciseToSkip = activeExercise;
    setActiveExerciseRaw(null);

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

    const exerciseSubmission: ExerciseSubmission = {
      exerciseId: exerciseToSkip.id,
      attemptId: "",
      code: "",
      title: exerciseToSkip.title,
      instructions: exerciseToSkip.instructions,
    };

    await sendMessage(
      `[Exercise Skipped]
Title: ${exerciseToSkip.title}

The student chose to skip this exercise. No code was submitted. The exercise status has been automatically updated to "skipped". Please acknowledge this and offer to help with something else or continue to the next topic.`,
      "skip",
      exerciseSubmission
    );
  }, [activeExercise, sessionId, projectId, sendMessage]);

  const retryExercise = useCallback(
    async (exerciseId: string, _previousCode: string) => {
      const exercise = exercises[exerciseId];
      if (!exercise || !projectId || !sessionId) return;
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

  const answerConceptQuestion = useCallback(
    async (questionId: string, selectedOptionIndex: number) => {
      if (!projectId || !sessionId) return;
      const question = conceptQuestions[questionId];
      if (!question) return;
      const selectedOption = question.options[selectedOptionIndex];

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

      const conceptQuestionAnswer: ConceptQuestionAnswer = {
        questionId,
        question: question.question,
        selectedOption: selectedOption.text,
        correctness: selectedOption.correctness,
      };

      const answerContent = `[Concept Answer]
Question: "${question.question}"
Selected: "${selectedOption.text}"
Result: ${selectedOption.correctness}

Please provide feedback on this answer. Explain why it is ${selectedOption.correctness === "correct" ? "correct" : selectedOption.correctness === "partial" ? "partially correct — what's missing or what would be a better answer" : "incorrect — what the correct answer is and why"}.`;

      await sendMessage(
        answerContent,
        "concept_answer",
        undefined,
        undefined,
        undefined,
        conceptQuestionAnswer
      );
    },
    [projectId, sessionId, conceptQuestions, sendMessage]
  );

  return {
    messages,
    isStreaming,
    error,
    sendMessage,
    cancelRequest,
    activeExercise,
    exercises,
    conceptQuestions,
    submitExercise,
    skipExercise,
    retryExercise,
    answerConceptQuestion,
  };
}
