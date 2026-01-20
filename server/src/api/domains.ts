import { Router } from "express";
import { db } from "../db";
import { domains, users, domainLogs } from "../db/schema";
import { eq, desc, asc, and } from "drizzle-orm";
import { authMiddleware } from "./auth";
import { isSubdomainTaken } from "../registry";

const router = Router();

// Special emails that get paid features without isPaid flag
const SPECIAL_EMAILS = ["amaechinaikechukwu6@gmail.com"];

// Helper to check if user has paid-tier access
const hasPaidAccess = (user: { isPaid: boolean; email: string }) => {
  return user.isPaid || SPECIAL_EMAILS.includes(user.email);
};

// GET /api/domains - Get domains for the authenticated user
// Free users: only see their FIRST domain
// Paid users: see all domains
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    // Get user to check paid status
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isPaid = hasPaidAccess(user);

    // Get all user domains ordered by creation date (oldest first)
    const userDomains = await db.query.domains.findMany({
      where: eq(domains.userId, userId),
      orderBy: (domains) => [asc(domains.createdAt)],
    });

    // For free users, only return their first domain
    const visibleDomains = isPaid ? userDomains : userDomains.slice(0, 1);

    // Map domains with online status
    const domainsWithStatus = visibleDomains.map((domain) => ({
      subdomain: domain.subdomain,
      createdAt: domain.createdAt,
      lastUsedAt: domain.lastUsedAt,
      isOnline: isSubdomainTaken(domain.subdomain),
    }));

    res.json({
      domains: domainsWithStatus,
      isPaid,
      totalDomains: userDomains.length,
      domainLimit: isPaid ? null : 1, // null = unlimited
    });
  } catch (error) {
    console.error("Get domains error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/domains/stats - Get domain statistics for the authenticated user
router.get("/stats", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    // Get user for paid status
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    const isPaid = hasPaidAccess(user);

    const userDomains = await db.query.domains.findMany({
      where: eq(domains.userId, userId),
      orderBy: (domains) => [desc(domains.lastUsedAt)],
    });

    const domainCount = userDomains.length;
    const lastUsedDomain = userDomains.find((d) => d.lastUsedAt !== null);
    const lastUsedAt = lastUsedDomain?.lastUsedAt || null;

    // Get log count for paid users
    let totalLogs = 0;
    if (isPaid) {
      const logs = await db.query.domainLogs.findMany({
        where: eq(domainLogs.userId, userId),
      });
      totalLogs = logs.length;
    }

    res.json({
      domainCount,
      lastUsedAt,
      isPaid,
      domainLimit: isPaid ? null : 1,
      totalLogs: isPaid ? totalLogs : null, // Hide from free users
    });
  } catch (error) {
    console.error("Get domain stats error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/domains/logs - Get request logs (PAID ONLY)
router.get("/logs", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    // Get user to check paid status
    const user = await db.query.users.findFirst({
      where: eq(users.id, userId),
    });

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    if (!hasPaidAccess(user)) {
      return res.status(403).json({ 
        error: "Logs are a paid feature. Upgrade to access request history.",
        isPaid: false,
      });
    }

    // Get query params for filtering
    const subdomain = req.query.subdomain as string | undefined;
    const limit = Math.min(parseInt(req.query.limit as string) || 50, 200);
    const offset = parseInt(req.query.offset as string) || 0;

    // Build query
    const whereClause = subdomain
      ? and(eq(domainLogs.userId, userId), eq(domainLogs.subdomain, subdomain))
      : eq(domainLogs.userId, userId);

    const logs = await db.query.domainLogs.findMany({
      where: whereClause,
      orderBy: (logs) => [desc(logs.createdAt)],
      limit,
      offset,
    });

    res.json({
      logs,
      isPaid: true,
    });
  } catch (error) {
    console.error("Get logs error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// Update last used timestamp for a domain
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

// Log a request (for paid users only)
export const logDomainRequest = async (
  subdomain: string,
  userId: string,
  method: string,
  path: string,
  statusCode: number | null,
  responseTime: number | null
) => {
  try {
    await db.insert(domainLogs).values({
      subdomain,
      userId,
      method,
      path,
      statusCode,
      responseTime,
    });
  } catch (error) {
    console.error("Log request error:", error);
  }
};

export default router;
