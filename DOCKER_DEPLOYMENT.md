# QuestLearn — Docker deployment (Hostinger VPS)

This guide deploys the existing QuestLearn MERN app with Docker Compose:

```text
Internet → Nginx (client container) → Express API (server) → MongoDB
                 ↑
         /api, /uploads, /socket.io proxied
```

Uploaded book covers and private PDFs are stored in named Docker volumes so they survive container restarts. MongoDB data uses a separate named volume.

---

## 1. VPS preparation

On an Ubuntu/Debian Hostinger VPS:

```bash
sudo apt update
sudo apt upgrade -y
sudo apt install -y ca-certificates curl git
```

Install Docker Engine + Compose plugin (official docs method):

```bash
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
```

Log out and back in, then verify:

```bash
docker --version
docker compose version
```

Open firewall ports (HTTP/HTTPS only — do **not** expose MongoDB):

```bash
sudo ufw allow OpenSSH
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

---

## 2. Clone the project

```bash
git clone <YOUR_REPOSITORY_URL>
cd <YOUR_PROJECT_FOLDER>
```

---

## 3. Configure environment

```bash
cp .env.example .env
nano .env
```

### Required production values

| Variable | Purpose |
|----------|---------|
| `CLIENT_ORIGIN` | Public site URL, e.g. `https://yourdomain.com` (no trailing slash) |
| `CLIENT_URL` | Same as `CLIENT_ORIGIN` |
| `JWT_ACCESS_SECRET` | Long random secret (32+ chars) |
| `JWT_REFRESH_SECRET` | Different long random secret |
| `COOKIE_SECURE` | `true` when using HTTPS |
| `HTTP_PORT` | Host port for Nginx (`80` on VPS if no outer proxy) |
| `MONGO_DB_NAME` | Mongo database name (default `LMSAI`) |

Optional AI keys (`OPENAI_API_KEY`, `GEMINI_API_KEY`, etc.) — leave blank and set `AI_PROVIDER=mock` if unused.

**Never commit `.env`.** Vite does not need `VITE_*` secrets; the browser calls `/api/v1` on the same origin.

### Local Docker smoke test

```env
CLIENT_ORIGIN=http://localhost:8080
CLIENT_URL=http://localhost:8080
HTTP_PORT=8080
COOKIE_SECURE=false
```

### Production HTTPS example

```env
CLIENT_ORIGIN=https://yourdomain.com
CLIENT_URL=https://yourdomain.com
HTTP_PORT=80
COOKIE_SECURE=true
```

---

## 4. Build and start

```bash
docker compose build
docker compose up -d
docker compose ps
docker compose logs -f
```

Expected services:

- `questlearn-mongo` — healthy
- `questlearn-server` — healthy (`/api/v1/health`)
- `questlearn-client` — Nginx on `HTTP_PORT`

Open: `http://YOUR_SERVER_IP:8080` (or port 80 / your domain).

---

## 5. Seed demo data (first deploy only)

The Mongo volume starts empty. Seed **without** wiping volumes:

```bash
docker compose exec server npm run seed:ensure
docker compose exec server npm run seed:canonical
docker compose exec server npm run seed:catalog
```

Demo logins (password `Password123!`):

- `student@library.com`
- `librarian@library.com`
- `admin@library.com`

Avoid `npm run seed` (full wipe) on a live database unless you intentionally want a reset.

---

## 6. Domain + HTTPS

1. Point DNS `A` record for `yourdomain.com` to the VPS IP.
2. Prefer terminating TLS with Certbot on the host **or** Hostinger’s reverse proxy in front of Docker.

### Option A — Certbot reverse proxy on the host

Keep Compose on `HTTP_PORT=8080` and proxy:

```nginx
# host nginx example
server {
  listen 80;
  server_name yourdomain.com;
  return 301 https://$host$request_uri;
}

server {
  listen 443 ssl http2;
  server_name yourdomain.com;
  # ssl_certificate ... (certbot)

  location / {
    proxy_pass http://127.0.0.1:8080;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto https;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    client_max_body_size 45m;
  }
}
```

Then set in `.env`:

```env
CLIENT_ORIGIN=https://yourdomain.com
CLIENT_URL=https://yourdomain.com
COOKIE_SECURE=true
```

Restart:

```bash
docker compose up -d
```

