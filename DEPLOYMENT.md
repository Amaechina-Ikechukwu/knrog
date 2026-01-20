# Knrog Production Deployment Guide

## Domain Structure

| Domain | Purpose |
|--------|---------|
| `app.knrog.online` | Web UI (static files) |
| `*.app.knrog.online` | Subdomain tunneling |
| `api.knrog.online` | API server |

## DNS Configuration

Setup these DNS records:

```
Type   Name      Value              TTL
A      @         YOUR_VPS_IP        300
A      api       YOUR_VPS_IP        300
A      app       YOUR_VPS_IP        300
A      *.app     YOUR_VPS_IP        300
```

## Nginx Configuration

```nginx
# /etc/nginx/sites-available/knrog

# HTTP to HTTPS redirect
server {
    listen 80;
    server_name knrog.online api.knrog.online app.knrog.online *.app.knrog.online;
    return 301 https://$host$request_uri;
}

# Root domain redirect to app
server {
    listen 443 ssl;
    server_name knrog.online;

    ssl_certificate /etc/letsencrypt/live/knrog.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/knrog.online/privkey.pem;

    return 301 https://app.knrog.online$request_uri;
}

# Web UI (static files)
server {
    listen 443 ssl;
    server_name app.knrog.online;

    ssl_certificate /etc/letsencrypt/live/app.knrog.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.knrog.online/privkey.pem;

    root /var/www/knrog-web;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}

# API Server
server {
    listen 443 ssl;
    server_name api.knrog.online;

    ssl_certificate /etc/letsencrypt/live/knrog.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/knrog.online/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}

# Tunnel Endpoints (subdomain.app.knrog.online)
server {
    listen 443 ssl;
    server_name *.app.knrog.online;

    ssl_certificate /etc/letsencrypt/live/app.knrog.online/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/app.knrog.online/privkey.pem;

    location / {
        proxy_pass http://127.0.0.1:9000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

Enable and test:
```bash
sudo ln -s /etc/nginx/sites-available/knrog /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Setup with Certbot

```bash
# For knrog.online and api.knrog.online
sudo certbot certonly --dns-cloudflare --dns-cloudflare-credentials /home/march/.secrets/cf.ini -d knrog.online -d "*.knrog.online"

# For app.knrog.online and *.app.knrog.online (tunnel subdomains)
sudo certbot certonly --dns-cloudflare --dns-cloudflare-credentials /home/march/.secrets/cf.ini -d app.knrog.online -d "*.app.knrog.online"
```

## Deploy Backend (API Server)

```bash
# Clone repo
cd /opt
git clone YOUR_REPO knrog
cd knrog

# Install dependencies
curl -fsSL https://bun.sh/install | bash
bun install

# Setup database
sudo -u postgres psql
CREATE DATABASE knrog;
CREATE USER knroguser WITH PASSWORD 'secure_password';
GRANT ALL PRIVILEGES ON DATABASE knrog TO knroguser;
\q

# Push database schema
bun drizzle-kit push

# Create systemd service
sudo nano /etc/systemd/system/knrog.service
```

```ini
[Unit]
Description=Knrog Tunnel Service
After=network.target postgresql.service

[Service]
Type=simple
User=www-data
WorkingDirectory=/opt/knrog
Environment=NODE_ENV=production
ExecStart=/root/.bun/bin/bun run server/src/index.ts
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

```bash
sudo systemctl daemon-reload
sudo systemctl enable knrog
sudo systemctl start knrog
sudo systemctl status knrog
```

## Deploy Frontend (Web UI)

```bash
cd /opt/knrog/web
bun run build
sudo mkdir -p /var/www/knrog-web
sudo cp -r dist/* /var/www/knrog-web/
sudo chown -R www-data:www-data /var/www/knrog-web
```

## Environment Variables

Create `/opt/knrog/.env`:

```env
SERVER_PORT=9000
DOMAIN_CONNECTION=knrog.online
API_DOMAIN=api.knrog.online
DATABASE_URL=postgres://knroguser:secure_password@localhost:5432/knrog
JWT_SECRET=GENERATE_RANDOM_SECRET_HERE
RESEND_API_KEY=re_YOUR_RESEND_API_KEY
SENDER_EMAIL=noreply@knrog.online
FRONTEND_URL=https://knrog.online
FRONTEND_URL_DEV=http://localhost:5173
```

## Architecture

```
User Browser → knrog.online (Nginx) → Static Web UI
Developer CLI → api.knrog.online (Nginx) → Node Server (port 9000)
Public Access → *.knrog.online (Nginx) → Node Server → CLI → Local App
```

## Monitoring

```bash
sudo journalctl -u knrog -f      # View logs
sudo systemctl status knrog      # Check status
sudo systemctl restart knrog     # Restart
```
