import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import * as storage from "../storage";
import {
  addExerciseToSession,
  setActiveExerciseId,
  updateExerciseInSession,
  addConceptQuestionToSession,
} from "../storage/sessions";
import { generateId } from "../storage/utils";
import type { Exercise, ConceptQuestion } from "../types";

export const tutorServer = createSdkMcpServer({
  name: "coding-tutor",
  version: "1.0.0",
  tools: [
    // 1. read_progress - Read student progress for a topic
    tool(
      "read_progress",
      "Read the student's progress file for a specific topic within the current project. Use this at the start of a session to understand what the student already knows.",
      {
        topic: z
          .string()
          .describe(
            "The topic identifier (e.g., 'swift-optionals', 'python-functions', 'react-hooks')"
          ),
        projectId: z.string().describe("The project identifier"),
      },
      async (args) => {
        try {
          const progress = await storage.getProgress(args.projectId, args.topic);
          return {
            content: [
              {
                type: "text" as const,
                text: progress
                  ? JSON.stringify(progress, null, 2)
                  : `No progress found for topic "${args.topic}". This appears to be a new topic for this student.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error reading progress: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      }
    ),

    // 2. update_progress - Update student progress after learning
    tool(
      "update_progress",
      "Update the student's progress file after learning or completing exercises. Call this when the student demonstrates mastery or struggles with concepts.",
      {
        projectId: z.string().describe("The project identifier"),
        topic: z.string().describe("The topic identifier"),
        updates: z.object({
          overallLevel: z
            .enum(["beginner", "intermediate", "advanced"])
            .optional()
            .describe("Update the overall level for this topic"),
          addToMastered: z
            .array(z.string())
            .optional()
            .describe("Concepts the student has mastered"),
          addToReinforcement: z
            .array(z.string())
            .optional()
            .describe("Concepts needing more practice"),
          removeFromReinforcement: z
            .array(z.string())
            .optional()
            .describe("Concepts to remove from reinforcement (now mastered)"),
          sessionNote: z
            .object({
              covered: z.array(z.string()).describe("Topics covered in this session"),
              performance: z.string().describe("Brief performance summary"),
              notes: z.string().optional().describe("Additional notes about the student"),
            })
            .optional()
            .describe("Notes about this session"),
        }),
      },
      async (args) => {
        try {
          await storage.updateProgress(args.projectId, args.topic, args.updates);
          return {
            content: [
              {
                type: "text" as const,
                text: `Progress updated successfully for topic "${args.topic}".`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error updating progress: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      }
    ),

    // 3. create_exercise - Create a coding exercise
    tool(
      "create_exercise",
      "Create a coding exercise for the student. This will populate the code editor with starter code and display the exercise instructions.",
      {
        projectId: z.string().describe("The project identifier"),
        sessionId: z.string().describe("The session identifier"),
        type: z
          .enum(["write_code", "fill_in_blank"])
          .default("fill_in_blank")
          .describe(
            "Exercise type: 'fill_in_blank' for blank markers (___), 'write_code' for free-form coding with // YOUR CODE HERE markers"
          ),
        title: z.string().describe("The exercise title (e.g., 'Unwrapping Optionals')"),
        language: z
          .string()
          .describe(
            "Programming language for syntax highlighting (e.g., 'swift', 'python', 'typescript', 'javascript')"
          ),
        instructions: z
          .string()
          .describe("Clear instructions for what the student should implement"),
        starterCode: z.string().describe("Initial code to populate the editor"),
        expectedBehavior: z
          .string()
          .describe(
            "Description of what the correct solution should do (e.g., 'safeLength(\"hello\") returns 5')"
          ),
      },
      async (args) => {
        // Validate starterCode contains at least one blank marker for fill-in-blank exercises
        if (args.type === "fill_in_blank" && !args.starterCode.includes("___")) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error:
                    "Fill-in-blank exercises must contain at least one blank marker (___) in starter code",
                }),
              },
            ],
          };
        }

        // Generate unique exercise ID
        const exerciseId = generateId();

        // Create exercise object
        const exercise: Exercise = {
          id: exerciseId,
          type: args.type,
          title: args.title,
          language: args.language,
          instructions: args.instructions,
          starterCode: args.starterCode,
          expectedBehavior: args.expectedBehavior,
          status: "active",
          attempts: [],
          hints: [],
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        };

        // Persist exercise to session
        await addExerciseToSession(args.projectId, args.sessionId, exercise);

        // Set as active exercise
        await setActiveExerciseId(args.projectId, args.sessionId, exerciseId);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                exerciseId,
                message: "Exercise created successfully",
              }),
            },
          ],
        };
      }
    ),

    // 4. update_exercise - Update exercise status after assessment
    tool(
      "update_exercise",
      "Update exercise status after assessing a student's submission. Use this after reviewing submitted code to mark the exercise as passed, needs_retry (with hint), passed_with_feedback, or failed.",
      {
        projectId: z.string().describe("The project ID"),
        sessionId: z.string().describe("The session ID"),
        exerciseId: z.string().describe("The exercise ID to update"),
        status: z
          .enum(["passed", "skipped", "needs_retry", "failed", "passed_with_feedback"])
          .optional()
          .describe("New status for the exercise"),
        hint: z
          .string()
          .optional()
          .describe("Hint to add when requesting a retry (used with needs_retry status)"),
      },
      async ({ projectId, sessionId, exerciseId, status, hint }) => {
        const updates: Partial<Exercise> = {
          updatedAt: new Date().toISOString(),
        };

        if (status) {
          updates.status = status;
        }

        // Fetch current exercise to update hints and latest attempt status
        const sessionResponse = await fetch(
          `${process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000"}/api/projects/${projectId}/sessions/${sessionId}`
        );
        if (!sessionResponse.ok) {
          console.error(
            "Failed to fetch session for exercise update:",
            sessionResponse.status,
            await sessionResponse.text().catch(() => "")
          );
        }
        if (sessionResponse.ok) {
          const session = await sessionResponse.json();
          const currentExercise = session.exercises?.[exerciseId];
          if (currentExercise) {
            // Add hint if provided
            if (hint) {
              updates.hints = [...(currentExercise.hints || []), hint];
            }

            // Update the latest attempt's status to match the exercise status
            // This provides per-attempt status tracking for the submission cards
            if (status && currentExercise.attempts && currentExercise.attempts.length > 0) {
              const updatedAttempts = [...currentExercise.attempts];
              const latestAttempt = updatedAttempts[updatedAttempts.length - 1];
              updatedAttempts[updatedAttempts.length - 1] = {
                ...latestAttempt,
                status,
              };
              updates.attempts = updatedAttempts;
            }
          }
        }

        const exerciseFound = await updateExerciseInSession(
          projectId,
          sessionId,
          exerciseId,
          updates
        );

        if (!exerciseFound) {
          return {
            content: [
              {
                type: "text" as const,
                text: JSON.stringify({
                  error: `Exercise not found: ${exerciseId}`,
                  exerciseId,
                }),
              },
            ],
          };
        }

        // Clear activeExerciseId if terminal status
        if (
          status === "passed" ||
          status === "passed_with_feedback" ||
          status === "failed" ||
          status === "skipped"
        ) {
          await setActiveExerciseId(projectId, sessionId, null);
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({ exerciseId, message: "Exercise updated successfully" }),
            },
          ],
        };
      }
    ),

    // 5. list_topics - List all topics with progress
    tool(
      "list_topics",
      "Get all topics with progress data for the current project. Use this to see what the student has studied before.",
      {
        projectId: z.string().describe("The project identifier"),
      },
      async (args) => {
        try {
          const topics = await storage.listTopicsWithProgress(args.projectId);
          return {
            content: [
              {
                type: "text" as const,
                text:
                  topics.length > 0
                    ? JSON.stringify(topics, null, 2)
                    : "No topics with progress found for this project. This student is new.",
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error listing topics: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      }
    ),

    // 6. wrap_up_session - End session and save summary
    tool(
      "wrap_up_session",
      "End the current tutoring session, save the summary, and mark all relevant progress updates. Call this when the student wants to finish the session.",
      {
        projectId: z.string().describe("The project identifier"),
        sessionId: z.string().describe("The session identifier"),
        summary: z
          .string()
          .describe("A comprehensive summary of what was covered and learned in this session"),
        topicsUpdated: z
          .array(z.string())
          .describe("List of topics that were covered in this session"),
      },
      async (args) => {
        try {
          await storage.wrapUpSession(
            args.projectId,
            args.sessionId,
            args.summary,
            args.topicsUpdated
          );
          return {
            content: [
              {
                type: "text" as const,
                text: `Session wrapped up successfully. Summary saved and progress recorded for topics: ${args.topicsUpdated.join(", ")}.`,
              },
            ],
          };
        } catch (error) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Error wrapping up session: ${error instanceof Error ? error.message : "Unknown error"}`,
              },
            ],
          };
        }
      }
    ),

    // 7. ask_concept_question - Ask a conceptual multiple-choice question
    tool(
      "ask_concept_question",
      "Ask the student a multiple-choice conceptual question to test their understanding of a concept. The question appears inline in the chat as an interactive card with clickable options. After calling this tool, STOP and wait for the student to answer before continuing.",
      {
        projectId: z.string().describe("The project identifier"),
        sessionId: z.string().describe("The session identifier"),
        question: z.string().describe("The question text to test conceptual understanding"),
        options: z
          .array(
            z.object({
              text: z.string().describe("The option text"),
              correctness: z
                .enum(["correct", "partial", "incorrect"])
                .describe(
                  "How correct this option is: 'correct' for the best answer, 'partial' for partially correct, 'incorrect' for wrong"
                ),
            })
          )
          .min(2)
          .max(5)
          .describe("The answer options (2-5 options)"),
      },
      async (args) => {
        const questionId = generateId();

        const conceptQuestion: ConceptQuestion = {
          id: questionId,
          question: args.question,
          options: args.options,
          selectedOptionIndex: null,
          status: "unanswered",
          createdAt: new Date().toISOString(),
        };

        await addConceptQuestionToSession(args.projectId, args.sessionId, conceptQuestion);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify({
                questionId,
                message: "Concept question created successfully",
              }),
            },
          ],
        };
      }
    ),
  ],
});
