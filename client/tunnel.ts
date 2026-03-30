import { WebSocket } from "ws";
import http from "http";
import net from "net";
import type { Config } from "./config.js";
import { saveConfig } from "./config.js";

export type TunnelMode = "http" | "tcp";

type ServerMessage =
  | {
      type: "init";
      mode?: TunnelMode;
      subdomain?: string;
      publicPort?: number;
      publicUrl?: string;
      baseDomain?: string;
    }
  | {
      type: "request";
      id: string;
      method?: string;
      url?: string;
      headers?: Record<string, unknown>;
    }
  | { type: "req_data"; id: string; chunk: string }
  | { type: "req_end"; id: string }
  | { type: "ws_open"; id: string; url?: string; headers?: Record<string, unknown> }
  | { type: "ws_message"; id: string; chunk: string; isBinary?: boolean }
  | { type: "ws_close"; id: string; code?: number; reason?: string }
  | { type: "tcp_open"; id: string }
  | { type: "tcp_data"; id: string; chunk: string }
  | { type: "tcp_end"; id: string }
  | { type: "tcp_error"; id: string; message: string };

const cleanHttpHeaders = (
  headers: Record<string, unknown> = {}
): Record<string, string | string[]> => {
  const cleanHeaders: Record<string, string | string[]> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string" || Array.isArray(value)) {
      cleanHeaders[key] = value;
    }
  }
  delete cleanHeaders.connection;
  delete cleanHeaders.upgrade;
  delete cleanHeaders.host;
  delete cleanHeaders["cf-ray"];
  delete cleanHeaders["cf-connecting-ip"];
  delete cleanHeaders["cf-ipcountry"];
  delete cleanHeaders["cf-visitor"];
  delete cleanHeaders["cdn-loop"];
  return cleanHeaders;
};

const cleanWebSocketHeaders = (
  headers: Record<string, unknown> = {}
): Record<string, string> => {
  const cleanHeaders: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === "string") {
      cleanHeaders[key] = value;
    }
  }
  delete cleanHeaders.connection;
  delete cleanHeaders.upgrade;
  delete cleanHeaders.host;
  delete cleanHeaders["cf-ray"];
  delete cleanHeaders["cf-connecting-ip"];
  delete cleanHeaders["cf-ipcountry"];
  delete cleanHeaders["cf-visitor"];
  delete cleanHeaders["cdn-loop"];
  return cleanHeaders;
};

