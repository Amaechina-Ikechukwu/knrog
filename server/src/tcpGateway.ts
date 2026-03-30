import { randomUUID } from "crypto";
import net from "net";
import { WebSocket } from "ws";
import { trackUsage } from "./api/billing";
import {
  INTERNAL_SHARED_SECRET,
  INSTANCE_ID,
  TCP_TUNNEL_PUBLIC_HOST,
} from "./config";
import { getActiveTcpTunnel } from "./state/activeTcpTunnels";
import {
  getTcpConnectionCount,
  getTcpTunnelSocket,
  getTcpTunnelUserId,
  isTcpPortTaken,
} from "./tcpRegistry";

type TcpTunnelMessage =
  | { type: "tcp_open"; id: string }
  | { type: "tcp_data"; id: string; chunk: string }
  | { type: "tcp_end"; id: string }
  | { type: "tcp_error"; id: string; message: string };

type BridgeTarget =
  | { kind: "socket"; socket: net.Socket }
  | { kind: "ws"; socket: WebSocket };

const INTERNAL_WS_PATH = "/_internal/tunnel/ws";
const tcpConnections = new Map<string, BridgeTarget>();
const tcpUsage = new Map<
  string,
  { userId: string; publicPort: number; startedAt: number; bytesIn: number; bytesOut: number }
>();

const isWebSocketOpen = (ws: WebSocket) => ws.readyState === WebSocket.OPEN;

const sendToTcpTunnel = (publicPort: number, payload: TcpTunnelMessage) => {
  const socket = getTcpTunnelSocket(publicPort);
  if (!socket || !isWebSocketOpen(socket)) {
    return false;
  }

  socket.send(JSON.stringify(payload));
  return true;
};

const createBridge = (publicPort: number, target: BridgeTarget) => {
  const userId = getTcpTunnelUserId(publicPort);
  if (!userId) {
    return null;
  }

  const id = randomUUID();
  tcpConnections.set(id, target);
  tcpUsage.set(id, {
    userId,
    publicPort,
    startedAt: Date.now(),
    bytesIn: 0,
    bytesOut: 0,
  });

  if (!sendToTcpTunnel(publicPort, { type: "tcp_open", id })) {
    tcpConnections.delete(id);
    tcpUsage.delete(id);
    return null;
  }

  return id;
};

const finalizeBridge = async (id: string) => {
  const usage = tcpUsage.get(id);
  if (usage) {
    await trackUsage(usage.userId, usage.bytesIn + usage.bytesOut, 0);
  }

  tcpUsage.delete(id);
  tcpConnections.delete(id);
};

const closeBridgeTarget = (target: BridgeTarget, message?: string) => {
  if (target.kind === "socket") {
    target.socket.end();
    if (message) {
      target.socket.destroy(new Error(message));
    }
    return;
  }

  if (isWebSocketOpen(target.socket)) {
    target.socket.close(1011, message);
  }
};

const bridgePublicSocketToLocalTunnel = (socket: net.Socket, publicPort: number) => {
  const bridgeId = createBridge(publicPort, { kind: "socket", socket });
  if (!bridgeId) {
    socket.end("Knrog TCP tunnel unavailable");
    return;
  }

  socket.on("data", (chunk) => {
    const usage = tcpUsage.get(bridgeId);
    if (usage) {
      usage.bytesIn += chunk.length;
    }
    sendToTcpTunnel(publicPort, {
      type: "tcp_data",
      id: bridgeId,
      chunk: chunk.toString("base64"),
    });
  });

  socket.on("end", async () => {
    sendToTcpTunnel(publicPort, { type: "tcp_end", id: bridgeId });
    await finalizeBridge(bridgeId);
  });

  socket.on("error", async (error) => {
    sendToTcpTunnel(publicPort, {
      type: "tcp_error",
      id: bridgeId,
      message: error.message,
    });
    await finalizeBridge(bridgeId);
  });
};

