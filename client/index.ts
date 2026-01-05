// client/index.ts
import { WebSocket } from "ws";
import { Command } from "commander";

const program = new Command();

program
  .name("relife")
  .description("Expose your local server to the internet")
  .argument("<port>", "Local port to expose")
  .option("-s, --server <url>", "Relife server URL", "ws://localhost:9000")
  .action((port: string, options) => {
    const localPort = parseInt(port);
    const serverUrl = options.server;

    if (isNaN(localPort) || localPort < 1 || localPort > 65535) {
      console.error("❌ Invalid port number. Must be between 1 and 65535");
      process.exit(1);
    }

    startTunnel(localPort, serverUrl);
  });

program.parse();

function startTunnel(localPort: number, serverUrl: string) {
  console.log(`[Relife] Connecting to ${serverUrl}...`);
  console.log(`[Relife] Forwarding to localhost:${localPort}`);

  const ws = new WebSocket(serverUrl);

  ws.on("open", () => {
    console.log("[Relife] ✓ Connected to server!");
  });

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === "init") {
      console.log(`\n┌─────────────────────────────────────────┐`);
      console.log(`│  🌐 Your tunnel is live!               │`);
      console.log(`│                                         │`);
      console.log(`│  ${message.subdomain}.relife.com              │`);
      console.log(`│                                         │`);
      console.log(`│  → localhost:${localPort.toString().padEnd(27)}│`);
      console.log(`└─────────────────────────────────────────┘\n`);
    }

    if (message.type === "request") {
      const timestamp = new Date().toLocaleTimeString();
      console.log(`[${timestamp}] ${message.method} ${message.url} ${message.statusCode}`);
      console.log(
        `[Message] ${message.statusMessage}`
      );
    }
  });

  ws.on("close", () => {
    console.log("\n[Relife] ✗ Tunnel closed");
    process.exit(0);
  });

  ws.on("error", (err) => {
    console.error("[Relife] ❌ Error:", err.message);
    process.exit(1);
  });

  // Handle Ctrl+C gracefully
  process.on("SIGINT", () => {
    console.log("\n[Relife] Closing tunnel...");
    ws.close();
  });
}