export function startTunnel(
  mode: TunnelMode,
  localPort: number,
  serverUrl: string,
  apiKey: string,
  requestedSubdomainOrPort: string | number | undefined,
  config: Config
) {
  console.log(`[Knrog] Connecting to ${serverUrl}...`);
  console.log(`[Knrog] Forwarding to localhost:${localPort}`);

  let activeSubdomain =
    typeof requestedSubdomainOrPort === "string" ? requestedSubdomainOrPort : undefined;
  let activePublicPort =
    typeof requestedSubdomainOrPort === "number" ? requestedSubdomainOrPort : undefined;
  let reconnectAttempt = 0;
  let shutdownRequested = false;
  const pendingRequests = new Map<string, http.ClientRequest>();
  const pendingSockets = new Map<string, WebSocket>();
  const pendingTcpSockets = new Map<string, net.Socket>();
  let currentWs: WebSocket | null = null;

  const connect = () => {
    const query = new URLSearchParams({
      apiKey,
      mode,
    });
    if (activeSubdomain) {
      query.set("subdomain", activeSubdomain);
    }
    if (activePublicPort !== undefined) {
      query.set("publicPort", String(activePublicPort));
    }
    const wsUrl = `${serverUrl}?${query.toString()}`;

    const ws = new WebSocket(wsUrl);
    currentWs = ws;

    ws.on("open", () => {
      reconnectAttempt = 0;
    });

    ws.on("message", (data) => {
      const message = JSON.parse(data.toString()) as ServerMessage;

      if (message.type === "init") {
        if (message.subdomain) {
          activeSubdomain = message.subdomain;
          config.lastSubdomain = message.subdomain;
          saveConfig(config);
        }
        if (message.publicPort !== undefined) {
          activePublicPort = message.publicPort;
        }

        const fullUrl =
          message.publicUrl ||
          (message.subdomain
            ? `https://${message.subdomain}.${message.baseDomain || "knrog.online"}`
            : `tcp://localhost:${message.publicPort}`);

        console.log("[Knrog] Connected to server.");
        console.log("");
        console.log(`  Public URL: ${fullUrl}`);
        console.log(`  Forwarding: localhost:${localPort}`);
        console.log("");
        return;
      }

      if (message.type === "request") {
        const method = message.method || "GET";
        const url = message.url || "/";
        const localReq = http.request(
          {
            host: "localhost",
            port: localPort,
            method,
            path: url,
            headers: cleanHttpHeaders(message.headers),
          },
          (localRes) => {
            ws.send(
              JSON.stringify({
                type: "res_headers",
                id: message.id,
                statusCode: localRes.statusCode ?? 200,
                headers: localRes.headers,
              })
            );

            localRes.on("data", (chunk) => {
              ws.send(
                JSON.stringify({
                  type: "res_data",
                  id: message.id,
                  chunk: chunk.toString("base64"),
                })
              );
            });

            localRes.on("end", () => {
              ws.send(JSON.stringify({ type: "res_end", id: message.id }));
              pendingRequests.delete(message.id);
            });
          }
        );

        localReq.on("error", (error) => {
          ws.send(
            JSON.stringify({
              type: "error",
              id: message.id,
              message: error.message,
            })
          );
          pendingRequests.delete(message.id);
        });

        pendingRequests.set(message.id, localReq);
        if (method === "GET" || method === "HEAD") {
          localReq.end();
        }
        return;
      }

      if (message.type === "req_data") {
        const pendingReq = pendingRequests.get(message.id);
        if (pendingReq) {
          pendingReq.write(Buffer.from(message.chunk, "base64"));
        }
        return;
      }

      if (message.type === "req_end") {
        const pendingReq = pendingRequests.get(message.id);
        pendingReq?.end();
        return;
      }

      if (message.type === "ws_open") {
        const localSocket = new WebSocket(`ws://localhost:${localPort}${message.url || "/"}`, {
          headers: cleanWebSocketHeaders(message.headers),
        });
        pendingSockets.set(message.id, localSocket);

        localSocket.on("open", () => {
          ws.send(JSON.stringify({ type: "ws_open_ack", id: message.id }));
        });

        localSocket.on("message", (chunk, isBinary) => {
          ws.send(
            JSON.stringify({
              type: "ws_message",
              id: message.id,
              chunk: Buffer.from(chunk as Buffer).toString("base64"),
              isBinary,
            })
          );
        });

        localSocket.on("close", (code, reason) => {
          ws.send(
            JSON.stringify({
              type: "ws_close",
              id: message.id,
              code,
              reason: reason.toString(),
            })
          );
          pendingSockets.delete(message.id);
        });

        localSocket.on("error", (error) => {
          ws.send(
            JSON.stringify({
              type: "ws_open_error",
              id: message.id,
              message: error.message,
            })
          );
          pendingSockets.delete(message.id);
        });
        return;
      }

      if (message.type === "ws_message") {
        const localSocket = pendingSockets.get(message.id);
        if (localSocket?.readyState === WebSocket.OPEN) {
          localSocket.send(Buffer.from(message.chunk, "base64"), {
            binary: Boolean(message.isBinary),
          });
        }
        return;
      }

      if (message.type === "ws_close") {
        const localSocket = pendingSockets.get(message.id);
        if (localSocket) {
          localSocket.close(message.code, message.reason);
          pendingSockets.delete(message.id);
        }
        return;
      }

      if (message.type === "tcp_open") {
        const localSocket = net.connect({ host: "127.0.0.1", port: localPort });
        pendingTcpSockets.set(message.id, localSocket);

        localSocket.on("data", (chunk) => {
          ws.send(
            JSON.stringify({
              type: "tcp_data",
              id: message.id,
              chunk: chunk.toString("base64"),
            })
          );
        });

        localSocket.on("end", () => {
          ws.send(JSON.stringify({ type: "tcp_end", id: message.id }));
          pendingTcpSockets.delete(message.id);
        });

        localSocket.on("error", (error) => {
          ws.send(
            JSON.stringify({
              type: "tcp_error",
              id: message.id,
              message: error.message,
            })
          );
          pendingTcpSockets.delete(message.id);
        });
        return;
      }

      if (message.type === "tcp_data") {
        const localSocket = pendingTcpSockets.get(message.id);
        if (localSocket && !localSocket.destroyed) {
          localSocket.write(Buffer.from(message.chunk, "base64"));
        }
        return;
      }

      if (message.type === "tcp_end") {
        const localSocket = pendingTcpSockets.get(message.id);
        if (localSocket && !localSocket.destroyed) {
          localSocket.end();
        }
        pendingTcpSockets.delete(message.id);
        return;
      }

      if (message.type === "tcp_error") {
        const localSocket = pendingTcpSockets.get(message.id);
        if (localSocket && !localSocket.destroyed) {
          localSocket.destroy(new Error(message.message));
        }
        pendingTcpSockets.delete(message.id);
      }
    });

    ws.on("close", (code, reason) => {
      if (shutdownRequested) {
        console.log("\n[Knrog] Tunnel closed.");
        process.exit(0);
      }

      reconnectAttempt += 1;
      const delay = Math.min(30000, 1000 * 2 ** reconnectAttempt);
      console.log(
        `\n[Knrog] Tunnel disconnected (${code}: ${reason.toString() || "unknown"}). Reconnecting in ${Math.round(
          delay / 1000
        )}s...`
      );
      setTimeout(connect, delay);
    });

    ws.on("error", (error) => {
      console.error("[Knrog] Tunnel error:", error.message);
    });
  };

  process.on("SIGINT", () => {
    shutdownRequested = true;
    console.log("\n[Knrog] Closing tunnel...");
    currentWs?.close();
    for (const socket of pendingSockets.values()) {
      socket.close();
    }
    for (const socket of pendingTcpSockets.values()) {
      socket.destroy();
    }
  });

  connect();
}
