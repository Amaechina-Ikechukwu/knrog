import { WebSocket } from "ws";
import { updateDomainLastUsed } from "./api/domains";

// Use a Map to store [subdomain] -> { socket, userId, isPaid }
const tunnels = new Map<string, { socket: WebSocket; userId: string; isPaid: boolean }>();

export const registerTunnel = (subdomain: string, socket: WebSocket, userId: string, isPaid: boolean = false) => {
  tunnels.set(subdomain, { socket, userId, isPaid });
  // Update the lastUsedAt timestamp when tunnel is registered
  updateDomainLastUsed(subdomain);
};

export const removeTunnel = (subdomain: string) => {
  tunnels.delete(subdomain);
};

export const getTunnelSocket = (subdomain: string): WebSocket | undefined => {
  return tunnels.get(subdomain)?.socket;
};

export const getTunnelUserId = (subdomain: string): string | undefined => {
  return tunnels.get(subdomain)?.userId;
};

export const getTunnelIsPaid = (subdomain: string): boolean => {
  return tunnels.get(subdomain)?.isPaid ?? false;
};

export const getTunnelSubdomain = (socket: WebSocket): string | undefined => {
  for (const [subdomain, tunnel] of tunnels.entries()) {
    if (tunnel.socket === socket) {
      return subdomain;
    }
  }
  return undefined;
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
