import express from "express";
import cors from "cors";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { createServer } from "http";
import net from "net";
import { WebSocketServer } from "ws";
import {
  handleIncomingRequest,
  handleIncomingWebSocket,
  handleInternalTunnelHttpRequest,
  handleInternalTunnelWebSocket,
  handleTunnelMessage,
} from "./router";
import {
  isSubdomainTaken,
  registerTunnel,
  removeTunnel,
  getConnectionCount,
} from "./registry";
import { getRandomName } from "./utils/randomnames";
import { db } from "./db";
import { users, domains, PLAN_LIMITS } from "./db/schema";
import { eq } from "drizzle-orm";
import { parse } from "url";
import { randomUUID } from "crypto";
import authRouter from "./api/auth";
import domainsRouter from "./api/domains";
import billingRouter from "./api/billing";
import { checkUserLimits, getUserPlan } from "./api/billing";
import { runMigrations } from "./db/migrate";
import {
  API_DOMAIN,
  FRONTEND_URL,
  FRONTEND_URL_DEV,
  INTERNAL_SHARED_SECRET,
  INSTANCE_ID,
  SERVER_PORT,
  TCP_TUNNEL_HOST,
  TCP_TUNNEL_PORT_END,
  TCP_TUNNEL_PORT_START,
  TUNNEL_BASE_DOMAIN,
  buildTcpTunnelUrl,
  buildTunnelUrl,
  isMainHost,
} from "./config";
import {
  cleanupStaleActiveTunnels,
  removeActiveTunnel,
  touchActiveTunnel,
  upsertActiveTunnel,
} from "./state/activeTunnels";
import { cleanupExpiredCliSessions } from "./state/cliSessions";
import {
  cleanupStaleActiveTcpTunnels,
  getActiveTcpTunnel,
  removeActiveTcpTunnel,
  touchActiveTcpTunnel,
  upsertActiveTcpTunnel,
} from "./state/activeTcpTunnels";
import {
  getTcpConnectionCount,
  isTcpPortTaken,
  registerTcpTunnel,
  removeTcpTunnel,
} from "./tcpRegistry";
import { handleIncomingTcpConnection, handleInternalTcpRelay } from "./tcpGateway";

const app = express();
app.set("trust proxy", 1);

app.use(
  helmet({
    contentSecurityPolicy: false,
  })
);

app.use(
  cors({
    origin: [
      FRONTEND_URL,
      FRONTEND_URL_DEV,
      `https://${TUNNEL_BASE_DOMAIN}`,
      `https://app.${TUNNEL_BASE_DOMAIN}`,
      `https://${API_DOMAIN}`,
      "http://localhost:5173",
    ],
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true,
  })
);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 50,
  message: { error: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const cliSessionLimiter = rateLimit({
  windowMs: 5 * 60 * 1000,
  max: 100,
  message: { error: "Too many attempts. Please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

const isTcpPortInRange = (port: number) =>
  Number.isInteger(port) &&
  port >= TCP_TUNNEL_PORT_START &&
  port <= TCP_TUNNEL_PORT_END;

const allocateTcpPublicPort = async (requestedPort?: number) => {
  const isPortAvailable = async (port: number) => {
    if (!isTcpPortInRange(port) || isTcpPortTaken(port)) {
      return false;
    }

    const activeTunnel = await getActiveTcpTunnel(port);
    return !activeTunnel;
  };

  if (requestedPort !== undefined) {
    return (await isPortAvailable(requestedPort)) ? requestedPort : null;
  }

  for (let port = TCP_TUNNEL_PORT_START; port <= TCP_TUNNEL_PORT_END; port += 1) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }

  return null;
};

// Internal relay endpoint needs the raw bytes, not JSON decoding.
app.use(
  "/_internal/tunnel/http",
  express.raw({ type: "*/*", limit: "50mb" })
);
app.use(express.json());

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    instanceId: INSTANCE_ID,
    tunnelBaseDomain: TUNNEL_BASE_DOMAIN,
    timestamp: new Date().toISOString(),
  });
});

app.get("/", (req, res) => {
  const host = (req.headers.host || "").split(":")[0];
  if (host === API_DOMAIN) {
    return res.json({
      name: "Knrog API",
      version: "2.0.0",
      status: "running",
      tunnelBaseDomain: TUNNEL_BASE_DOMAIN,
      endpoints: {
        auth: "/api/auth",
        domains: "/api/domains",
        billing: "/api/billing",
        health: "/api/health",
      },
    });
  }

  res.json({
    message: "Knrog Tunnel Service",
    status: "running",
    api: `https://${API_DOMAIN}`,
    app: `https://app.${TUNNEL_BASE_DOMAIN}`,
    tunnels: `*.${TUNNEL_BASE_DOMAIN}`,
  });
});

