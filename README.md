# knrog

A fast, subdomain-based tunneling service.

## Features

- **Subdomain Tunneling**: Automatic request routing for subdomains on `knrog.online`.
- **Security Protection**: Built-in filtering for malicious paths, vulnerability scanners, and IP-based rate limiting for suspicious activity.
- **Multi-Domain Architecture**: Segregated routing for landing page (`knrog.online`), app dashboard (`app.knrog.online`), and API (`api.knrog.online`).

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

This project was created using `bun init` in bun v1.3.4. [Bun](https://bun.com) is a fast all-in-one JavaScript runtime.