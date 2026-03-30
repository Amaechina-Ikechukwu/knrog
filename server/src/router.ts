import { randomUUID } from "crypto";
import { IncomingMessage, ServerResponse } from "http";
import type { OutgoingHttpHeaders } from "http";
import { WebSocket } from "ws";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import {
  getTunnelIsPaid,
  getTunnelSocket,
  getTunnelUserId,
  isSubdomainTaken,
} from "./registry";
import { logDomainRequest } from "./api/domains";
import { trackUsage } from "./api/billing";
import { getClientIP, isBlockedRequest, trackSuspiciousIP } from "./utils/security";
import { getActiveTunnel } from "./state/activeTunnels";
import { INSTANCE_ID, INTERNAL_SHARED_SECRET } from "./config";
import { db } from "./db";
import { domains } from "./db/schema";
import { handleTcpTunnelMessage, isTcpTunnelMessage } from "./tcpGateway";

type TunnelMessage =
  | { type: "request"; id: string; method?: string; url?: string; headers?: Record<string, unknown> }
  | { type: "req_data"; id: string; chunk: string }
  | { type: "req_end"; id: string }
  | { type: "res_headers"; id: string; statusCode: number; headers?: Record<string, unknown> }
  | { type: "res_data"; id: string; chunk: string }
  | { type: "res_end"; id: string }
  | { type: "error"; id: string; message: string }
  | { type: "ws_open"; id: string; url?: string; headers?: Record<string, unknown> }
  | { type: "ws_open_ack"; id: string }
  | { type: "ws_open_error"; id: string; message: string }
  | { type: "ws_message"; id: string; chunk: string; isBinary?: boolean }
  | { type: "ws_close"; id: string; code?: number; reason?: string }
  | { type: "tcp_open"; id: string }
  | { type: "tcp_data"; id: string; chunk: string }
  | { type: "tcp_end"; id: string }
  | { type: "tcp_error"; id: string; message: string };

type RequestMetadata = {
  subdomain: string;
  userId: string;
  isPaid: boolean;
  method: string;
  path: string;
  startTime: number;
  bytesIn: number;
  bytesOut: number;
  statusCode?: number;
  requestHeaders?: Record<string, unknown>;
  responseHeaders?: Record<string, unknown>;
  requestBody?: string;
  responseBody?: string;
  errorMessage?: string;
};

type TunnelTarget =
  | { kind: "local" }
  | { kind: "remote"; instanceUrl: string }
  | { kind: "missing" };

const CAPTURE_LIMIT = 16 * 1024;
const INTERNAL_HTTP_PATH = "/_internal/tunnel/http";
const INTERNAL_WS_PATH = "/_internal/tunnel/ws";

const responses = new Map<string, ServerResponse>();
const timeouts = new Map<string, NodeJS.Timeout>();
const requestMetadata = new Map<string, RequestMetadata>();
const websocketConnections = new Map<string, WebSocket>();
const websocketUsage = new Map<
  string,
  {
    subdomain: string;
    userId: string;
    isPaid: boolean;
    startedAt: number;
    bytesIn: number;
    bytesOut: number;
  }
>();

const sanitizeForwardHeaders = (headers: Record<string, unknown>) => {
  const cleanHeaders = { ...headers };
  delete cleanHeaders.connection;
  delete cleanHeaders.upgrade;
  delete cleanHeaders.host;
  return cleanHeaders;
};

const toOutgoingHeaders = (
  headers: Record<string, unknown> = {}
): OutgoingHttpHeaders => {
  const outgoing: OutgoingHttpHeaders = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string" || Array.isArray(value) || typeof value === "number") {
      outgoing[key] = value as string | string[] | number;
    }
  }
  return outgoing;
};

const decodeInternalHeaders = (encoded?: string | null) => {
  if (!encoded) {
    return {};
  }

  try {
    return JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as Record<
      string,
      unknown
    >;
  } catch {
    return {};
  }
};

const captureText = (current: string | undefined, chunk: Buffer) => {
  if ((current?.length ?? 0) >= CAPTURE_LIMIT) {
    return current;
  }

  const remaining = CAPTURE_LIMIT - (current?.length ?? 0);
  const nextChunk = chunk.subarray(0, remaining).toString("utf8");
  return `${current ?? ""}${nextChunk}`;
};

