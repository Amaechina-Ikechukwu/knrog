import { eq, lt } from "drizzle-orm";
import { db } from "../db";
import { activeTcpTunnels } from "../db/schema";
import {
  INSTANCE_ADVERTISE_URL,
  INSTANCE_ID,
  TCP_TUNNEL_PUBLIC_HOST,
} from "../config";

export const upsertActiveTcpTunnel = async (
  publicPort: number,
  userId: string,
  connectionId: string
) => {
  await db
    .insert(activeTcpTunnels)
    .values({
      publicPort,
      userId,
      instanceId: INSTANCE_ID,
      instanceUrl: INSTANCE_ADVERTISE_URL,
      connectionId,
      publicHost: TCP_TUNNEL_PUBLIC_HOST,
      lastHeartbeatAt: new Date(),
    })
    .onConflictDoUpdate({
      target: activeTcpTunnels.publicPort,
      set: {
        userId,
        instanceId: INSTANCE_ID,
        instanceUrl: INSTANCE_ADVERTISE_URL,
        connectionId,
        publicHost: TCP_TUNNEL_PUBLIC_HOST,
        connectedAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
    });
};

export const touchActiveTcpTunnel = async (publicPort: number) => {
  await db
    .update(activeTcpTunnels)
    .set({ lastHeartbeatAt: new Date() })
    .where(eq(activeTcpTunnels.publicPort, publicPort));
};

export const removeActiveTcpTunnel = async (publicPort: number) => {
  await db
    .delete(activeTcpTunnels)
    .where(eq(activeTcpTunnels.publicPort, publicPort));
};

export const getActiveTcpTunnel = async (publicPort: number) =>
  db.query.activeTcpTunnels.findFirst({
    where: eq(activeTcpTunnels.publicPort, publicPort),
  });

export const cleanupStaleActiveTcpTunnels = async (staleAfterMs = 90_000) => {
  await db
    .delete(activeTcpTunnels)
    .where(
      lt(activeTcpTunnels.lastHeartbeatAt, new Date(Date.now() - staleAfterMs))
    );
};
