import { WebSocket } from "ws";
import { updateDomainLastUsed } from "./api/domains";

// Use a Map to store [subdomain] -> { socket, userId }
const tunnels = new Map<string, { socket: WebSocket; userId: string }>();

export const registerTunnel = (subdomain: string, socket: WebSocket, userId: string) => {
  tunnels.set(subdomain, { socket, userId });
  // Update the lastUsedAt timestamp when tunnel is registered
  updateDomainLastUsed(subdomain);
};

export const removeTunnel = (subdomain: string) => {
  tunnels.delete(subdomain);
};

export const getTunnelSocket = (subdomain: string): WebSocket | undefined => {
  return tunnels.get(subdomain)?.socket;
};

export const isSubdomainTaken = (subdomain: string): boolean => {
  return tunnels.has(subdomain);
};

export const getConnectionCount = (userId: string): number => {
  let count = 0;
  for (const session of tunnels.values()) {
    if (session.userId === userId) {
      count++;
    }
  }
  return count;
};
