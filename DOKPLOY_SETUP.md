# Dokploy Deployment Setup for Knrog

## Architecture

- **Landing Page**: `knrog.online` - Marketing/public site from `/web` folder
- **App Dashboard**: `app.knrog.online` - Full featured app (authenticated) from `/web` folder
- **Backend (API)**: `api.knrog.online` - Bun server from root folder
- **Tunnel Subdomains**: `*.knrog.online` - User tunnels (handled by backend)

## Step-by-Step Setup

### 1. DNS Configuration

In your DNS provider (Cloudflare, Namecheap, etc.), add these A records pointing to your Dokploy server IP:

```
A     @              YOUR_SERVER_IP
A     *              YOUR_SERVER_IP
A     api            YOUR_SERVER_IP
A     app            YOUR_SERVER_IP
```

### 2. Deploy Backend (API)

1. In Dokploy, create a new **Application**
2. Select **Git** as source
3. Configure:
   - **Repository**: Your git repo URL
   - **Branch**: main (or your branch)
   - **Build Type**: Dockerfile
   - **Dockerfile Path**: `./Dockerfile`
   - **Port**: `8080`

4. **Domain Settings**:
   - Add domain: `api.knrog.online`
   - Enable SSL (Let's Encrypt)

5. **Environment Variables**:
   ```env
   SERVER_PORT=8080
   DOMAIN_CONNECTION=app.knrog.online
   API_DOMAIN=api.knrog.online
   DATABASE_URL=postgres://username:password@host:5432/knrog
   JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
   RESEND_API_KEY=re_YOUR_RESEND_API_KEY
   SENDER_EMAIL=onboarding@resend.dev
   FRONTEND_URL=https://app.knrog.online
   FRONTEND_URL_DEV=http://localhost:5173
   LANDING_URL=https://knrog.online
   FLUTTERWAVE_PUBLIC_KEY=your-key
   FLUTTERWAVE_SECRET_KEY=your-secret
   FLUTTERWAVE_WEBHOOK_SECRET=your-webhook
   ```

6. **Deploy** the backend

### 3. Deploy Frontend (Web)

1. Create another **Application** in Dokploy
2. Configure:
   - **Repository**: Same repo
   - **Branch**: main
   - **Build Type**: Nixpacks or Dockerfile
   - **Root Directory**: `/web`
   - **Port**: `5173` (or production port)

3. **Domain Settings**:
   - Add domain: `knrog.online` (landing page)
   - Add domain: `app.knrog.online` (full app)
   - Enable SSL (Let's Encrypt) for both

4. **Environment Variables** (in `/web` if needed):
   ```env
   VITE_API_URL=https://api.knrog.online
   ```

5. Create a Dockerfile in `/web` folder:
   ```dockerfile
   FROM oven/bun:1.1.5
   WORKDIR /app
   COPY package.json bun.lock ./
   RUN bun install
   COPY . .
   RUN bun run build
   EXPOSE 5173
   CMD ["bun", "run", "preview", "--host", "0.0.0.0", "--port", "5173"]
   ```

6. **Deploy** the frontend

### 4. Database Setup (PostgreSQL)

In Dokploy:
1. Create a new **Postgres** database service
2. Note the connection details
3. Update backend's `DATABASE_URL` with the connection string

### 5. Wildcard SSL for Subdomains

For `*.knrog.online` to work with SSL:

1. In your DNS, ensure the `*` A record exists
2. Dokploy should automatically handle Let's Encrypt wildcard certificates
3. If not, you may need to configure Traefik manually or use Cloudflare proxy

### 6. Testing

After deployment:

1. Visit `https://knrog.online` → Should show landing page
2. Visit `https://app.knrog.online` → Should show full app/dashboard
3. Visit `https://api.knrog.online` → Should show API response
4. Visit `https://api.knrog.online/api/health` → Should return `{"status":"ok"}`
5. Create a tunnel subdomain to test user tunnels

## Alternative: Single Deployment

If you prefer a single deployment serving both frontend and backend:

1. Build frontend as static files
2. Serve them from the backend using Express static middleware
3. Only deploy the backend with frontend built inside

Add to backend `index.ts`:
```typescript
import path from "path";

// Serve frontend static files (after building web/)
app.use(express.static(path.join(__dirname, '../../web/dist')));

// Catch-all route for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../../web/dist/index.html'));
});
```

## Troubleshooting

- **502 Bad Gateway**: Check if services are running and ports match
- **Tunnel not working**: Verify `DOMAIN_CONNECTION` environment variable
- **CORS errors**: Check `FRONTEND_URL` matches your actual frontend domain
- **Database connection failed**: Verify `DATABASE_URL` and database is running
