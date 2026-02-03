import { IncomingMessage, ServerResponse } from "http";
import { getTunnelSocket, getTunnelUserId, getTunnelIsPaid, getTunnelSubdomain } from "./registry";
import { v4 } from "uuid";
import { logDomainRequest } from "./api/domains";
import { isBlockedRequest, trackSuspiciousIP, getClientIP } from "./utils/security";

type TunnelMessage =
  | { type: "request"; id: string; method?: string; url?: string; headers?: any }
  | { type: "req_data"; id: string; chunk: string }
  | { type: "req_end"; id: string }
  | { type: "res_headers"; id: string; statusCode: number; headers: any }
  | { type: "res_data"; id: string; chunk: string }
  | { type: "res_end"; id: string }
  | { type: "error"; id: string; message: string };

const responses = new Map<string, ServerResponse>();
const timeouts = new Map<string, NodeJS.Timeout>();
// Track request metadata for logging
const requestMetadata = new Map<string, { 
  subdomain: string;
  userId: string;
  isPaid: boolean;
  method: string;
  path: string;
  startTime: number;
  statusCode?: number;
}>();

export const handleIncomingRequest = (
  req: IncomingMessage,
  res: ServerResponse
) => {
  // Security: Block malicious requests early
  if (isBlockedRequest(req)) {
    res.writeHead(403, { 'Content-Type': 'text/plain' });
    return res.end('Forbidden');
  }

  // Track suspicious IPs
  const clientIP = getClientIP(req);
  if (trackSuspiciousIP(clientIP)) {
    res.writeHead(429, { 'Content-Type': 'text/plain' });
    return res.end('Too Many Requests');
  }

  const host = req.headers.host || "";
  // Extract subdomain from formats like:
  // - 'subdomain.knrog.online' -> 'subdomain'
  // - 'subdomain.app.knrog.online' -> 'subdomain'
  const parts = host.split(".");
  const subdomain = parts[0] || "";
  console.log(`[Gateway] Incoming ${req.method} ${req.url} for subdomain: ${subdomain} (host: ${host})`);

  const socket = getTunnelSocket(subdomain);

  if (!socket) {
    res.writeHead(404);
    return res.end(`Knrog Error: No tunnel found for ${subdomain}`);
  }

  const id = v4();
  const userId = getTunnelUserId(subdomain);
  const isPaid = getTunnelIsPaid(subdomain);

  // Set id and store response
  responses.set(id, res);

  // Store request metadata for logging (paid users only)
  if (isPaid && userId) {
    requestMetadata.set(id, {
      subdomain,
      userId,
      isPaid,
      method: req.method || "GET",
      path: req.url || "/",
      startTime: Date.now(),
    });
  }

  const timeout = setTimeout(() => {
    if (responses.has(id)) {
      res.writeHead(504);
      res.end("Gateway Timeout: Local tunnel took too long to respond.");
      responses.delete(id);
      timeouts.delete(id);
      requestMetadata.delete(id);
    }
  }, 30000);

  timeouts.set(id, timeout);

  // Send the request details to the CLI client via WebSocket
  console.log(`[Gateway] Forwarding request ${id} to tunnel`);
  socket.send(
    JSON.stringify({
      type: "request",
      method: req.method,
      id,
      url: req.url,
      headers: req.headers,
    })
  );

  req.on("data", (chunk) => {
    socket.send(
      JSON.stringify({ type: "req_data", id, chunk: chunk.toString("base64") })
    );
  });

  req.on("end", () => {
    socket.send(JSON.stringify({ type: "req_end", id }));
  });
};

export const handleTunnelMessage = (raw: string, userId: string, isPaid: boolean) => {
  let msg: TunnelMessage;
  try {
    msg = JSON.parse(raw);
  } catch (err) {
    console.warn("Malformed tunnel message");
    return;
  }
  const id = (msg as any).id;
  const res = responses.get(id);

  switch (msg.type) {
    case "res_headers": {
      if (!res) {
        console.log(`[Gateway] WARNING: No response object for id ${id}`);
        return;
      }
      console.log(`[Gateway] Received res_headers for ${id}, status: ${(msg as any).statusCode}`);
      try {
        const statusCode = (msg as any).statusCode ?? 200;
        const headers = (msg as any).headers ?? {};
        res.writeHead(statusCode, headers);
        
        // Update metadata with status code
        const metadata = requestMetadata.get(id);
        if (metadata) {
          metadata.statusCode = statusCode;
        }
      } catch (err) {
        res.writeHead(502);
        res.end("Bad Gateway: Invalid upstream response headers");
        responses.delete(id);
        requestMetadata.delete(id);
        const timeout = timeouts.get(id);
        if (timeout) {
          clearTimeout(timeout);
          timeouts.delete(id);
        }
      }
      break;
    }
    case "res_data": {
      if (!res) return;
      const buf = Buffer.from(msg.chunk, "base64");
      res.write(buf);
      break;
    }
    case "res_end": {
      if (!res) return;
      res.end();
      responses.delete(id);

      // Log the request for paid users
      const metadata = requestMetadata.get(id);
      if (metadata && metadata.isPaid) {
        const responseTime = Date.now() - metadata.startTime;
        logDomainRequest(
          metadata.subdomain,
          metadata.userId,
          metadata.method,
          metadata.path,
          metadata.statusCode ?? null,
          responseTime
        );
      }
      requestMetadata.delete(id);

      const timeout = timeouts.get(id);
      if (timeout) {
        clearTimeout(timeout);
        timeouts.delete(id);
      }
      break;
    }
    case "error": {
      if (res) {
        res.writeHead(502);
        res.end("Upstream error: " + msg.message);
        responses.delete(id);
        
        // Log the error for paid users
        const metadata = requestMetadata.get(id);
        if (metadata && metadata.isPaid) {
          const responseTime = Date.now() - metadata.startTime;
          logDomainRequest(
            metadata.subdomain,
            metadata.userId,
            metadata.method,
            metadata.path,
            502,
            responseTime
          );
        }
        requestMetadata.delete(id);

        const timeout = timeouts.get(id);
        if (timeout) {
          clearTimeout(timeout);
          timeouts.delete(id);
        }
      }
      break;
    }
    default: {
      break;
    }
  }
};