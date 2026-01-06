// client/index.ts
import { WebSocket } from "ws";
import { Command } from "commander";

const program = new Command();

program
  .name("knrog")
  .description("Expose your local server to the internet")
  .argument("<port>", "Local port to expose")
  .option(
    "-s, --server <url>",
    "Knrog server URL",
    `wss://${process.env.DOMAIN_CONNECTION}`
  )
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
  console.log(`[Knrog] Connecting to ${serverUrl}...`);
  console.log(`[Knrog] Forwarding to localhost:${localPort}`);

  const ws = new WebSocket(serverUrl);

  ws.on("open", () => {
    console.log("[Knrog] ✓ Connected to server!");
  });

  ws.on("message", (data) => {
    const message = JSON.parse(data.toString());

    if (message.type === "init") {
      console.log(`\n┌─────────────────────────────────────────┐`);
      console.log(`│  🌐 Your tunnel is live!               │`);
      console.log(`│                                         │`);
      console.log(
        `│  ${message.subdomain}.${process.env.DOMAIN_CONNECTION}              │`
      );
      console.log(`│                                         │`);
      console.log(`│  → localhost:${localPort.toString().padEnd(27)}│`);
      console.log(`└─────────────────────────────────────────┘\n`);
    }

     if (message.type === "request" || message.type === "open") {
      console.debug("Knrog: frame:", JSON.stringify(message, null, 2));
       const timestamp = new Date().toLocaleTimeString();
       const method = message.method || "GET";
       const url = message.url || "/";
       console.log(`[${timestamp}] ${method} ${url}`);

       // optional debug: full frame when fields missing
       if (!message.method || !message.url) {
         console.debug("Knrog: frame:", JSON.stringify(message, null, 2));
       }
       return;
     }

  });

  ws.on("close", () => {
    console.log("\n[Knrog] ✗ Tunnel closed");
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
