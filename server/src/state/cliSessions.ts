import { and, eq, lt } from "drizzle-orm";
import { db } from "../db";
import { cliSessions } from "../db/schema";

const SESSION_TTL_MS = 10 * 60 * 1000;

export const createCliSession = async () => {
  const expiresAt = new Date(Date.now() + SESSION_TTL_MS);
  const [session] = await db
    .insert(cliSessions)
    .values({
      expiresAt,
      status: "pending",
    })
    .returning();

  return session!;
};

export const getCliSession = async (sessionId: string) => {
  await cleanupExpiredCliSessions();

  return db.query.cliSessions.findFirst({
    where: eq(cliSessions.id, sessionId),
  });
};

export const completeCliSession = async (sessionId: string, apiKey: string) => {
  await db
    .update(cliSessions)
    .set({
      status: "complete",
      apiKey,
      completedAt: new Date(),
    })
    .where(eq(cliSessions.id, sessionId));
};

export const consumeCliSession = async (sessionId: string) => {
  const session = await db.query.cliSessions.findFirst({
    where: eq(cliSessions.id, sessionId),
  });

  if (!session) {
    return null;
  }

  await db.delete(cliSessions).where(eq(cliSessions.id, sessionId));
  return session;
};

export const cleanupExpiredCliSessions = async () => {
  await db.delete(cliSessions).where(
    and(lt(cliSessions.expiresAt, new Date()), eq(cliSessions.status, "pending"))
  );
};
