import { Router } from "express";
import { db } from "../db";
import { domains } from "../db/schema";
import { eq, desc } from "drizzle-orm";
import { authMiddleware } from "./auth";
import { isSubdomainTaken } from "../registry";

const router = Router();

// GET /api/domains - Get all domains for the authenticated user
router.get("/", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const userDomains = await db.query.domains.findMany({
      where: eq(domains.userId, userId),
      orderBy: (domains, { desc }) => [desc(domains.createdAt)],
    });

    // Map domains with online status
    const domainsWithStatus = userDomains.map((domain) => ({
      subdomain: domain.subdomain,
      createdAt: domain.createdAt,
      lastUsedAt: domain.lastUsedAt,
      isOnline: isSubdomainTaken(domain.subdomain),
    }));

    res.json(domainsWithStatus);
  } catch (error) {
    console.error("Get domains error:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/domains/stats - Get domain statistics for the authenticated user
router.get("/stats", authMiddleware, async (req: any, res) => {
  try {
    const userId = req.user.userId;

    const userDomains = await db.query.domains.findMany({
      where: eq(domains.userId, userId),
      orderBy: (domains, { desc }) => [desc(domains.lastUsedAt)],
    });

    const domainCount = userDomains.length;
    const lastUsedDomain = userDomains.find((d) => d.lastUsedAt !== null);
    const lastUsedAt = lastUsedDomain?.lastUsedAt || null;

    res.json({
      domainCount,
      lastUsedAt,
    });
  } catch (error) {
    console.error("Get domain stats error:", error);
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

export default router;
