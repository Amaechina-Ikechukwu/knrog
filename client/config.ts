import { homedir } from "os";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import { join } from "path";

export const CONFIG_DIR = join(homedir(), ".knrog");
export const CONFIG_FILE = join(CONFIG_DIR, "config.json");

export interface Config {
  apiKey?: string;
  lastSubdomain?: string;
}

export function loadConfig(): Config {
  try {
    if (existsSync(CONFIG_FILE)) {
      return JSON.parse(readFileSync(CONFIG_FILE, "utf-8"));
    }
  } catch {
    // Ignore errors
  }
  return {};
}

export function saveConfig(config: Config) {
  if (!existsSync(CONFIG_DIR)) {
    mkdirSync(CONFIG_DIR, { recursive: true });
  }
  writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
}
