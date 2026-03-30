import { randomUUID } from "crypto";

const requireEnv = (name: string): string => {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
};

export const SERVER_PORT = Number(process.env.SERVER_PORT || 3000);
export const API_DOMAIN = process.env.API_DOMAIN || "api.knrog.online";
export const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:5173";
export const FRONTEND_URL_DEV = process.env.FRONTEND_URL_DEV || "http://localhost:5173";
export const TUNNEL_BASE_DOMAIN = process.env.TUNNEL_BASE_DOMAIN || "knrog.online";
export const TUNNEL_PROTOCOL = process.env.TUNNEL_PROTOCOL || "https";
export const JWT_SECRET = requireEnv("JWT_SECRET");
export const INTERNAL_SHARED_SECRET =
  process.env.CLUSTER_SHARED_SECRET || JWT_SECRET;
export const INSTANCE_ID = process.env.INSTANCE_ID || randomUUID();
export const INSTANCE_ADVERTISE_URL =
  process.env.INSTANCE_ADVERTISE_URL || `http://127.0.0.1:${SERVER_PORT}`;
export const TCP_TUNNEL_HOST = process.env.TCP_TUNNEL_HOST || "0.0.0.0";
export const TCP_TUNNEL_PUBLIC_HOST =
  process.env.TCP_TUNNEL_PUBLIC_HOST || API_DOMAIN;
export const TCP_TUNNEL_PORT_START = Number(
  process.env.TCP_TUNNEL_PORT_START || 7000
);
export const TCP_TUNNEL_PORT_END = Number(
  process.env.TCP_TUNNEL_PORT_END || 7099
);
export const REQUIRE_EMAIL_VERIFICATION =
  process.env.REQUIRE_EMAIL_VERIFICATION === "true" ||
  (process.env.REQUIRE_EMAIL_VERIFICATION !== "false" &&
    process.env.NODE_ENV === "production");

export const buildTunnelUrl = (subdomain: string) =>
  `${TUNNEL_PROTOCOL}://${subdomain}.${TUNNEL_BASE_DOMAIN}`;

export const buildTcpTunnelUrl = (publicPort: number) =>
  `tcp://${TCP_TUNNEL_PUBLIC_HOST}:${publicPort}`;

export const isMainHost = (host: string) => {
  const normalized = host.toLowerCase();
  return (
    normalized === TUNNEL_BASE_DOMAIN ||
    normalized === `www.${TUNNEL_BASE_DOMAIN}` ||
    normalized === `app.${TUNNEL_BASE_DOMAIN}` ||
    normalized === API_DOMAIN ||
    normalized.startsWith("localhost")
  );
};
