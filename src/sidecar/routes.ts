import { Router } from "express";
import * as storage from "./storage";
import { publishStateRefresh } from "./chatJobs";

export const router = Router();

// ──────────────────────────────────────────────
// Projects
// ──────────────────────────────────────────────

router.get("/api/projects", async (_req, res) => {
  try {
    const projects = await storage.listProjects();
    res.json(projects);
  } catch (error) {
    console.error("Failed to list projects:", error);
    res.status(500).json({ error: "Failed to list projects" });
  }
});

router.post("/api/projects", async (req, res) => {
  try {
    const { name, description } = req.body;
    if (!name) {
      res.status(400).json({ error: "Project name is required" });
      return;
    }
    const project = await storage.createProject(name, description);
    res.status(201).json(project);
  } catch (error) {
    console.error("Failed to create project:", error);
    res.status(500).json({ error: "Failed to create project" });
  }
});

router.get("/api/projects/:projectId", async (req, res) => {
  try {
    const project = await storage.getProject(req.params.projectId);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  } catch (error) {
    console.error("Failed to get project:", error);
    res.status(500).json({ error: "Failed to get project" });
  }
});

router.patch("/api/projects/:projectId", async (req, res) => {
  try {
    const project = await storage.updateProject(req.params.projectId, req.body);
    if (!project) {
      res.status(404).json({ error: "Project not found" });
      return;
    }
    res.json(project);
  } catch (error) {
    console.error("Failed to update project:", error);
    res.status(500).json({ error: "Failed to update project" });
  }
});

router.delete("/api/projects/:projectId", async (req, res) => {
  try {
    await storage.deleteProject(req.params.projectId);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete project:", error);
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// ──────────────────────────────────────────────
// Sessions
// ──────────────────────────────────────────────

router.get("/api/projects/:projectId/sessions", async (req, res) => {
  try {
    const sessions = await storage.listSessions(req.params.projectId);
    res.json(sessions);
  } catch (error) {
    console.error("Failed to list sessions:", error);
    res.status(500).json({ error: "Failed to list sessions" });
  }
});

router.post("/api/projects/:projectId/sessions", async (req, res) => {
  try {
    const session = await storage.createSession(req.params.projectId, req.body?.title);
    res.status(201).json(session);
  } catch (error) {
    console.error("Failed to create session:", error);
    res.status(500).json({ error: "Failed to create session" });
  }
});

router.get("/api/projects/:projectId/sessions/:sessionId", async (req, res) => {
  try {
    const session = await storage.getSession(req.params.projectId, req.params.sessionId);
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.set("Cache-Control", "no-store, no-cache, must-revalidate");
    res.json(session);
  } catch (error) {
    console.error("Failed to get session:", error);
    res.status(500).json({ error: "Failed to get session" });
  }
});

router.patch("/api/projects/:projectId/sessions/:sessionId", async (req, res) => {
  try {
    const session = await storage.updateSession(
      req.params.projectId,
      req.params.sessionId,
      req.body
    );
    if (!session) {
      res.status(404).json({ error: "Session not found" });
      return;
    }
    res.json(session);
  } catch (error) {
    console.error("Failed to update session:", error);
    res.status(500).json({ error: "Failed to update session" });
  }
});

router.delete("/api/projects/:projectId/sessions/:sessionId", async (req, res) => {
  try {
    await storage.deleteSession(req.params.projectId, req.params.sessionId);
    res.json({ success: true });
  } catch (error) {
    console.error("Failed to delete session:", error);
    res.status(500).json({ error: "Failed to delete session" });
  }
});

// ──────────────────────────────────────────────
// Exercise Attempts / Retry / Skip
// ──────────────────────────────────────────────

router.post(
  "/api/projects/:projectId/sessions/:sessionId/exercises/:exerciseId/attempts",
  async (req, res) => {
    try {
      const { attemptId, code, blankValues } = req.body;
      if (!attemptId || !code) {
        res.status(400).json({ error: "attemptId and code are required" });
        return;
      }

      // Validate blankValues if provided
      if (blankValues !== undefined) {
        if (
          typeof blankValues !== "object" ||
          blankValues === null ||
          Array.isArray(blankValues) ||
          !Object.values(blankValues).every((v) => typeof v === "string")
        ) {
          res.status(400).json({ error: "blankValues must be an object with string values" });
          return;
        }
      }

      const attempt = await storage.submitAttempt(
        req.params.projectId,
        req.params.sessionId,
        req.params.exerciseId,
        attemptId,
        code,
        blankValues
      );

      if (!attempt) {
        res.status(404).json({ error: "Exercise not found" });
        return;
      }

      void publishStateRefresh(req.params.projectId, req.params.sessionId);
      res.json(attempt);
    } catch (error) {
      console.error("Failed to submit attempt:", error);
      res.status(500).json({ error: "Failed to submit attempt" });
    }
  }
);

router.post(
  "/api/projects/:projectId/sessions/:sessionId/exercises/:exerciseId/retry",
  async (req, res) => {
    try {
      const { projectId, sessionId, exerciseId } = req.params;

      const updated = await storage.updateExercise(projectId, sessionId, exerciseId, {
        status: "active",
      });

      if (!updated) {
        res.status(404).json({ error: "Exercise not found" });
        return;
      }

      await storage.setActiveExerciseId(projectId, sessionId, exerciseId);

      void publishStateRefresh(projectId, sessionId);
      res.json({ success: true, exerciseId, status: "active" });
    } catch (error) {
      console.error("Failed to retry exercise:", error);
      res.status(500).json({ error: "Failed to retry exercise" });
    }
  }
);

router.post(
  "/api/projects/:projectId/sessions/:sessionId/exercises/:exerciseId/skip",
  async (req, res) => {
    try {
      const { projectId, sessionId, exerciseId } = req.params;

      const updated = await storage.updateExercise(projectId, sessionId, exerciseId, {
        status: "skipped",
      });

      if (!updated) {
        res.status(404).json({ error: "Exercise not found" });
        return;
      }

      await storage.setActiveExerciseId(projectId, sessionId, null);

      void publishStateRefresh(projectId, sessionId);
      res.json({ success: true, exerciseId, status: "skipped" });
    } catch (error) {
      console.error("Failed to skip exercise:", error);
      res.status(500).json({ error: "Failed to skip exercise" });
    }
  }
);

// ──────────────────────────────────────────────
// Concept Questions
// ──────────────────────────────────────────────

router.post(
  "/api/projects/:projectId/sessions/:sessionId/concept-questions/:questionId/answer",
  async (req, res) => {
    try {
      const { selectedOptionIndex } = req.body;
      if (typeof selectedOptionIndex !== "number") {
        res.status(400).json({ error: "selectedOptionIndex is required and must be a number" });
        return;
      }

      const question = await storage.answerConceptQuestion(
        req.params.projectId,
        req.params.sessionId,
        req.params.questionId,
        selectedOptionIndex
      );

      if (!question) {
        res.status(404).json({ error: "Question not found" });
        return;
      }

      void publishStateRefresh(req.params.projectId, req.params.sessionId);
      res.json(question);
    } catch (error) {
      console.error("Failed to answer concept question:", error);
      res.status(500).json({ error: "Failed to answer concept question" });
    }
  }
);
