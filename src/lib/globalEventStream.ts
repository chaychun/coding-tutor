import { sidecarFetch } from "@/lib/sidecar";

/**
 * Shared, refcounted SSE subscription to /api/jobs/events. All consumers (job
 * status indicators, session metadata updates, …) share one connection. The
 * stream opens on first subscriber and closes when the last unsubscribes.
 */

export type GlobalStreamListener = (event: string, payload: unknown) => void;

const listeners = new Set<GlobalStreamListener>();
let abortCtrl: AbortController | null = null;
let stopTimer: ReturnType<typeof setTimeout> | null = null;
const STOP_GRACE_MS = 250;

function dispatch(event: string, payload: unknown): void {
  for (const fn of listeners) {
    try {
      fn(event, payload);
    } catch (err) {
      console.error("[globalEventStream] listener threw:", err);
    }
  }
}

function handleFrame(frame: string): void {
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
  dispatch(event, payload);
}

async function run(signal: AbortSignal): Promise<void> {
  try {
    const response = await sidecarFetch("/api/jobs/events", {
      signal,
      headers: { Accept: "text/event-stream" },
    });
    if (!response.ok || !response.body) throw new Error(`HTTP ${response.status}`);
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf("\n\n");
      while (sep !== -1) {
        handleFrame(buffer.slice(0, sep));
        buffer = buffer.slice(sep + 2);
        sep = buffer.indexOf("\n\n");
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") return;
    console.error("[globalEventStream] stream failed:", err);
  }
}

function ensureRunning(): void {
  if (abortCtrl && !abortCtrl.signal.aborted) return;
  const ctrl = new AbortController();
  abortCtrl = ctrl;
  void run(ctrl.signal).finally(() => {
    if (abortCtrl === ctrl) abortCtrl = null;
  });
}

function stop(): void {
  abortCtrl?.abort();
  abortCtrl = null;
}

export function subscribeGlobalStream(listener: GlobalStreamListener): () => void {
  if (stopTimer) {
    clearTimeout(stopTimer);
    stopTimer = null;
  }
  listeners.add(listener);
  ensureRunning();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      if (stopTimer) clearTimeout(stopTimer);
      stopTimer = setTimeout(() => {
        stopTimer = null;
        if (listeners.size === 0) stop();
      }, STOP_GRACE_MS);
    }
  };
}
