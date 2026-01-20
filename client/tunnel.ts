import { WebSocket } from "ws";
import http from "http";
import { Config, saveConfig } from "./config.js";

export function startTunnel(
  localPort: number,
  serverUrl: string,
  apiKey: string,
  subdomain: string | undefined,
  config: Config
) {
  console.log(`[Knrog] Connecting to ${serverUrl}...`);
  console.log(`[Knrog] Forwarding to localhost:${localPort}`);

  // Build connection URL with query params
  let wsUrl = serverUrl + `?apiKey=${encodeURIComponent(apiKey)}`;
  if (subdomain) {
    wsUrl += `&subdomain=${encodeURIComponent(subdomain)}`;
  }

  const ws = new WebSocket(wsUrl);
  const pendingRequests = new Map<string, http.ClientRequest>();

  ws.on("open", () => {
    console.log("[Knrog] ✓ Connected to server!");
  });

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === "init") {
      // Save the subdomain for reuse
      config.lastSubdomain = message.subdomain;
      saveConfig(config);
      
      console.log(`\n┌─────────────────────────────────────────┐`);
      console.log(`│  🌐 Your tunnel is live!               │`);
      console.log(`│                                         │`);
      console.log(
        `│  ${message.subdomain}.${process.env.DOMAIN_CONNECTION || "knrog.online"}              │`
      );
      console.log(`│                                         │`);
      console.log(`│  → localhost:${localPort.toString().padEnd(27)}│`);
      console.log(`└─────────────────────────────────────────┘\n`);
    }

    if (message.type === "request") {
      const timestamp = new Date().toLocaleTimeString();
      const method = message.method || "GET";
      const url = message.url || "/";
      console.log(`[${timestamp}] ${method} ${url}`);
      console.log(`[Client] Forwarding request ${message.id} to localhost:${localPort}`);
      
      // Filter out problematic headers
      const cleanHeaders = { ...message.headers };
      delete cleanHeaders['connection'];
      delete cleanHeaders['upgrade'];
      delete cleanHeaders['host'];
      delete cleanHeaders['cf-ray'];
      delete cleanHeaders['cf-connecting-ip'];
      delete cleanHeaders['cf-ipcountry'];
      delete cleanHeaders['cf-visitor'];
      delete cleanHeaders['cdn-loop'];
      delete cleanHeaders['x-forwarded-for'];
      delete cleanHeaders['x-forwarded-proto'];
      delete cleanHeaders['x-real-ip'];
      
      const localReq = http.request(
        {
          host: "localhost",
          port: localPort,
          method: message.method,
          path: message.url,
          headers: cleanHeaders,
        },
        (localRes) => {
          const now = new Date();
          const time = now.toLocaleTimeString();
          const date = now.toLocaleDateString();
          console.log(
            `[Client] ${date} ${time} — ${method} ${url} → ${localRes.statusCode} ${
              localRes.statusMessage || ""
            }`
          );
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
            ws.send(
              JSON.stringify({
                type: "res_end",
                id: message.id,
              })
            );
            pendingRequests.delete(message.id);
          });
        }
      );
      
      localReq.on("error", (err) => {
        console.error(
          `[Knrog] Error forwarding to localhost:${localPort}:`,
          err.message
        );
        ws.send(
          JSON.stringify({
            type: "error",
            id: message.id,
            message: err.message,
          })
        );
        pendingRequests.delete(message.id);
      });
      
      // Store the request so we can write body data to it later
      pendingRequests.set(message.id, localReq);
      
      // For GET requests (no body), end immediately
      if (method === "GET" || method === "HEAD") {
        localReq.end();
      }
      
      return;
    }
    
    // Handle request body chunks
    if (message.type === "req_data") {
      const pendingReq = pendingRequests.get(message.id);
      if (pendingReq) {
        const chunk = Buffer.from(message.chunk, "base64");
        pendingReq.write(chunk);
      }
      return;
    }

    // Handle request body end
    if (message.type === "req_end") {
      const pendingReq = pendingRequests.get(message.id);
      if (pendingReq) {
        pendingReq.end();
      }
      return;
    }
  });

  ws.on("close", (code, reason) => {
    console.log(`\n[Knrog] ✗ Tunnel closed (Code: ${code}, Reason: ${reason.toString() || "Unknown"})`);
    process.exit(0);
  });

  ws.on("error", (err) => {
    console.error("[Knrog] ❌ Error:", err.message);
    process.exit(1);
  });

  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    console.log("\n[Knrog] Closing tunnel...");
    ws.close();
  });
}
