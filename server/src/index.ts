import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { WebSocketServer } from "ws";
import { handleIncomingRequest, handleTunnelMessage } from "./router";
import { isSubdomainTaken, registerTunnel, removeTunnel, getConnectionCount } from "./registry";
import { getRandomName } from "./utils/randomnames";
import { db } from "./db";
import { users, domains } from "./db/schema";
import { eq } from "drizzle-orm";
import { parse } from "url";
import authRouter from "./api/auth";
import domainsRouter from "./api/domains";

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

// Create HTTP server from Express
const server = app.listen(PORT, () => {
  console.log(`Knrog Server running on port ${PORT}`);
});

// Handle subdomain-based tunnel requests
app.use((req, res, next) => {
  const host = req.headers.host || "";
  const isRoot = host === DOMAIN || host.startsWith("localhost");
  
  if (!isRoot) {
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

  // Enforce Connection Limit FIRST (before creating subdomain)
  const activeConnections = getConnectionCount(user.id);
  const CONNECTION_LIMIT = user.isPaid ? Infinity : 5;

  if (activeConnections >= CONNECTION_LIMIT) {
    ws.close(1008, "Connection limit reached. Upgrade for more.");
    return;
  }

  // Check if user has paid-tier access
  const SPECIAL_EMAILS = ["amaechinaikechukwu6@gmail.com"];
  const hasPaidAccess = user.isPaid || SPECIAL_EMAILS.includes(user.email);

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
      // Free users can only reuse their FIRST domain
      if (userDomains.length > 0 && subdomain !== userDomains[0]!.subdomain) {
        ws.close(1008, "Free tier: You can only use your first domain. Upgrade for more.");
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
      if (!hasPaidAccess && userDomains.length >= 1) {
        ws.close(1008, "Free tier: Domain limit reached (1/1). Upgrade for unlimited domains.");
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
    // Free users: can only have 1 domain, so check limit first
    if (!hasPaidAccess && userDomains.length >= 1) {
      // Free users with existing domain should reuse it
      subdomain = userDomains[0]!.subdomain;
      if (isSubdomainTaken(subdomain)) {
        ws.close(1008, "Your domain is currently active in another session. Free tier allows 1 domain.");
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