const sendToTunnel = (subdomain: string, payload: TunnelMessage) => {
  const socket = getTunnelSocket(subdomain);
  if (!socket || socket.readyState !== WebSocket.OPEN) {
    return false;
  }

  socket.send(JSON.stringify(payload));
  return true;
};

const finalizeUsage = async (metadata: RequestMetadata) => {
  if (!metadata.isPaid) {
    return;
  }

  await trackUsage(metadata.userId, metadata.bytesIn + metadata.bytesOut);
};

const finalizeRequest = async (
  id: string,
  fallback?: { statusCode?: number; errorMessage?: string }
) => {
  const metadata = requestMetadata.get(id);
  if (!metadata) {
    return;
  }

  if (fallback?.statusCode && metadata.statusCode === undefined) {
    metadata.statusCode = fallback.statusCode;
  }
  if (fallback?.errorMessage && !metadata.errorMessage) {
    metadata.errorMessage = fallback.errorMessage;
  }

  const responseTime = Date.now() - metadata.startTime;
  await finalizeUsage(metadata);

  if (metadata.isPaid) {
    await logDomainRequest({
      subdomain: metadata.subdomain,
      userId: metadata.userId,
      method: metadata.method,
      path: metadata.path,
      statusCode: metadata.statusCode ?? null,
      responseTime,
      bytesIn: metadata.bytesIn,
      bytesOut: metadata.bytesOut,
      requestHeaders: metadata.requestHeaders,
      responseHeaders: metadata.responseHeaders,
      requestBody: metadata.requestBody,
      responseBody: metadata.responseBody,
      errorMessage: metadata.errorMessage,
    });
  }

  requestMetadata.delete(id);
};

const resolveTunnelTarget = async (subdomain: string): Promise<TunnelTarget> => {
  if (isSubdomainTaken(subdomain)) {
    return { kind: "local" };
  }

  const activeTunnel = await getActiveTunnel(subdomain);
  if (!activeTunnel) {
    return { kind: "missing" };
  }

  if (activeTunnel.instanceId === INSTANCE_ID) {
    return { kind: "local" };
  }

  return { kind: "remote", instanceUrl: activeTunnel.instanceUrl };
};

const passesDomainAccessControl = async (subdomain: string, req: IncomingMessage) => {
  const domain = await db.query.domains.findFirst({
    where: eq(domains.subdomain, subdomain),
    columns: {
      accessToken: true,
      basicAuthUsername: true,
      basicAuthPasswordHash: true,
    },
  });

  if (!domain) {
    return true;
  }

  if (domain.accessToken) {
    const providedToken =
      (req.headers["x-knrog-token"] as string) ||
      new URL(req.url || "/", "http://knrog.local").searchParams.get("knrogToken");

    if (providedToken !== domain.accessToken) {
      return false;
    }
  }

  if (domain.basicAuthUsername && domain.basicAuthPasswordHash) {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Basic ")) {
      return false;
    }

    const decoded = Buffer.from(authHeader.slice(6), "base64").toString("utf8");
    const [username, password] = decoded.split(":");
    if (username !== domain.basicAuthUsername) {
      return false;
    }

    const passwordMatches = await bcrypt.compare(
      password || "",
      domain.basicAuthPasswordHash
    );
    if (!passwordMatches) {
      return false;
    }
  }

  return true;
};

