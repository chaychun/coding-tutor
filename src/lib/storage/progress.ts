import * as path from "path";
import type { Progress, ProgressUpdate, TopicSummary } from "../types";
import { getDataPath, readJsonFile, writeJsonFile, listFiles } from "./utils";

// Get progress directory for a project
function getProgressDir(projectId: string): string {
  return path.join(getDataPath(), "projects", projectId, "progress");
}

// Get progress file path for a topic
function getProgressFilePath(projectId: string, topic: string): string {
  // Normalize topic name for file system (replace spaces with dashes, lowercase)
  const normalizedTopic = topic.toLowerCase().replace(/\s+/g, "-");
  return path.join(getProgressDir(projectId), `${normalizedTopic}.json`);
}

// Get progress for a topic
export async function getProgress(projectId: string, topic: string): Promise<Progress | null> {
  return readJsonFile<Progress>(getProgressFilePath(projectId, topic));
}

// Update progress for a topic
export async function updateProgress(
  projectId: string,
  topic: string,
  updates: ProgressUpdate
): Promise<Progress> {
  // Get existing progress or create new
  let progress = await getProgress(projectId, topic);

  if (!progress) {
    progress = {
      topic,
      lastUpdated: new Date().toISOString(),
      overallLevel: "beginner",
      summary: "",
      recentSessions: [],
      masteredConcepts: [],
      needsReinforcement: [],
    };
  }

  // Apply updates
  if (updates.overallLevel) {
    progress.overallLevel = updates.overallLevel;
  }

  if (updates.addToMastered && updates.addToMastered.length > 0) {
    progress.masteredConcepts = [
      ...new Set([...progress.masteredConcepts, ...updates.addToMastered]),
    ];
    // Remove mastered concepts from reinforcement list
    progress.needsReinforcement = progress.needsReinforcement.filter(
      (c) => !updates.addToMastered!.includes(c)
    );
  }

  if (updates.addToReinforcement && updates.addToReinforcement.length > 0) {
    progress.needsReinforcement = [
      ...new Set([...progress.needsReinforcement, ...updates.addToReinforcement]),
    ];
  }

  if (updates.removeFromReinforcement && updates.removeFromReinforcement.length > 0) {
    progress.needsReinforcement = progress.needsReinforcement.filter(
      (c) => !updates.removeFromReinforcement!.includes(c)
    );
  }

  if (updates.sessionNote) {
    progress.recentSessions.unshift({
      date: new Date().toISOString().split("T")[0],
      covered: updates.sessionNote.covered,
      performance: updates.sessionNote.performance,
      notes: updates.sessionNote.notes || null,
    });

    // Keep only last 5 sessions
    if (progress.recentSessions.length > 5) {
      progress.recentSessions = progress.recentSessions.slice(0, 5);
    }
  }

  // Update summary based on current state
  progress.summary = generateProgressSummary(progress);
  progress.lastUpdated = new Date().toISOString();

  await writeJsonFile(getProgressFilePath(projectId, topic), progress);
  return progress;
}

// Generate a summary from progress data
function generateProgressSummary(progress: Progress): string {
  const parts: string[] = [];

  if (progress.masteredConcepts.length > 0) {
    parts.push(
      `Mastered: ${progress.masteredConcepts.slice(0, 3).join(", ")}${progress.masteredConcepts.length > 3 ? "..." : ""}`
    );
  }

  if (progress.needsReinforcement.length > 0) {
    parts.push(`Needs practice: ${progress.needsReinforcement.join(", ")}`);
  }

  if (progress.recentSessions.length > 0) {
    const lastSession = progress.recentSessions[0];
    parts.push(`Last session: ${lastSession.performance}`);
  }

  return parts.join(". ") || "No progress recorded yet.";
}

// List all topics with progress for a project
export async function listTopicsWithProgress(projectId: string): Promise<TopicSummary[]> {
  const progressDir = getProgressDir(projectId);
  const files = await listFiles(progressDir);

  const topics: TopicSummary[] = [];

  for (const file of files) {
    if (file.endsWith(".json")) {
      // Read the file directly instead of going through getProgress
      // to avoid double-normalization of the topic name
      const filePath = path.join(progressDir, file);
      const progress = await readJsonFile<Progress>(filePath);
      if (progress) {
        topics.push({
          topic: progress.topic,
          level: progress.overallLevel,
          lastUpdated: progress.lastUpdated,
        });
      }
    }
  }

  // Sort by lastUpdated descending
  return topics.sort(
    (a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime()
  );
}
