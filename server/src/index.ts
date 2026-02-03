import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { WebSocketServer } from "ws";
import { handleIncomingRequest, handleTunnelMessage } from "./router";
import { isSubdomainTaken, registerTunnel, removeTunnel, getConnectionCount } from "./registry";
import { getRandomName } from "./utils/randomnames";
import { db } from "./db";
import { users, domains, PLAN_LIMITS } from "./db/schema";
import { eq } from "drizzle-orm";
import { parse } from "url";
import authRouter from "./api/auth";
import domainsRouter from "./api/domains";
import billingRouter from "./api/billing";
import { getUserPlan, trackUsage, checkUserLimits } from "./api/billing";

const PORT = Number(process.env.SERVER_PORT || 3000);
const DOMAIN = process.env.DOMAIN_CONNECTION || "localhost:3000";
const API_DOMAIN = process.env.API_DOMAIN || "localhost:9000";
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
const FRONTEND_URL_DEV = process.env.FRONTEND_URL_DEV || "http://localhost:5173";

// Express App
const app = express();

// Security Middleware
app.use(helmet({
  contentSecurityPolicy: false,
}));

app.use(cors({
  origin: [FRONTEND_URL, FRONTEND_URL_DEV, `https://${DOMAIN}`, `https://${API_DOMAIN}`, "http://localhost:5173"],
  methods: ['GET', 'POST', 'PUT', 'DELETE'],
  credentials: true,
}));

app.use(express.json());

// Rate Limiting
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 50, // 50 attempts per 15 min
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Separate, more lenient limiter for CLI session endpoints
const cliSessionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000, // 5 minutes
  max: 100, // 100 attempts per 5 min (polling)
  message: { error: 'Too many attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// CLI Session Routes (more lenient rate limit for polling)
app.use('/api/auth/cli-session', cliSessionLimiter);
app.use('/api/auth/validate', cliSessionLimiter);

// Auth Routes (stricter rate limit for login/register)
app.use('/api/auth', authLimiter, authRouter);

// Domains Routes
app.use('/api/domains', domainsRouter);

// Billing Routes
app.use('/api/billing', billingRouter);

// Create HTTP server from Express
const server = app.listen(PORT, () => {
  console.log(`Knrog Server running on port ${PORT}`);
});

// Handle subdomain-based tunnel requests
app.use((req, res, next) => {
  const host = req.headers.host || "";
  
  // Check if this is a subdomain request (not the main domain)
  // Main domains: knrog.online, app.knrog.online, api.knrog.online, localhost
  const isMainDomain = 
    host === 'knrog.online' ||
    host === `www.${DOMAIN}` ||
    host === DOMAIN || 
    host === API_DOMAIN ||
    host.startsWith("localhost");
  
  // Only handle tunnel requests for subdomains (not main domains)
  if (!isMainDomain && (host.includes('.knrog.online') || host.includes('.'))) {
    handleIncomingRequest(req, res);
  } else {
    next();
  }
});

// WebSocket Server for CLI Connections
const wss = new WebSocketServer({ server });

wss.on("connection", async (ws, req) => {
  const { query } = parse(req.url || "", true);
  const apiKey = (query.apiKey as string) || (req.headers["x-api-key"] as string);
  const requestedSubdomain = (query.subdomain as string);

  if (!apiKey) {
    ws.close(1008, "API Key required");
    return;
  }

  // Validate User
  const user = await db.query.users.findFirst({
    where: eq(users.apiKey, apiKey),
  });

  if (!user) {
    ws.close(1008, "Invalid API Key");
    return;
  }

  // Get user's subscription plan
  const { plan } = await getUserPlan(user.id);
  const planLimits = PLAN_LIMITS[plan];

  // Enforce Connection Limit FIRST (before creating subdomain)
  const activeConnections = getConnectionCount(user.id);
  const CONNECTION_LIMIT = planLimits.connections;

  if (activeConnections >= CONNECTION_LIMIT) {
    ws.close(1008, `Connection limit reached (${CONNECTION_LIMIT}). Upgrade for more.`);
    return;
  }

  // Check bandwidth limits
  const { withinLimits, reason } = await checkUserLimits(user.id);
  if (!withinLimits) {
    ws.close(1008, reason || "Usage limit exceeded");
    return;
  }

  // Check if user has paid-tier access
  const hasPaidAccess = plan !== "free" || user.isPaid;

  // Get user's existing domains (ordered by creation date, oldest first)
  const userDomains = await db.query.domains.findMany({
    where: eq(domains.userId, user.id),
    orderBy: (domains, { asc }) => [asc(domains.createdAt)],
  });

  // Determine Subdomain
  let subdomain = requestedSubdomain;
  
  if (subdomain) {
    // User is requesting a specific subdomain
    if (!hasPaidAccess) {
      // Free users can only reuse domains within their limit
      if (userDomains.length >= planLimits.domains && !userDomains.find(d => d.subdomain === subdomain)) {
        ws.close(1008, `Domain limit reached (${planLimits.domains}). Upgrade for more.`);
        return;
      }
    }

    const existingDomain = await db.query.domains.findFirst({
      where: eq(domains.subdomain, subdomain),
    });

    if (existingDomain) {
      if (existingDomain.userId !== user.id) {
        ws.close(1008, "Subdomain is already taken by another user");
        return;
      }
      if (isSubdomainTaken(subdomain)) {
        ws.close(1008, "Subdomain is currently active in another session");
        return;
      }
    } else {
      // Creating a new domain
      if (userDomains.length >= planLimits.domains) {
        ws.close(1008, `Domain limit reached (${userDomains.length}/${planLimits.domains}). Upgrade for more.`);
        return;
      }
      try {
        await db.insert(domains).values({ subdomain, userId: user.id });
      } catch {
        ws.close(1008, "Failed to claim subdomain");
        return;
      }
    }
  } else {
    // Generating a new random subdomain
    // Check domain limit first
    if (userDomains.length >= planLimits.domains) {
      // Users at domain limit should reuse their first domain
      subdomain = userDomains[0]!.subdomain;
      if (isSubdomainTaken(subdomain)) {
        ws.close(1008, `Your domain is currently active in another session. Limit: ${planLimits.domains} domain(s).`);
        return;
      }
    } else {
      // Create new random subdomain (paid users or free users with no domain yet)
      subdomain = getRandomName();
      while (await db.query.domains.findFirst({ where: eq(domains.subdomain, subdomain) })) {
        subdomain = getRandomName();
      }
      await db.insert(domains).values({ subdomain, userId: user.id });
    }
  }
  
  registerTunnel(subdomain, ws, user.id, hasPaidAccess); 
  
  const heartbeat = setInterval(() => {
    if (ws.readyState === ws.OPEN) {
      ws.ping();
    } else {
      clearInterval(heartbeat);
    }
  }, 30000);

  ws.on("pong", () => {});
  
  ws.on("message", (data) => {
    try {
      handleTunnelMessage(data.toString(), user.id, hasPaidAccess);
    } catch (err) {
      console.warn("Error handling tunnel message:", err);
    }
  });

  ws.send(JSON.stringify({ type: "init", subdomain }));
  console.log(`[Knrog] New Tunnel: ${subdomain} (User: ${user.email}, Paid: ${hasPaidAccess})`);

  ws.on("close", () => {
    clearInterval(heartbeat);
    removeTunnel(subdomain);
    console.log(`[Knrog] Closed: ${subdomain}`);
  });
});
