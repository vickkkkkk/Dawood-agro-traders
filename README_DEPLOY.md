# Dawood AGRO TRADERS — VPS Deployment Guide

This document explains how to deploy the POS system onto a low-cost Hetzner VPS using your Namecheap domain and secure HTTPS.

---

## Architecture of Deployment

The system is configured as a single-container service:
1. **React App** is built and served as static content directly by the **Node.js/Express Server**.
2. **PostgreSQL** runs alongside in a second Docker container with persistent volume storage.
3. **Caddy** acts as a reverse proxy on the host VPS, automatically obtaining and renewing SSL certificates for your Namecheap domain.

Total Server Cost: **€4.49 / month** (Hetzner Cloud VPS CX22 - 2 vCPU, 4GB RAM).

---

## Step 1: Configure DNS on Namecheap

1. Log in to your **Namecheap Dashboard**.
2. Go to your domain list and select **Manage** for your domain.
3. Click on the **Advanced DNS** tab.
4. Add a new **A Record**:
   - **Host**: `@`
   - **Value**: `YOUR_HETZNER_VPS_IP`
   - **TTL**: `Automatic` (or 5 min)
5. Add a **CNAME Record** (Optional, for `www` prefix):
   - **Host**: `www`
   - **Value**: `yourdomain.com` (your root domain)
   - **TTL**: `Automatic`

*Note: DNS propagation can take from 5 minutes to a few hours.*

---

## Step 2: Set Up Hetzner VPS (Ubuntu Server)

Create a VPS on Hetzner Console (e.g., CX22 with Ubuntu 24.04). SSH into your server:

```bash
ssh root@YOUR_HETZNER_VPS_IP
```

Update system packages:

```bash
sudo apt update && sudo apt upgrade -y
```

---

## Step 3: Install Docker & Docker Compose

Run the official installation script:

```bash
# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose Plugin
sudo apt install docker-compose-plugin -y
```

Verify installation:

```bash
docker --version
docker compose version
```

---

## Step 4: Clone Project and Set Env Variables

Copy your project code to `/var/www/dawood-agro-traders` on the VPS. 

Create a production `.env` file in the project root:

```bash
# /var/www/dawood-agro-traders/.env
DATABASE_URL="postgresql://postgres:postgres_secure_pass@db:5432/dawood_agro_traders?schema=public"
JWT_SECRET="generate_a_very_long_secure_random_string_here"
JWT_EXPIRES_IN="24h"
PORT=5000
NODE_ENV=production
CORS_ORIGIN="https://yourdomain.com"
```

Update your `Caddyfile` with your domain:

```caddyfile
yourdomain.com {
    reverse_proxy localhost:5000
    encode gzip zstd
}
```

---

## Step 5: Launch the Application

From the root directory (`/var/www/dawood-agro-traders`), build and start the containers in detached mode:

```bash
docker compose up --build -d
```

Check logs to verify the database and app started correctly:

```bash
docker compose logs -f app
```

Run the database migrations and seed the default admin account:

```bash
docker compose exec app npx prisma migrate deploy
docker compose exec app npm run seed
```

*Default admin details:*
- **Email:** `admin@dawoodagro.com`
- **Password:** `admin123`

*(Note: Change this password immediately after your first login via the User Management screen.)*

---

## Step 6: Set Up Caddy (Reverse Proxy & Free SSL)

Install Caddy on the host VPS:

```bash
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install caddy -y
```

Move the `Caddyfile` to Caddy's configuration directory:

```bash
sudo cp Caddyfile /etc/caddy/Caddyfile
```

Restart Caddy to apply config:

```bash
sudo systemctl restart caddy
```

Caddy will automatically contact Let's Encrypt, verify your Namecheap DNS A record, obtain a secure SSL certificate, and serve your POS system over **HTTPS**!

Navigate to `https://yourdomain.com` in your browser. You should see the login screen of **Dawood AGRO TRADERS**!