const forwardBufferedRequest = async (
  subdomain: string,
  method: string,
  url: string,
  headers: Record<string, unknown>,
  body: Buffer,
  res: ServerResponse
) => {
  const socket = getTunnelSocket(subdomain);
  const userId = getTunnelUserId(subdomain);
  const isPaid = getTunnelIsPaid(subdomain);

  if (!socket || !userId) {
    res.writeHead(404);
    res.end(`Knrog Error: No tunnel found for ${subdomain}`);
    return;
  }

  const id = randomUUID();
  const metadata: RequestMetadata = {
    subdomain,
    userId,
    isPaid,
    method,
    path: url,
    startTime: Date.now(),
    bytesIn: body.length,
    bytesOut: 0,
    requestHeaders: headers,
    requestBody: body.length > 0 ? captureText(undefined, body) : undefined,
  };

  responses.set(id, res);
  requestMetadata.set(id, metadata);

  const timeout = setTimeout(async () => {
    if (!responses.has(id)) {
      return;
    }

    res.writeHead(504);
    res.end("Gateway Timeout: Local tunnel took too long to respond.");
    responses.delete(id);
    timeouts.delete(id);
    await finalizeRequest(id, {
      statusCode: 504,
      errorMessage: "Gateway Timeout: Local tunnel took too long to respond.",
    });
  }, 30000);

  timeouts.set(id, timeout);

  socket.send(
    JSON.stringify({
      type: "request",
      id,
      method,
      url,
      headers,
    } satisfies TunnelMessage)
  );

  if (body.length > 0) {
    socket.send(
      JSON.stringify({
        type: "req_data",
        id,
        chunk: body.toString("base64"),
      } satisfies TunnelMessage)
    );
  }

  socket.send(JSON.stringify({ type: "req_end", id } satisfies TunnelMessage));
};

const bufferRequest = async (req: IncomingMessage) => {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  return Buffer.concat(chunks);
};

const proxyToRemoteInstance = async (
  req: IncomingMessage,
  res: ServerResponse,
  subdomain: string,
  instanceUrl: string
) => {
  const body = await bufferRequest(req);
  const response = await fetch(`${instanceUrl}${INTERNAL_HTTP_PATH}`, {
    method: req.method,
    headers: {
      "content-type": (req.headers["content-type"] as string) || "application/octet-stream",
      "x-knrog-internal-secret": INTERNAL_SHARED_SECRET,
      "x-knrog-subdomain": subdomain,
      "x-knrog-url": req.url || "/",
      "x-knrog-method": req.method || "GET",
      "x-knrog-headers": Buffer.from(
        JSON.stringify(sanitizeForwardHeaders(req.headers as Record<string, unknown>))
      ).toString("base64url"),
    },
    body,
  });

  const responseBuffer = Buffer.from(await response.arrayBuffer());
  const headers = Object.fromEntries(response.headers.entries());
  res.writeHead(response.status, headers);
  res.end(responseBuffer);
};

const registerWebSocketBridge = (
  ws: WebSocket,
  subdomain: string,
  requestUrl: string,
  requestHeaders: Record<string, unknown>
) => {
  const socket = getTunnelSocket(subdomain);
  const userId = getTunnelUserId(subdomain);
  const isPaid = getTunnelIsPaid(subdomain);

  if (!socket || !userId) {
    ws.close(1011, "Tunnel unavailable");
    return;
  }

  const id = randomUUID();
  websocketConnections.set(id, ws);
  websocketUsage.set(id, {
    subdomain,
    userId,
    isPaid,
    startedAt: Date.now(),
    bytesIn: 0,
    bytesOut: 0,
  });

  socket.send(
    JSON.stringify({
      type: "ws_open",
      id,
      url: requestUrl,
      headers: sanitizeForwardHeaders(requestHeaders),
    } satisfies TunnelMessage)
  );

  ws.on("message", (data, isBinary) => {
    const usage = websocketUsage.get(id);
    if (usage) {
      usage.bytesIn += Buffer.byteLength(data as Buffer);
    }

    sendToTunnel(subdomain, {
      type: "ws_message",
      id,
      chunk: Buffer.from(data as Buffer).toString("base64"),
      isBinary,
    });
  });

  ws.on("close", async (code, reason) => {
    sendToTunnel(subdomain, {
      type: "ws_close",
      id,
      code,
      reason: reason.toString(),
    });

    const usage = websocketUsage.get(id);
    websocketUsage.delete(id);
    websocketConnections.delete(id);

    if (usage?.isPaid) {
      await trackUsage(usage.userId, usage.bytesIn + usage.bytesOut);
      await logDomainRequest({
        subdomain: usage.subdomain,
        userId: usage.userId,
        method: "WS",
        path: requestUrl,
        statusCode: 101,
        responseTime: Date.now() - usage.startedAt,
        bytesIn: usage.bytesIn,
        bytesOut: usage.bytesOut,
        requestHeaders,
        responseHeaders: undefined,
        requestBody: undefined,
        responseBody: undefined,
        errorMessage: reason.toString() || null,
      });
    }
  });
};

