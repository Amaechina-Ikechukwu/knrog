import { eq, lt } from "drizzle-orm";
import { db } from "../db";
import { activeTunnels } from "../db/schema";
import {
  INSTANCE_ADVERTISE_URL,
  INSTANCE_ID,
  buildTunnelUrl,
} from "../config";

export const upsertActiveTunnel = async (
  subdomain: string,
  userId: string,
  connectionId: string
) => {
  await db
    .insert(activeTunnels)
    .values({
      subdomain,
      userId,
      instanceId: INSTANCE_ID,
      instanceUrl: INSTANCE_ADVERTISE_URL,
      connectionId,
      status: "active",
      publicUrl: buildTunnelUrl(subdomain),
      lastHeartbeatAt: new Date(),
    })
    .onConflictDoUpdate({
      target: activeTunnels.subdomain,
      set: {
        userId,
        instanceId: INSTANCE_ID,
        instanceUrl: INSTANCE_ADVERTISE_URL,
        connectionId,
        status: "active",
        publicUrl: buildTunnelUrl(subdomain),
        connectedAt: new Date(),
        lastHeartbeatAt: new Date(),
      },
    });
};

export const touchActiveTunnel = async (subdomain: string) => {
  await db
    .update(activeTunnels)
    .set({ lastHeartbeatAt: new Date(), status: "active" })
    .where(eq(activeTunnels.subdomain, subdomain));
};

export const removeActiveTunnel = async (subdomain: string) => {
  await db.delete(activeTunnels).where(eq(activeTunnels.subdomain, subdomain));
};

export const getActiveTunnel = async (subdomain: string) =>
  db.query.activeTunnels.findFirst({
    where: eq(activeTunnels.subdomain, subdomain),
  });

export const cleanupStaleActiveTunnels = async (staleAfterMs = 90_000) => {
  await db
    .delete(activeTunnels)
    .where(lt(activeTunnels.lastHeartbeatAt, new Date(Date.now() - staleAfterMs)));
};