app.use("/api/auth/cli-session", cliSessionLimiter);
app.use("/api/auth/validate", cliSessionLimiter);
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/domains", domainsRouter);
app.use("/api/billing", billingRouter);
app.post("/_internal/tunnel/http", handleInternalTunnelHttpRequest);

app.use(async (req, res, next) => {
  const host = (req.headers.host || "").split(":")[0];
  if (!host || isMainHost(host)) {
    next();
    return;
  }

  await handleIncomingRequest(req, res);
});

const startServer = async () => {
  await runMigrations();
  await cleanupExpiredCliSessions();
  await cleanupStaleActiveTunnels();
  await cleanupStaleActiveTcpTunnels();

  const server = createServer(app);
  const agentWss = new WebSocketServer({ noServer: true });
  const publicWss = new WebSocketServer({ noServer: true });
  const internalWss = new WebSocketServer({ noServer: true });
  const tcpServers: net.Server[] = [];

  agentWss.on("connection", async (ws, req) => {
    const { query } = parse(req.url || "", true);
    const apiKey =
      (query.apiKey as string) || (req.headers["x-api-key"] as string);
    const requestedSubdomain = query.subdomain as string | undefined;
    const requestedPublicPort = query.publicPort
      ? Number(query.publicPort)
      : undefined;
    const mode = query.mode === "tcp" ? "tcp" : "http";

    if (!apiKey) {
      ws.close(1008, "API Key required");
      return;
    }

    const user = await db.query.users.findFirst({
      where: eq(users.apiKey, apiKey),
    });

    if (!user) {
      ws.close(1008, "Invalid API Key");
      return;
    }

    if (!user.emailVerified) {
      ws.close(1008, "Verify your email before opening tunnels");
      return;
    }

    const { plan } = await getUserPlan(user.id);
    const planLimits = PLAN_LIMITS[plan];
    const activeConnections =
      getConnectionCount(user.id) + getTcpConnectionCount(user.id);

    if (activeConnections >= planLimits.connections) {
      ws.close(
        1008,
        `Connection limit reached (${planLimits.connections}). Upgrade for more.`
      );
      return;
    }

    const { withinLimits, reason } = await checkUserLimits(user.id);
    if (!withinLimits) {
      ws.close(1008, reason || "Usage limit exceeded");
      return;
    }

    const hasPaidAccess = plan !== "free" || user.isPaid;

    if (mode === "tcp") {
      if (!hasPaidAccess) {
        ws.close(1008, "TCP tunnels require a paid plan");
        return;
      }

      if (requestedPublicPort !== undefined && !isTcpPortInRange(requestedPublicPort)) {
        ws.close(
          1008,
          `TCP port must be between ${TCP_TUNNEL_PORT_START} and ${TCP_TUNNEL_PORT_END}`
        );
        return;
      }

      const publicPort = await allocateTcpPublicPort(requestedPublicPort);
      if (publicPort === null) {
        ws.close(1008, "No TCP ports available right now");
        return;
      }

      const connectionId = randomUUID();
      registerTcpTunnel(publicPort, ws, user.id, connectionId);
      await upsertActiveTcpTunnel(publicPort, user.id, connectionId);

      const heartbeat = setInterval(async () => {
        if (ws.readyState === ws.OPEN) {
          ws.ping();
          await touchActiveTcpTunnel(publicPort);
        } else {
          clearInterval(heartbeat);
        }
      }, 30000);

      ws.on("message", async (data) => {
        try {
          await handleTunnelMessage(data.toString());
        } catch (error) {
          console.warn("Error handling tunnel message:", error);
        }
      });

      ws.send(
        JSON.stringify({
          type: "init",
          mode: "tcp",
          publicPort,
          publicUrl: buildTcpTunnelUrl(publicPort),
        })
      );

      ws.on("close", async () => {
        clearInterval(heartbeat);
        removeTcpTunnel(publicPort);
        await removeActiveTcpTunnel(publicPort);
      });

      return;
    }

    const userDomains = await db.query.domains.findMany({
      where: eq(domains.userId, user.id),
      orderBy: (table, { asc }) => [asc(table.createdAt)],
    });

    let subdomain = requestedSubdomain;
    if (subdomain) {
      if (!hasPaidAccess && userDomains.length >= planLimits.domains) {
        const ownsRequested = userDomains.some((domain) => domain.subdomain === subdomain);
        if (!ownsRequested) {
          ws.close(
            1008,
            `Domain limit reached (${planLimits.domains}). Upgrade for more.`
          );
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
        if (userDomains.length >= planLimits.domains) {
          ws.close(
            1008,
            `Domain limit reached (${userDomains.length}/${planLimits.domains}). Upgrade for more.`
          );
          return;
        }

        await db.insert(domains).values({ subdomain, userId: user.id });
      }
    } else if (userDomains.length >= planLimits.domains) {
      subdomain = userDomains[0]!.subdomain;
      if (isSubdomainTaken(subdomain)) {
        ws.close(
          1008,
          `Your domain is currently active in another session. Limit: ${planLimits.domains} domain(s).`
        );
        return;
      }
    } else {
      subdomain = getRandomName();
      while (
        await db.query.domains.findFirst({ where: eq(domains.subdomain, subdomain) })
      ) {
        subdomain = getRandomName();
      }
      await db.insert(domains).values({ subdomain, userId: user.id });
    }

    const connectionId = randomUUID();
    registerTunnel(subdomain, ws, user.id, connectionId, hasPaidAccess);
    await upsertActiveTunnel(subdomain, user.id, connectionId);

    const heartbeat = setInterval(async () => {
      if (ws.readyState === ws.OPEN) {
        ws.ping();
        await touchActiveTunnel(subdomain);
      } else {
        clearInterval(heartbeat);
      }
    }, 30000);

    ws.on("message", async (data) => {
      try {
        await handleTunnelMessage(data.toString());
      } catch (error) {
        console.warn("Error handling tunnel message:", error);
      }
    });

    ws.send(
      JSON.stringify({
        type: "init",
        subdomain,
        publicUrl: buildTunnelUrl(subdomain),
        baseDomain: TUNNEL_BASE_DOMAIN,
      })
    );

    ws.on("close", async () => {
      clearInterval(heartbeat);
      removeTunnel(subdomain);
      await removeActiveTunnel(subdomain);
    });
  });

  publicWss.on("connection", (ws, req) => {
    void handleIncomingWebSocket(ws, req);
  });

  internalWss.on("connection", (ws, req) => {
    if (req.headers["x-knrog-internal-mode"] === "tcp") {
      if (req.headers["x-knrog-internal-secret"] !== INTERNAL_SHARED_SECRET) {
        ws.close(1008, "Unauthorized");
        return;
      }
      const publicPort = Number(req.headers["x-knrog-public-port"]);
      if (!Number.isFinite(publicPort)) {
        ws.close(1008, "Invalid TCP relay port");
        return;
      }
      handleInternalTcpRelay(ws, publicPort);
      return;
    }

    handleInternalTunnelWebSocket(ws, req);
  });

  server.on("upgrade", (req, socket, head) => {
    const host = ((req.headers.host || "").split(":")[0] || "").toLowerCase();
    const pathname = new URL(req.url || "/", "http://knrog.local").pathname;
    const isInternalWs = pathname === "/_internal/tunnel/ws";
    const hasAgentKey =
      new URL(req.url || "/", "http://knrog.local").searchParams.has("apiKey") ||
      Boolean(req.headers["x-api-key"]);

    if (isInternalWs) {
      internalWss.handleUpgrade(req, socket, head, (ws) => {
        internalWss.emit("connection", ws, req);
      });
      return;
    }

    if (host === API_DOMAIN || host.startsWith("localhost") || hasAgentKey) {
      agentWss.handleUpgrade(req, socket, head, (ws) => {
        agentWss.emit("connection", ws, req);
      });
      return;
    }

    if (!isMainHost(host)) {
      publicWss.handleUpgrade(req, socket, head, (ws) => {
        publicWss.emit("connection", ws, req);
      });
      return;
    }

    socket.destroy();
  });

  setInterval(() => {
    void cleanupExpiredCliSessions();
    void cleanupStaleActiveTunnels();
    void cleanupStaleActiveTcpTunnels();
  }, 60_000);

  for (let port = TCP_TUNNEL_PORT_START; port <= TCP_TUNNEL_PORT_END; port += 1) {
    const tcpServer = net.createServer((socket) => {
      void handleIncomingTcpConnection(socket, port);
    });
    tcpServer.listen(port, TCP_TUNNEL_HOST);
    tcpServers.push(tcpServer);
  }

  server.listen(SERVER_PORT, () => {
    console.log(`Knrog Server running on port ${SERVER_PORT}`);
  });
};

startServer().catch((error) => {
  console.error("Failed to start server:", error);
  process.exit(1);
});
