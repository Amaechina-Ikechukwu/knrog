import { WebSocket } from "ws";

// Use a Map to store [subdomain] -> [WebSocket]
const tunnels = new Map<string, WebSocket>();

export const registerTunnel = (subdomain: string, socket: WebSocket) => {
  tunnels.set(subdomain, socket);
};

export const removeTunnel = (subdomain: string) => {
  tunnels.delete(subdomain);
};

export const getTunnelSocket = (subdomain: string): WebSocket | undefined => {
  return tunnels.get(subdomain);
};
export const isSubdomainTaken = (subdomain: string): boolean => {
  return tunnels.has(subdomain);
};
