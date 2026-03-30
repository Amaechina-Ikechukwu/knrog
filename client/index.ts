#!/usr/bin/env node
// client/index.ts
import { Command } from "commander";
import { loadConfig, saveConfig } from "./config.js";
import { getOrCreateApiKey } from "./session.js";
import { startTunnel } from "./tunnel.js";

const program = new Command();

const getCliArgValue = (longFlag: string, shortFlag?: string) => {
  const argv = process.argv;
  const index = argv.findIndex((value) => value === longFlag || value === shortFlag);
  if (index === -1 || index + 1 >= argv.length) {
    return undefined;
  }
  return argv[index + 1];
};

program
  .name("knrog")
  .description("Expose your local server to the internet")
  .version("1.0.1");

program
  .command("logout")
  .description("Log out and clear stored credentials")
  .action(() => {
    const config = loadConfig();
    if (config.apiKey) {
      delete config.apiKey;
      saveConfig(config);
      console.log("✅ Successfully logged out. API key removed.");
    } else {
      console.log("ℹ️  You are not currently logged in.");
    }
  });

const addCommonOptions = (command: Command) =>
  command
  .option(
    "-s, --server <url>",
    "Knrog server URL",
    "wss://api.knrog.online"
  )
  .option("-k, --api-key <key>", "API Key for authentication")
  .option("-d, --subdomain <name>", "Request a specific subdomain (paid users only)")
  .option("-r, --reuse", "Reuse your last subdomain (paid users only)");

const resolveApiKey = async (serverUrl: string, providedApiKey?: string) => {
  const config = loadConfig();
  const apiKey = await getOrCreateApiKey(serverUrl, providedApiKey, config.apiKey);

  if (config.apiKey !== apiKey) {
    config.apiKey = apiKey;
    saveConfig(config);
    console.log("[Knrog] API Key saved to ~/.knrog/config.json");
  }

  return { apiKey, config };
};

// Main HTTP tunnel command (default)
addCommonOptions(
  program.argument("[port]", "Local port to expose")
).action(async (port, options) => {
    // If no port is provided (and it's not the logout command which is already handled), show help
    if (!port) {
      program.help();
      return;
    }

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
    const { apiKey } = await resolveApiKey(serverUrl, options.apiKey);

    // Start tunnel
    startTunnel("http", localPort, serverUrl, apiKey, subdomain, config);
  });

addCommonOptions(
  program
    .command("tcp <port>")
    .description("Expose a local TCP service")
    .option("-p, --remote-port <port>", "Request a specific public TCP port")
).action(async (port, options) => {
  const localPort = parseInt(port, 10);
  const serverUrl =
    getCliArgValue("--server", "-s") || options.server || "wss://api.knrog.online";
  const remotePortValue = getCliArgValue("--remote-port", "-p") || options.remotePort;
  const requestedRemotePort = remotePortValue
    ? parseInt(remotePortValue, 10)
    : undefined;

  if (isNaN(localPort) || localPort < 1 || localPort > 65535) {
    console.error("âŒ Invalid local port number. Must be between 1 and 65535");
    process.exit(1);
  }

  if (
    requestedRemotePort !== undefined &&
    (isNaN(requestedRemotePort) || requestedRemotePort < 1 || requestedRemotePort > 65535)
  ) {
    console.error("âŒ Invalid remote TCP port number. Must be between 1 and 65535");
    process.exit(1);
  }

  const { apiKey, config } = await resolveApiKey(
    serverUrl,
    getCliArgValue("--api-key", "-k") || options.apiKey
  );
  startTunnel("tcp", localPort, serverUrl, apiKey, requestedRemotePort, config);
});

program.parse();
