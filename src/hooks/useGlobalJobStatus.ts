"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { subscribeGlobalStream } from "@/lib/globalEventStream";

export type SessionIndicator =
  | { kind: "running" }
  | { kind: "finished" }
  | { kind: "error"; error?: string };

type GlobalJobStatus = "running" | "finished" | "error" | "aborted";

interface GlobalJobEvent {
  sessionId: string;
  projectId: string;
  status: GlobalJobStatus;
  error?: string;
}

interface SnapshotPayload {
  running: Array<{ sessionId: string; projectId: string }>;
}

interface UnseenEntry {
  status: "finished" | "error";
  error?: string;
}

type UnseenMap = Record<string, UnseenEntry>;

const STORAGE_KEY = "mula:unseenJobStatus";

function readUnseen(): UnseenMap {
  if (typeof localStorage === "undefined") return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as UnseenMap) : {};
  } catch {
    return {};
  }
}

function writeUnseen(map: UnseenMap): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
    // quota or disabled storage — fail silent
  }
}

export function useGlobalJobStatus(): {
  indicators: Record<string, SessionIndicator>;
  clearSession: (sessionId: string) => void;
} {
  const [running, setRunning] = useState<Set<string>>(new Set());
  const [unseen, setUnseen] = useState<UnseenMap>(() => readUnseen());

  // Keep refs so the SSE handlers don't capture stale state.
  const runningRef = useRef(running);
  runningRef.current = running;
  const unseenRef = useRef(unseen);
  unseenRef.current = unseen;

  const applyEvent = useCallback((ev: GlobalJobEvent) => {
    const { sessionId, status, error } = ev;
    if (status === "running") {
      const next = new Set(runningRef.current);
      next.add(sessionId);
      setRunning(next);
      // A retry that succeeds should clear the prior error/finished badge.
      if (unseenRef.current[sessionId]) {
        const u = { ...unseenRef.current };
        delete u[sessionId];
        setUnseen(u);
        writeUnseen(u);
      }
      return;
    }
    if (runningRef.current.has(sessionId)) {
      const next = new Set(runningRef.current);
      next.delete(sessionId);
      setRunning(next);
    }
    if (status === "aborted") return; // user cancelled — no notification
    const u: UnseenMap = { ...unseenRef.current };
    u[sessionId] = { status, error };
    setUnseen(u);
    writeUnseen(u);
  }, []);

  useEffect(() => {
    return subscribeGlobalStream((event, payload) => {
      if (event === "snapshot") {
        const { running: runningList } = payload as SnapshotPayload;
        setRunning(new Set(runningList.map((r) => r.sessionId)));
      } else if (event === "state") {
        applyEvent(payload as GlobalJobEvent);
      }
    });
  }, [applyEvent]);

  const clearSession = useCallback((sessionId: string) => {
    if (!unseenRef.current[sessionId]) return;
    const u = { ...unseenRef.current };
    delete u[sessionId];
    setUnseen(u);
    writeUnseen(u);
  }, []);

  const indicators: Record<string, SessionIndicator> = {};
  for (const sessionId of running) {
    indicators[sessionId] = { kind: "running" };
  }
  for (const [sessionId, entry] of Object.entries(unseen)) {
    if (indicators[sessionId]) continue; // running wins
    indicators[sessionId] =
      entry.status === "error"
        ? { kind: "error", error: entry.error }
        : { kind: "finished" };
  }

  return { indicators, clearSession };
}
