/**
 * Where operational events go on a deployed backend.
 *
 * Kept apart from `monitoring.ts` on purpose: that module stays pure and
 * dependency-free so its redaction rules can be tested without Firebase, and
 * this one is the only place that knows about a logger. Swapping the
 * destination later means changing this file and nothing else.
 *
 * Events are written as structured entries through the Functions logger, which
 * lands them in Cloud Logging. No third-party analytics, no paid service, and
 * nothing the browser can reach directly.
 */
import { logger } from "firebase-functions";

import { recordOperationalEvent, type MonitoringSink, type OperationalEventKind } from "./monitoring";

/**
 * A sink failure must never take down the operation being monitored. Losing an
 * event is an inconvenience; losing a learner's mock submission because a log
 * write failed is not acceptable.
 */
export const cloudLoggingSink: MonitoringSink = (event) => {
  try {
    logger.info("operational-event", {
      kind: event.kind,
      actorRef: event.actorRef,
      ...event.details,
    });
  } catch {
    // Deliberately silent: there is nowhere left to report a reporting failure.
  }
};

/** Records one event through the default sink, swallowing any sink failure. */
export function monitor(
  kind: OperationalEventKind,
  input: { actorRef?: string | null; details?: Record<string, unknown> },
  sink: MonitoringSink = cloudLoggingSink,
): void {
  try {
    recordOperationalEvent(kind, input, sink);
  } catch {
    // As above. Monitoring is never load-bearing.
  }
}
