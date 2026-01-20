#!/usr/bin/env node
// client/index.ts
import { Command } from "commander";
import { loadConfig, saveConfig } from "./config.js";
import { getOrCreateApiKey } from "./session.js";
import { startTunnel } from "./tunnel.js";

const program = new Command();

program
  .name("knrog")
  .description("Expose your local server to the internet")
  .argument("<port>", "Local port to expose")
  .option(
    "-s, --server <url>",
    "Knrog server URL",
    "wss://api.knrog.online"
  )
  .option("-k, --api-key <key>", "API Key for authentication")
  .option("-d, --subdomain <name>", "Request a specific subdomain (paid users only)")
  .option("-r, --reuse", "Reuse your last subdomain (paid users only)")
  .action(async (port: string, options) => {
    const localPort = parseInt(port);
    const serverUrl = options.server;

    if (isNaN(localPort) || localPort < 1 || localPort > 65535) {
      console.error("❌ Invalid port number. Must be between 1 and 65535");
      process.exit(1);
    }

    // Load configuration
    const config = loadConfig();
    
    // Only reuse subdomain if explicitly requested with --reuse flag or --subdomain
    let subdomain: string | undefined;
    if (options.subdomain) {
      subdomain = options.subdomain;
    } else if (options.reuse && config.lastSubdomain) {
      subdomain = config.lastSubdomain;
      console.log(`[Knrog] Reusing subdomain: ${subdomain}`);
    }

    // Get or create API key
    const apiKey = await getOrCreateApiKey(serverUrl, options.apiKey, config.apiKey);
    
    // Save API key to config if it's new or changed
    if (config.apiKey !== apiKey) {
      config.apiKey = apiKey;
      saveConfig(config);
      console.log("[Knrog] API Key saved to ~/.knrog/config.json");
    }

    // Start tunnel
    startTunnel(localPort, serverUrl, apiKey, subdomain, config);
  });

program.parse();
