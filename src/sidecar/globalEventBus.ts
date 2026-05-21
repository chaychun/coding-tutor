import type { Response } from "express";

/**
 * Generic SSE pubsub. Any sidecar subsystem (chat jobs, title jobs, future
 * background workers) can fan-out events to every connected client via
 * `broadcastGlobal`. The route handler at /api/jobs/events owns subscribing
 * `Response` objects in and out; subsystem-specific snapshots/catch-up are
 * the route's job, not this file's.
 */

const subscribers = new Set<Response>();

export function broadcastGlobal(event: string, payload: unknown): void {
  if (subscribers.size === 0) return;
  const chunk = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of subscribers) {
    try {
      res.write(chunk);
    } catch {
      // dead connection — close handler cleans up
    }
  }
}

export function subscribeGlobalEvents(res: Response): () => void {
  subscribers.add(res);
  return () => {
    subscribers.delete(res);
  };
}
