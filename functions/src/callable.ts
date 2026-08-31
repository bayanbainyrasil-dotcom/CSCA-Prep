import { createHash } from "node:crypto";

import { FieldValue, Timestamp } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";
import type { z } from "zod";

import { db } from "./platform";

export interface Principal {
  uid: string;
  email?: string;
  token: Record<string, unknown>;
}

export function requireAuth<T>(request: CallableRequest<T>): Principal {
  if (!request.auth) {
    throw new HttpsError("unauthenticated", "Sign in is required.");
  }

  return {
    uid: request.auth.uid,
    email:
      typeof request.auth.token.email === "string"
        ? request.auth.token.email
        : undefined,
    token: request.auth.token as Record<string, unknown>,
  };
}

export function requireAdmin<T>(request: CallableRequest<T>): Principal {
  const principal = requireAuth(request);
  if (
    principal.token.admin !== true &&
    principal.token.role !== "admin"
  ) {
    throw new HttpsError(
      "permission-denied",
      "A current administrator claim is required.",
    );
  }
  return principal;
}

export function parseInput<TSchema extends z.ZodTypeAny>(
  schema: TSchema,
  input: unknown,
): z.infer<TSchema> {
  const parsed = schema.safeParse(input ?? {});
  if (!parsed.success) {
    throw new HttpsError("invalid-argument", "Request validation failed.", {
      issues: parsed.error.issues.map((issue) => ({
        code: issue.code,
        message: issue.message,
        path: issue.path.join("."),
      })),
    });
  }
  return parsed.data;
}

export async function enforceRateLimit(
  action: string,
  identity: string,
  limit: number,
  windowSeconds: number,
): Promise<void> {
  const key = createHash("sha256")
    .update(`${action}:${identity}`)
    .digest("hex");
  const ref = db.collection("_rateLimits").doc(key);
  const now = Timestamp.now();
  const nextExpiry = Timestamp.fromMillis(
    now.toMillis() + windowSeconds * 1_000,
  );

  await db.runTransaction(async (transaction) => {
    const snapshot = await transaction.get(ref);
    const data = snapshot.data();
    const expiresAt = data?.expiresAt;
    const isCurrentWindow =
      expiresAt instanceof Timestamp && expiresAt.toMillis() > now.toMillis();
    const currentCount =
      isCurrentWindow && typeof data?.count === "number" ? data.count : 0;

    if (currentCount >= limit) {
      throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Try again later.",
      );
    }

    transaction.set(
      ref,
      {
        action,
        count: currentCount + 1,
        expiresAt: isCurrentWindow ? expiresAt : nextExpiry,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  });
}

export async function writeAuditLog(
  actorUid: string,
  action: string,
  details: Record<string, unknown> = {},
): Promise<void> {
  await db.collection("_auditLogs").add({
    actorUid,
    action,
    details,
    createdAt: FieldValue.serverTimestamp(),
  });
}

export function jsonSafe(value: unknown): unknown {
  if (value instanceof Timestamp) {
    return { $type: "timestamp", value: value.toDate().toISOString() };
  }
  if (Buffer.isBuffer(value)) {
    return { $type: "bytes", value: value.toString("base64") };
  }
  if (Array.isArray(value)) {
    return value.map(jsonSafe);
  }
  if (value !== null && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      output[key] = jsonSafe(child);
    }
    return output;
  }
  return value;
}