const bridgePublicSocketToRemoteInstance = (
  socket: net.Socket,
  publicPort: number,
  instanceUrl: string
) => {
  const relayWs = new WebSocket(
    `${instanceUrl.replace(/^http/i, "ws")}${INTERNAL_WS_PATH}`,
    {
      headers: {
        "x-knrog-internal-secret": INTERNAL_SHARED_SECRET,
        "x-knrog-internal-mode": "tcp",
        "x-knrog-public-port": String(publicPort),
      },
    }
  );

  relayWs.on("message", (data) => {
    socket.write(Buffer.from(data as Buffer));
  });

  socket.on("data", (chunk) => {
    if (isWebSocketOpen(relayWs)) {
      relayWs.send(chunk);
    }
  });

  socket.on("end", () => {
    if (isWebSocketOpen(relayWs)) {
      relayWs.close();
    }
  });

  socket.on("error", () => {
    if (isWebSocketOpen(relayWs)) {
      relayWs.close();
    }
  });

  relayWs.on("close", () => {
    socket.end();
  });

  relayWs.on("error", () => {
    socket.end("Knrog internal TCP relay unavailable");
  });
};

export const handleIncomingTcpConnection = async (
  socket: net.Socket,
  publicPort: number
) => {
  if (isTcpPortTaken(publicPort)) {
    bridgePublicSocketToLocalTunnel(socket, publicPort);
    return;
  }

  const activeTunnel = await getActiveTcpTunnel(publicPort);
  if (!activeTunnel) {
    socket.end("Knrog TCP tunnel not found");
    return;
  }

  if (activeTunnel.instanceId === INSTANCE_ID) {
    bridgePublicSocketToLocalTunnel(socket, publicPort);
    return;
  }

  bridgePublicSocketToRemoteInstance(socket, publicPort, activeTunnel.instanceUrl);
};

export const handleInternalTcpRelay = (ws: WebSocket, publicPort: number) => {
  const bridgeId = createBridge(publicPort, { kind: "ws", socket: ws });
  if (!bridgeId) {
    ws.close(1011, "TCP tunnel unavailable");
    return;
  }

  ws.on("message", (data) => {
    const chunk = Buffer.from(data as Buffer);
    const usage = tcpUsage.get(bridgeId);
    if (usage) {
      usage.bytesIn += chunk.length;
    }

    sendToTcpTunnel(publicPort, {
      type: "tcp_data",
      id: bridgeId,
      chunk: chunk.toString("base64"),
    });
  });

  ws.on("close", async () => {
    sendToTcpTunnel(publicPort, { type: "tcp_end", id: bridgeId });
    await finalizeBridge(bridgeId);
  });

  ws.on("error", async (error) => {
    sendToTcpTunnel(publicPort, {
      type: "tcp_error",
      id: bridgeId,
      message: error.message,
    });
    await finalizeBridge(bridgeId);
  });
};

export const handleTcpTunnelMessage = async (
  message: TcpTunnelMessage
) => {
  const target = tcpConnections.get(message.id);
  if (!target) {
    return;
  }

  if (message.type === "tcp_data") {
    const chunk = Buffer.from(message.chunk, "base64");
    const usage = tcpUsage.get(message.id);
    if (usage) {
      usage.bytesOut += chunk.length;
    }

    if (target.kind === "socket") {
      target.socket.write(chunk);
    } else if (isWebSocketOpen(target.socket)) {
      target.socket.send(chunk);
    }
    return;
  }

  if (message.type === "tcp_end") {
    closeBridgeTarget(target);
    await finalizeBridge(message.id);
    return;
  }

  if (message.type === "tcp_error") {
    closeBridgeTarget(target, message.message);
    await finalizeBridge(message.id);
  }
};

export const isTcpTunnelMessage = (
  message: { type?: string }
): message is TcpTunnelMessage =>
  message.type === "tcp_open" ||
  message.type === "tcp_data" ||
  message.type === "tcp_end" ||
  message.type === "tcp_error";

export const getTotalTcpConnections = (userId: string) =>
  getTcpConnectionCount(userId);

export const describeTcpPublicHost = () => TCP_TUNNEL_PUBLIC_HOST;
