import { Router } from "express";
import bcrypt from "bcryptjs";
import { and, asc, desc, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "../db";
import { domainLogs, domains, users } from "../db/schema";
import { authMiddleware } from "./auth";
import { isSubdomainTaken } from "../registry";
import { getUserPlan } from "./billing";
import { SERVER_PORT, TUNNEL_BASE_DOMAIN } from "../config";

const router = Router();

const accessSettingsSchema = z.object({
  accessToken: z.string().min(8).max(128).nullable().optional(),
  basicAuthUsername: z.string().min(1).max(64).nullable().optional(),
  basicAuthPassword: z.string().min(8).max(128).nullable().optional(),
});

const hasPaidAccess = async (
  userId: string,
  user: { isPaid: boolean; email: string }
) => {
  const { plan } = await getUserPlan(userId);
  if (plan !== "free") {
    return true;
  }

  return user.isPaid;
};

router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 20), 100);
    const offset = (page - 1) * limit;

    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isPaid = await hasPaidAccess(userId, user);
    const userDomains = await db.query.domains.findMany({
      where: eq(domains.userId, userId),
      orderBy: (table) => [asc(table.createdAt)],
    });

    const visibleDomains = isPaid ? userDomains : userDomains.slice(0, 1);
    const paginatedDomains = visibleDomains.slice(offset, offset + limit);

    res.json({
      domains: paginatedDomains.map((domain) => ({
        subdomain: domain.subdomain,
        createdAt: domain.createdAt,
        lastUsedAt: domain.lastUsedAt,
        hasAccessToken: Boolean(domain.accessToken),
        hasBasicAuth: Boolean(
          domain.basicAuthUsername && domain.basicAuthPasswordHash
        ),
        isOnline: isSubdomainTaken(domain.subdomain),
      })),
      isPaid,
      totalDomains: visibleDomains.length,
      domainLimit: isPaid ? null : 1,
      page,
      limit,
      totalPages: Math.ceil(visibleDomains.length / limit),
      baseDomain: TUNNEL_BASE_DOMAIN,
    });
  } catch (error) {
    console.error("Get domains error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/stats", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isPaid = await hasPaidAccess(userId, user);
    const userDomains = await db.query.domains.findMany({
      where: eq(domains.userId, userId),
      orderBy: (table) => [desc(table.lastUsedAt)],
    });

    let totalLogs = 0;
    if (isPaid) {
      const logs = await db.query.domainLogs.findMany({
        where: eq(domainLogs.userId, userId),
        columns: { id: true },
      });
      totalLogs = logs.length;
    }

    res.json({
      domainCount: userDomains.length,
      lastUsedAt: userDomains.find((domain) => domain.lastUsedAt)?.lastUsedAt || null,
      isPaid,
      domainLimit: isPaid ? null : 1,
      totalLogs: isPaid ? totalLogs : null,
      activeDomains: userDomains.filter((domain) => isSubdomainTaken(domain.subdomain)).length,
    });
  } catch (error) {
    console.error("Get domain stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/logs", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!(await hasPaidAccess(userId, user))) {
      return res.status(403).json({
        error: "Logs are a paid feature. Upgrade to access request history.",
        isPaid: false,
      });
    }

    const subdomain = req.query.subdomain as string | undefined;
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(Math.max(1, parseInt(req.query.limit as string) || 50), 200);
    const offset = (page - 1) * limit;

    const whereClause = subdomain
      ? and(eq(domainLogs.userId, userId), eq(domainLogs.subdomain, subdomain))
      : eq(domainLogs.userId, userId);

    const allLogs = await db.query.domainLogs.findMany({
      where: whereClause,
      columns: { id: true },
    });

    const logs = await db.query.domainLogs.findMany({
      where: whereClause,
      orderBy: (table) => [desc(table.createdAt)],
      limit,
      offset,
    });

    res.json({
      logs,
      isPaid: true,
      page,
      limit,
      totalLogs: allLogs.length,
      totalPages: Math.ceil(allLogs.length / limit),
    });
  } catch (error) {
    console.error("Get logs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/logs/:logId", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const log = await db.query.domainLogs.findFirst({
      where: and(eq(domainLogs.id, req.params.logId), eq(domainLogs.userId, userId)),
    });

    if (!log) {
      return res.status(404).json({ error: "Log not found" });
    }

    res.json({ log });
  } catch (error) {
    console.error("Get log detail error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logs/:logId/replay", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;
    const log = await db.query.domainLogs.findFirst({
      where: and(eq(domainLogs.id, req.params.logId), eq(domainLogs.userId, userId)),
    });

    if (!log) {
      return res.status(404).json({ error: "Log not found" });
    }

    if (log.method === "WS") {
      return res.status(400).json({ error: "WebSocket log replay is not supported" });
    }

    const headers: Record<string, string> = {
      ...((log.requestHeaders as Record<string, string>) || {}),
      host: `${log.subdomain}.${TUNNEL_BASE_DOMAIN}`,
    };
    delete headers["content-length"];

    const replayResponse = await fetch(`http://127.0.0.1:${SERVER_PORT}${log.path}`, {
      method: log.method,
      headers,
      body: log.requestBody || undefined,
    });

    const responseBody = await replayResponse.text();
    res.json({
      statusCode: replayResponse.status,
      headers: Object.fromEntries(replayResponse.headers.entries()),
      bodyPreview: responseBody.slice(0, 4096),
    });
  } catch (error) {
    console.error("Replay log error:", error);
    res.status(500).json({ error: "Failed to replay request" });
  }
});

router.get("/:subdomain/access", authMiddleware, async (req: any, res) => {
  try {
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(domains.subdomain, req.params.subdomain),
        eq(domains.userId, req.user.userId)
      ),
    });

    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }

    res.json({
      subdomain: domain.subdomain,
      hasAccessToken: Boolean(domain.accessToken),
      basicAuthUsername: domain.basicAuthUsername,
      hasBasicAuth: Boolean(
        domain.basicAuthUsername && domain.basicAuthPasswordHash
      ),
    });
  } catch (error) {
    console.error("Get domain access settings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:subdomain/access", authMiddleware, async (req: any, res) => {
  try {
    const settings = accessSettingsSchema.parse(req.body);
    const domain = await db.query.domains.findFirst({
      where: and(
        eq(domains.subdomain, req.params.subdomain),
        eq(domains.userId, req.user.userId)
      ),
    });

    if (!domain) {
      return res.status(404).json({ error: "Domain not found" });
    }

    const basicAuthPasswordHash = settings.basicAuthPassword
      ? await bcrypt.hash(settings.basicAuthPassword, 10)
      : settings.basicAuthUsername === null
      ? null
      : domain.basicAuthPasswordHash;

    await db
      .update(domains)
      .set({
        accessToken:
          settings.accessToken === undefined ? domain.accessToken : settings.accessToken,
        basicAuthUsername:
          settings.basicAuthUsername === undefined
            ? domain.basicAuthUsername
            : settings.basicAuthUsername,
        basicAuthPasswordHash,
      })
      .where(eq(domains.subdomain, domain.subdomain));

    res.json({ success: true });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.issues[0]?.message || "Invalid request" });
    }
    console.error("Update domain access settings error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

export const updateDomainLastUsed = async (subdomain: string) => {
  try {
    await db
      .update(domains)
      .set({ lastUsedAt: new Date() })
      .where(eq(domains.subdomain, subdomain));
  } catch (error) {
    console.error("Update lastUsedAt error:", error);
  }
};

export const logDomainRequest = async (input: {
  subdomain: string;
  userId: string;
  method: string;
  path: string;
  statusCode: number | null;
  responseTime: number | null;
  bytesIn: number;
  bytesOut: number;
  requestHeaders?: Record<string, unknown>;
  responseHeaders?: Record<string, unknown>;
  requestBody?: string;
  responseBody?: string;
  errorMessage?: string | null;
}) => {
  try {
    await db.insert(domainLogs).values({
      subdomain: input.subdomain,
      userId: input.userId,
      method: input.method,
      path: input.path,
      statusCode: input.statusCode,
      responseTime: input.responseTime,
      bytesIn: input.bytesIn,
      bytesOut: input.bytesOut,
      requestHeaders: input.requestHeaders,
      responseHeaders: input.responseHeaders,
      requestBody: input.requestBody,
      responseBody: input.responseBody,
      errorMessage: input.errorMessage ?? null,
    });
  } catch (error) {
    console.error("Log request error:", error);
  }
};

export default router;
