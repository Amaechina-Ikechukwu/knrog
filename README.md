# knrog

A multi-instance-ready HTTP and WebSocket tunneling service.

## Features

- **HTTP + WebSocket Tunneling**: Automatic request routing for subdomains on `*.knrog.online`.
- **TCP Tunneling**: Paid agents can reserve a public TCP port and bridge raw TCP streams to local services.
- **Security Protection**: Built-in filtering for malicious paths, vulnerability scanners, and IP-based rate limiting for suspicious activity.
- **Traffic Inspection**: Request logs capture headers, body previews, latency, and replayable HTTP requests for paid plans.
- **Multi-Instance Routing Foundations**: Active tunnels and CLI sessions are persisted so instances can hand traffic to the node that owns a tunnel.
- **Access Controls**: Optional per-domain access tokens and basic auth.
- **Multi-Domain Architecture**: Segregated routing for landing page (`knrog.online`), app dashboard (`app.knrog.online`), and API (`api.knrog.online`).
- **Automated Migrations**: Integrated database schema management that runs automatically on server startup.

## Architecture

- **Landing Page**: `knrog.online` (Public marketing site)
- **App Dashboard**: `app.knrog.online` (Authenticated user dashboard)
- **Backend API**: `api.knrog.online` (Core tunneling and API logic)
- **User Tunnels**: `*.knrog.online` (Dynamic user-generated tunnels)

For production deployment instructions using Dokploy, refer to [DOKPLOY_SETUP.md](./DOKPLOY_SETUP.md).

To install dependencies:

bash
bun install
cd web && bun install

To run:

bash
# Start Backend
bun run server/src/index.ts

# Start Frontend
cd web && bun run dev

# Run transport harness
npm run test:transport

Important environment variables:

- `JWT_SECRET`: required for auth and internal relay signing.
- `TUNNEL_BASE_DOMAIN`: public wildcard base domain, for example `knrog.online`.
- `INSTANCE_ADVERTISE_URL`: URL other nodes can use to relay traffic to this instance.
- `CLUSTER_SHARED_SECRET`: shared secret for internal cross-node forwarding.
- `TCP_TUNNEL_PUBLIC_HOST`: public host shown for reserved TCP ports.
- `TCP_TUNNEL_PORT_START` / `TCP_TUNNEL_PORT_END`: inclusive TCP listener range.
- `REQUIRE_EMAIL_VERIFICATION`: require email verification for browser signups.

CLI examples:

- `knrog 3000 --subdomain demo` for HTTP/WebSocket tunnels.
- `knrog tcp 5432 --remote-port 7001` for TCP tunnels.

This project was created using `bun init` in bun v1.3.4. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.