const bridgeRemoteWebSocket = async (
  publicWs: WebSocket,
  subdomain: string,
  requestUrl: string,
  requestHeaders: Record<string, unknown>,
  instanceUrl: string
) => {
  const remoteWs = new WebSocket(
    `${instanceUrl.replace(/^http/i, "ws")}${INTERNAL_WS_PATH}`,
    {
      headers: {
        "x-knrog-internal-secret": INTERNAL_SHARED_SECRET,
        "x-knrog-subdomain": subdomain,
        "x-knrog-url": requestUrl,
        "x-knrog-headers": Buffer.from(JSON.stringify(requestHeaders)).toString(
          "base64url"
        ),
      },
    }
  );

  remoteWs.on("message", (data, isBinary) => {
    if (publicWs.readyState === WebSocket.OPEN) {
      publicWs.send(data, { binary: isBinary });
    }
  });

  publicWs.on("message", (data, isBinary) => {
    if (remoteWs.readyState === WebSocket.OPEN) {
      remoteWs.send(data, { binary: isBinary });
    }
  });

  const closeBoth = (code?: number, reason?: string) => {
    if (publicWs.readyState === WebSocket.OPEN || publicWs.readyState === WebSocket.CONNECTING) {
      publicWs.close(code, reason);
    }
    if (remoteWs.readyState === WebSocket.OPEN || remoteWs.readyState === WebSocket.CONNECTING) {
      remoteWs.close(code, reason);
    }
  };

  publicWs.on("close", (code, reason) => closeBoth(code, reason.toString()));
  remoteWs.on("close", (code, reason) => closeBoth(code, reason.toString()));
  publicWs.on("error", () => closeBoth(1011, "Public websocket bridge failed"));
  remoteWs.on("error", () => closeBoth(1011, "Remote websocket bridge failed"));
};

export const handleIncomingRequest = async (
  req: IncomingMessage,
  res: ServerResponse
) => {
  if (isBlockedRequest(req)) {
    res.writeHead(403, { "Content-Type": "text/plain" });
    res.end("Forbidden");
    return;
  }

  const clientIP = getClientIP(req);
  if (trackSuspiciousIP(clientIP)) {
    res.writeHead(429, { "Content-Type": "text/plain" });
    res.end("Too Many Requests");
    return;
  }

  const host = req.headers.host || "";
  const subdomain = host.split(".")[0] || "";
  if (!(await passesDomainAccessControl(subdomain, req))) {
    res.writeHead(401, {
      "Content-Type": "text/plain",
      "WWW-Authenticate": 'Basic realm="Knrog"',
    });
    res.end("Unauthorized");
    return;
  }
  const target = await resolveTunnelTarget(subdomain);

  if (target.kind === "missing") {
    res.writeHead(404);
    res.end(`Knrog Error: No tunnel found for ${subdomain}`);
    return;
  }

  if (target.kind === "remote") {
    await proxyToRemoteInstance(req, res, subdomain, target.instanceUrl);
    return;
  }

  const body = await bufferRequest(req);
  await forwardBufferedRequest(
    subdomain,
    req.method || "GET",
    req.url || "/",
    sanitizeForwardHeaders(req.headers as Record<string, unknown>),
    body,
    res
  );
};

export const handleInternalTunnelHttpRequest = async (
  req: IncomingMessage & { body?: Buffer },
  res: ServerResponse
) => {
  if (req.headers["x-knrog-internal-secret"] !== INTERNAL_SHARED_SECRET) {
    res.writeHead(401);
    res.end("Unauthorized");
    return;
  }

  const subdomain = (req.headers["x-knrog-subdomain"] as string) || "";
  const url = (req.headers["x-knrog-url"] as string) || "/";
  const method = (req.headers["x-knrog-method"] as string) || "GET";
  const headers = decodeInternalHeaders(req.headers["x-knrog-headers"] as string);
  const body = Buffer.isBuffer(req.body) ? req.body : Buffer.alloc(0);

  await forwardBufferedRequest(subdomain, method, url, headers, body, res);
};

