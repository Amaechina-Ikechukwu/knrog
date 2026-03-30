import { WebSocket } from "ws";

const tcpTunnels = new Map<
  number,
  { socket: WebSocket; userId: string; connectionId: string }
>();

export const registerTcpTunnel = (
  publicPort: number,
  socket: WebSocket,
  userId: string,
  connectionId: string
) => {
  tcpTunnels.set(publicPort, { socket, userId, connectionId });
};

export const removeTcpTunnel = (publicPort: number) => {
  tcpTunnels.delete(publicPort);
};

export const getTcpTunnelSocket = (publicPort: number) =>
  tcpTunnels.get(publicPort)?.socket;

export const getTcpTunnelUserId = (publicPort: number) =>
  tcpTunnels.get(publicPort)?.userId;

export const isTcpPortTaken = (publicPort: number) => tcpTunnels.has(publicPort);

export const getTcpConnectionCount = (userId: string) => {
  let count = 0;
  for (const session of tcpTunnels.values()) {
    if (session.userId === userId) {
      count += 1;
    }
  }
  return count;
};
