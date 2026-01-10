"use client";

import { useState, useCallback } from "react";
import type { Session } from "@/lib/types";

export function useSessions(projectId: string | null) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentSession, setCurrentSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch sessions for a project
  const fetchSessions = useCallback(async (pid: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${pid}/sessions`);
      if (!response.ok) throw new Error("Failed to fetch sessions");
      const data = await response.json();
      setSessions(data);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, []);

  // Fetch a specific session
  const fetchSession = useCallback(async (pid: string, sessionId: string) => {
    try {
      setLoading(true);
      const response = await fetch(`/api/projects/${pid}/sessions/${sessionId}`);
      if (!response.ok) throw new Error("Failed to fetch session");
      const data = await response.json();
      setCurrentSession(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  // Create a new session
  const createSession = useCallback(async (pid: string, title?: string) => {
    try {
      const response = await fetch(`/api/projects/${pid}/sessions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title }),
      });
      if (!response.ok) throw new Error("Failed to create session");
      const newSession = await response.json();
      setSessions((prev) => [newSession, ...prev]);
      setCurrentSession(newSession);
      return newSession;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    }
  }, []);

  // Update a session
  const updateSession = useCallback(async (pid: string, sessionId: string, updates: Partial<Session>) => {
    try {
      const response = await fetch(`/api/projects/${pid}/sessions/${sessionId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (!response.ok) throw new Error("Failed to update session");
      const updatedSession = await response.json();
      setSessions((prev) =>
        prev.map((s) => (s.id === sessionId ? updatedSession : s))
      );
      if (currentSession?.id === sessionId) {
        setCurrentSession(updatedSession);
      }
      return updatedSession;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
      throw err;
    }
  }, [currentSession?.id]);

  // Update session title in local state only (used after async title generation)
  const updateSessionTitleLocal = useCallback((sessionId: string, title: string) => {
    setSessions((prev) =>
      prev.map((s) => (s.id === sessionId ? { ...s, title } : s))
    );
    if (currentSession?.id === sessionId) {
      setCurrentSession((prev) => (prev ? { ...prev, title } : null));
    }
  }, [currentSession?.id]);

  // Select a session
  const selectSession = useCallback(async (pid: string, sessionId: string) => {
    return fetchSession(pid, sessionId);
  }, [fetchSession]);

  // Clear current session
  const clearSession = useCallback(() => {
    setCurrentSession(null);
  }, []);

  return {
    sessions,
    currentSession,
    loading,
    error,
    fetchSessions,
    fetchSession,
    createSession,
    updateSession,
    updateSessionTitleLocal,
    selectSession,
    clearSession,
  };
}