Do **not** put private SSL keys into Git or Docker images.

---

## 7. Architecture notes

| Concern | Implementation |
|---------|----------------|
| Frontend | Multi-stage Vite build → Nginx |
| Backend | Node `npm start`, listens on `0.0.0.0:5000` |
| Mongo | `mongodb://mongo:27017/...` on Docker network |
| API path | Browser → `/api/v1/...` → Nginx → `server:5000` |
| Uploads | Volume `lms_uploads` → `/app/server/uploads` |
| Private PDFs | Volume `lms_private_pdfs` → `/app/server/private-pdfs` |
| Mongo data | Volume `lms_mongo` |

MongoDB is **not** published to the host. The Express port is **not** published; only Nginx is.

Local Vite proxy (`127.0.0.1:5000`) is for development only and is unused in production images.

---

## 8. Day-2 operations

### Status / logs

```bash
docker compose ps
docker compose logs -f server
docker compose logs -f client
docker compose logs -f mongo
```

### Restart

```bash
docker compose restart
```

### Update after `git pull`

```bash
git pull
docker compose up -d --build
```

### Stop (keeps volumes / data)

```bash
docker compose down
```

### Recreate containers (still keeps volumes)

```bash
docker compose down
docker compose up -d --build
```

### Dangerous — deletes database and uploads

```bash
# DO NOT run on production unless you intend to wipe data
docker compose down -v
```

---

## 9. Backups

```bash
# Mongo dump
docker compose exec -T mongo mongodump --archive > mongo-backup-$(date +%F).archive

# Volume backup example (stop writes briefly if possible)
docker run --rm -v sah_lms_mongo:/data -v $(pwd):/backup alpine \
  tar czf /backup/lms_mongo.tgz -C /data .
```

Volume names may be prefixed with the Compose project directory name (e.g. `sah_lms_mongo`). Check with `docker volume ls`.

Also back up:

- `lms_uploads`
- `lms_private_pdfs`
- your `.env` file (store securely offline)

---

## 10. Troubleshooting

| Symptom | Check |
|---------|--------|
| `ECONNREFUSED 127.0.0.1:5000` in browser | Production must use Nginx `/api` proxy, not localhost. Rebuild client; confirm `docker compose ps` shows client healthy. |
| Backend cannot reach Mongo | `MONGODB_URI` must use host `mongo`, not `127.0.0.1`. |
| Login refresh fails / cookies | Set `CLIENT_ORIGIN` to the exact public URL; use `COOKIE_SECURE=true` only on HTTPS. |
| 413 on PDF upload | Nginx `client_max_body_size` is 45m; raise if needed. |
| Empty books | Run seed commands in section 5. |
| Permission errors on uploads | Volumes are owned by the image `node` user; recreate volumes only if corrupted. |

Health endpoint:

```bash
curl -s http://127.0.0.1:8080/api/v1/health
```

---

## 11. Quick Hostinger checklist

1. Install Docker + Compose  
2. Clone repo  
3. `cp .env.example .env` and set secrets + public URL  
4. `docker compose up -d --build`  
5. Seed catalog (first time)  
6. Point DNS + enable HTTPS  
7. Set `COOKIE_SECURE=true` and restart  
8. Verify login, books, read, PDF download, wishlist/cart, librarian inventory  

---

## 12. Local Windows note

If you develop on Windows and install Docker Desktop for the first time, complete the Docker Desktop first-run wizard (WSL2 / engine start) before `docker compose` will work. On the Hostinger Linux VPS, Docker Engine from `get.docker.com` does not need Docker Desktop.

Verify the frontend production build without Docker:

```bash
cd client && npm run build
```

---

## Exact VPS commands (copy/paste)

```bash
sudo apt update && sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo usermod -aG docker $USER
# re-login, then:
git clone <YOUR_REPOSITORY_URL>
cd <YOUR_PROJECT_FOLDER>
cp .env.example .env
nano .env   # set CLIENT_ORIGIN, JWT secrets, COOKIE_SECURE, HTTP_PORT
docker compose up -d --build
docker compose ps
docker compose exec server npm run seed:ensure
docker compose exec server npm run seed:canonical
docker compose exec server npm run seed:catalog
curl -s http://127.0.0.1:${HTTP_PORT:-8080}/api/v1/health
```
