# ProductQ - Claude Code Instructions

## Project Overview

ProductQ is a RAG-powered codebase documentation and Q&A tool. It indexes GitHub repositories and allows users to ask questions about the code using natural language.

## Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS + shadcn/ui
- **Backend**: Hono.js (Node.js)
- **Vector Database**: LanceDB
- **LLM Provider**: Google Gemini API

## Design System

Always use [shadcn/ui](https://ui.shadcn.com/) components as the default for all UI elements. Components are located in `src/components/ui/`. When adding new UI functionality, first check if shadcn has a component for it and install it using `npx shadcn@latest add <component>`.

## Local Development

```bash
# Install dependencies
npm install
cd server && npm install

# Configure environment
cd server
cp .env.example .env
# Edit .env with your GOOGLE_API_KEY

# Start backend (from server/)
npm run dev

# Start frontend (from root)
npm run dev
```

## Production Deployment

### Current Production

- **URL**: https://q.productamp.io
- **Instance**: `productq-demo` (GCP e2-micro)
- **Zone**: `us-central1-a`
- **IP**: `35.232.221.160`

### Deploy to Production

Use the deploy script to publish changes:

```bash
./scripts/deploy-production.sh
```

This script will:
1. Build the frontend locally
2. Package server and dist (excluding node_modules)
3. Upload to the GCP instance
4. Install dependencies on server
5. Restart the application service

### Manual Deployment Steps

If you need to deploy manually:

```bash
# 1. Build frontend locally (e2-micro has limited RAM)
npm run build

# 2. Package and upload (excludes node_modules)
tar --exclude='node_modules' -czf /tmp/productq-server.tar.gz server
tar -czf /tmp/productq-dist.tar.gz dist
gcloud compute scp /tmp/productq-server.tar.gz productq-demo:/opt/productq/ --zone=us-central1-a
gcloud compute scp /tmp/productq-dist.tar.gz productq-demo:/opt/productq/ --zone=us-central1-a

# 3. Extract and install on server
gcloud compute ssh productq-demo --zone=us-central1-a --command="
  cd /opt/productq &&
  rm -rf server dist &&
  tar -xzf productq-server.tar.gz &&
  tar -xzf productq-dist.tar.gz &&
  rm -f *.tar.gz &&
  cd server && npm install --production
"

# 4. Restart the service
gcloud compute ssh productq-demo --zone=us-central1-a --command="sudo systemctl restart productq"
```

### Fresh Server Setup

To set up a new GCP instance from scratch:

#### 1. Create Instance

```bash
gcloud compute instances create productq-demo \
  --machine-type=e2-micro \
  --zone=us-central1-a \
  --image-family=debian-12 \
  --image-project=debian-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --tags=http-server,https-server
```

#### 2. Configure Firewall (if not already done)

```bash
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 \
  --target-tags http-server

gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --target-tags https-server
```

#### 3. Install Server Dependencies

```bash
gcloud compute ssh productq-demo --zone=us-central1-a --command="
  sudo apt update &&
  sudo apt install -y curl git nginx certbot python3-certbot-nginx &&
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash - &&
  sudo apt install -y nodejs
"
```

#### 4. Create Application Directory

```bash
gcloud compute ssh productq-demo --zone=us-central1-a --command="
  sudo mkdir -p /opt/productq &&
  sudo chown \$USER:\$USER /opt/productq
"
```

#### 5. Deploy Application

Run the deploy script or follow manual deployment steps above.

#### 6. Configure Environment Variables

```bash
gcloud compute ssh productq-demo --zone=us-central1-a --command="
  cat > /opt/productq/server/.env << 'EOF'
LLM_PROVIDER=gemini
GOOGLE_API_KEY=your_api_key_here
PORT=3847
EOF"
```

#### 7. Create Systemd Service

```bash
gcloud compute ssh productq-demo --zone=us-central1-a --command="
  sudo tee /etc/systemd/system/productq.service > /dev/null << 'EOF'
[Unit]
Description=ProductQ Application
After=network.target

[Service]
Type=simple
User=ai
WorkingDirectory=/opt/productq/server
ExecStart=/usr/bin/node src/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

  sudo systemctl daemon-reload &&
  sudo systemctl enable productq &&
  sudo systemctl start productq
"
```

#### 8. Configure Nginx

```bash
gcloud compute ssh productq-demo --zone=us-central1-a --command="
  sudo tee /etc/nginx/sites-available/productq > /dev/null << 'EOF'
map \$http_upgrade \$connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name q.productamp.io;

    location / {
        proxy_pass http://127.0.0.1:3847;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$connection_upgrade;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;

        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        send_timeout 600s;

        proxy_buffering off;
        proxy_cache off;
    }
}
EOF

  sudo ln -sf /etc/nginx/sites-available/productq /etc/nginx/sites-enabled/ &&
  sudo rm -f /etc/nginx/sites-enabled/default &&
  sudo nginx -t &&
  sudo systemctl restart nginx
"
```

#### 9. Configure DNS

Add an A record in your DNS provider:
- **Type**: A
- **Name**: `q`
- **Value**: (instance external IP)

#### 10. Set Up SSL

```bash
gcloud compute ssh productq-demo --zone=us-central1-a --command="
  sudo certbot --nginx -d q.productamp.io --non-interactive --agree-tos --email admin@productamp.io --redirect
"
```

## Server Management

### View Logs

```bash
gcloud compute ssh productq-demo --zone=us-central1-a --command="journalctl -u productq -f"
```

### Restart Service

```bash
gcloud compute ssh productq-demo --zone=us-central1-a --command="sudo systemctl restart productq"
```

### Check Status

```bash
gcloud compute ssh productq-demo --zone=us-central1-a --command="sudo systemctl status productq"
```

### SSH into Server

```bash
gcloud compute ssh productq-demo --zone=us-central1-a
```

## Important Notes

- **Build locally**: The e2-micro instance has only 1GB RAM, insufficient for frontend builds
- **Vector storage**: LanceDB stores data at `~/.productwiki/vectors/` and `~/.productwiki/meta/`
- **SSL auto-renewal**: Certbot timer handles certificate renewal automatically
- **Timeouts**: Nginx configured with 10-minute timeouts for large repository indexing
