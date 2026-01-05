import * as http from "http";
import { WebSocketServer } from "ws";
import { handleIncomingRequest } from "./router";
import { isSubdomainTaken, registerTunnel, removeTunnel } from "./registry";
import { getRandomName } from "./utils/randomnames";

const PORT = 9000;

// 1. The Gateway (Public Web Traffic)
const gateway = http.createServer(handleIncomingRequest);

// 2. The Tunnel Hub (CLI Connections)
const wss = new WebSocketServer({ server: gateway });

wss.on("connection", (ws) => {
  let subdomain = getRandomName(); // Generate random name
  while (isSubdomainTaken(subdomain)) {
    subdomain = getRandomName(); // Try again until we get a unique one
  }
  registerTunnel(subdomain, ws);

  // Tell the client its URL
  ws.send(JSON.stringify({ type: "init", subdomain }));
  console.log(`[Relife] New Tunnel: ${subdomain}`);

  ws.on("close", () => {
    removeTunnel(subdomain);
    console.log(`[Relife] Closed: ${subdomain}`);
  });
});

gateway.listen(PORT, () => {
  console.log(`Relife Server running on port ${PORT}`);
});
