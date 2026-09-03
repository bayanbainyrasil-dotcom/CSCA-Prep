/**
 * The one channel by which a browser may report an operational problem.
 *
 * A client-writable telemetry endpoint is attack surface, so it exists only for
 * the signal the server genuinely cannot see for itself: a sync failure that
 * happens entirely in the browser, where the outbox never reaches Firestore.
 *
 * Everything else about it is deliberately narrow. Authentication and App Check
 * are required, the schema is strict and has no string field at all, the rate
 * limit is low, the reply carries nothing, and the event touches no learner
 * document — it is written to the log and forgotten. The monitoring sink is not
 * reachable from the browser in any other way.
 */
import { onCall } from "firebase-functions/v2/https";

import { enforceRateLimit, monitored, parseInput, requireAuth } from "./callable";
import { actorRef } from "./monitoring";
import { monitor } from "./monitoring-sink";
import { ClientOperationalEventSchema } from "./schemas";

const standardCallableOptions = {
  enforceAppCheck: true,
  consumeAppCheckToken: true,
  cors: true,
} as const;

/** Salted so a reference cannot be compared across deployments or reversed. */
const ACTOR_SALT = process.env.GCLOUD_PROJECT ?? "csca-prep";

export const reportOperationalEvent = onCall(
  standardCallableOptions,
  monitored("reportOperationalEvent", async (request) => {
    const principal = requireAuth(request);
    const input = parseInput(ClientOperationalEventSchema, request.data);
    // Low on purpose: this is a health signal, not a stream. A client with a
    // genuine problem reports it a handful of times, not hundreds.
    await enforceRateLimit("reportOperationalEvent", principal.uid, 60, 60 * 60);

    monitor(input.kind, {
      actorRef: actorRef(principal.uid, ACTOR_SALT),
      details: {
        operation: "clientSync",
        code: input.reason,
        entityType: input.entityType,
        attempt: input.attempt,
      },
    });

    // Nothing is returned and nothing is stored: a report must not become a way
    // to read state back, and must not touch the learner's progress.
    return { received: true };
  }),
);