export const handleIncomingWebSocket = async (
  ws: WebSocket,
  req: IncomingMessage
) => {
  const host = req.headers.host || "";
  const subdomain = host.split(".")[0] || "";
  const requestUrl = req.url || "/";
  if (!(await passesDomainAccessControl(subdomain, req))) {
    ws.close(1008, "Unauthorized");
    return;
  }
  const target = await resolveTunnelTarget(subdomain);

  if (target.kind === "missing") {
    ws.close(1011, "No tunnel found");
    return;
  }

  if (target.kind === "remote") {
    await bridgeRemoteWebSocket(
      ws,
      subdomain,
      requestUrl,
      req.headers as Record<string, unknown>,
      target.instanceUrl
    );
    return;
  }

  registerWebSocketBridge(ws, subdomain, requestUrl, req.headers as Record<string, unknown>);
};

export const handleInternalTunnelWebSocket = (ws: WebSocket, req: IncomingMessage) => {
  if (req.headers["x-knrog-internal-secret"] !== INTERNAL_SHARED_SECRET) {
    ws.close(1008, "Unauthorized");
    return;
  }

  const subdomain = (req.headers["x-knrog-subdomain"] as string) || "";
  const requestUrl = (req.headers["x-knrog-url"] as string) || "/";
  const headers = decodeInternalHeaders(req.headers["x-knrog-headers"] as string);
  registerWebSocketBridge(ws, subdomain, requestUrl, headers);
};

export const handleTunnelMessage = async (raw: string) => {
  let msg: TunnelMessage;
  try {
    msg = JSON.parse(raw) as TunnelMessage;
  } catch {
    console.warn("Malformed tunnel message");
    return;
  }

  const id = (msg as { id?: string }).id;
  if (!id) {
    return;
  }

  const res = responses.get(id);
  const ws = websocketConnections.get(id);

  if (isTcpTunnelMessage(msg)) {
    await handleTcpTunnelMessage(msg);
    return;
  }

  switch (msg.type) {
    case "res_headers": {
      if (!res) {
        return;
      }

      const statusCode = msg.statusCode ?? 200;
      const headers = msg.headers ?? {};
      res.writeHead(statusCode, toOutgoingHeaders(headers));

      const metadata = requestMetadata.get(id);
      if (metadata) {
        metadata.statusCode = statusCode;
        metadata.responseHeaders = headers;
      }
      break;
    }

    case "res_data": {
      if (!res) {
        return;
      }

      const chunk = Buffer.from(msg.chunk, "base64");
      res.write(chunk);

      const metadata = requestMetadata.get(id);
      if (metadata) {
        metadata.bytesOut += chunk.length;
        metadata.responseBody = captureText(metadata.responseBody, chunk);
      }
      break;
    }

    case "res_end": {
      if (!res) {
        return;
      }

      res.end();
      responses.delete(id);

      const timeout = timeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        timeouts.delete(id);
      }

      await finalizeRequest(id);
      break;
    }

    case "error": {
      if (!res) {
        return;
      }

      res.writeHead(502);
      res.end(`Upstream error: ${msg.message}`);
      responses.delete(id);

      const timeout = timeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        timeouts.delete(id);
      }

      await finalizeRequest(id, {
        statusCode: 502,
        errorMessage: msg.message,
      });
      break;
    }

    case "ws_open_ack": {
      break;
    }

    case "ws_open_error": {
      if (ws) {
        ws.close(1011, msg.message);
      }
      websocketConnections.delete(id);
      websocketUsage.delete(id);
      break;
    }

    case "ws_message": {
      if (!ws || ws.readyState !== WebSocket.OPEN) {
        return;
      }

      const chunk = Buffer.from(msg.chunk, "base64");
      const usage = websocketUsage.get(id);
      if (usage) {
        usage.bytesOut += chunk.length;
      }
      ws.send(chunk, { binary: Boolean(msg.isBinary) });
      break;
    }

    case "ws_close": {
      if (ws && ws.readyState === WebSocket.OPEN) {
        ws.close(msg.code, msg.reason);
      }
      websocketConnections.delete(id);
      websocketUsage.delete(id);
      break;
    }

    default:
      break;
  }
};
