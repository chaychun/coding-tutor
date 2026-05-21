import type { Request, Response } from "express";
import { getGlobalJobsSnapshot } from "./chatJobs";
import { subscribeGlobalEvents } from "./globalEventBus";

/**
 * GET /api/jobs/events — multiplexed SSE stream. Sends a one-shot `snapshot`
 * frame on connect for chat-job catch-up, then forwards every event broadcast
 * through the global event bus (chat job state, session metadata updates, …).
 */
export function handleJobsEvents(req: Request, res: Response): void {
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  res.write(
    `event: snapshot\ndata: ${JSON.stringify({ running: getGlobalJobsSnapshot() })}\n\n`
  );

  const unsubscribe = subscribeGlobalEvents(res);

  const heartbeat = setInterval(() => {
    try {
      res.write(`: heartbeat ${Date.now()}\n\n`);
    } catch {
      // ignore — close handler cleans up
    }
  }, 25_000);

  const cleanup = (): void => {
    clearInterval(heartbeat);
    unsubscribe();
  };

  req.on("close", cleanup);
  req.on("aborted", cleanup);
  res.on("close", cleanup);
  res.on("error", cleanup);
}
