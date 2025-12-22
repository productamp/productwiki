# ProductQ

A RAG-powered codebase documentation and Q&A tool that allows you to index GitHub repositories and ask questions about the code.

## Features

- Index GitHub repositories using vector embeddings (LanceDB)
- Ask questions about your codebase using natural language
- Retrieval-Augmented Generation (RAG) for accurate, context-aware answers
- Support for multiple LLM models via Google Gemini API
- Real-time streaming responses using Server-Sent Events (SSE)
- Local vector storage with persistent metadata

## Tech Stack

- **Frontend**: React + TypeScript + Vite + TailwindCSS
- **Backend**: Hono.js (Node.js)
- **Vector Database**: LanceDB
- **LLM Provider**: Google Gemini API
- **Embeddings**: Google text-embedding models

## Local Development

### Prerequisites

- Node.js 18+
- npm or yarn
- Google API key with access to Gemini API

### Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd albany
```

2. Install dependencies for both frontend and backend:
```bash
npm install
cd server && npm install
```

3. Configure environment variables:
```bash
cd server
cp .env.example .env
# Edit .env and add your GOOGLE_API_KEY
```

4. Start the development servers:

**Backend** (from `server/` directory):
```bash
npm run dev
```

**Frontend** (from root directory):
```bash
npm run dev
```

5. Open your browser to `http://localhost:5173`

## Deployment to Google Cloud Platform

This section provides step-by-step instructions for deploying ProductQ to Google Cloud Platform using the free e2-micro instance.

### Prerequisites

- Google Cloud account
- Domain name with DNS access (for HTTPS setup)
- `gcloud` CLI installed and authenticated

### Step 1: Install and Configure gcloud CLI

```bash
# Install gcloud CLI (macOS)
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize and authenticate
gcloud init
gcloud auth login
```

### Step 2: Create Compute Engine Instance

Create a free-tier e2-micro instance in a European region:

```bash
gcloud compute instances create productq \
  --zone=europe-west1-b \
  --machine-type=e2-micro \
  --image-family=ubuntu-2204-lts \
  --image-project=ubuntu-os-cloud \
  --boot-disk-size=30GB \
  --boot-disk-type=pd-standard \
  --tags=http-server,https-server
```

### Step 3: Configure Firewall Rules

Allow HTTP, HTTPS, and application traffic:

```bash
# Allow HTTP (port 80)
gcloud compute firewall-rules create allow-http \
  --allow tcp:80 \
  --target-tags http-server \
  --description="Allow HTTP traffic"

# Allow HTTPS (port 443)
gcloud compute firewall-rules create allow-https \
  --allow tcp:443 \
  --target-tags https-server \
  --description="Allow HTTPS traffic"

# Allow application port (3847)
gcloud compute firewall-rules create allow-productq \
  --allow tcp:3847 \
  --target-tags http-server \
  --description="Allow ProductQ application traffic"
```

### Step 4: Install Dependencies on Server

SSH into the instance and install required software:

```bash
# SSH into instance
gcloud compute ssh productq --zone=europe-west1-b

# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install Git
sudo apt install -y git

# Install Nginx
sudo apt install -y nginx

# Install Certbot for SSL certificates
sudo apt install -y certbot python3-certbot-nginx
```

### Step 5: Clone and Build Application

```bash
# Create application directory
sudo mkdir -p /opt/productq
sudo chown $USER:$USER /opt/productq

# Clone repository
cd /opt/productq
git clone <your-repository-url> .

# Install server dependencies
cd server
npm install

# Note: Build frontend locally (not on e2-micro due to RAM constraints)
# On your local machine:
# npm run build
# Then copy dist folder to server (see next step)
```

### Step 6: Deploy Frontend Build

Build the frontend locally and copy to server:

```bash
# On your local machine
npm run build

# Copy dist folder to server
gcloud compute scp --recurse dist/* productq:/opt/productq/dist/ --zone=europe-west1-b
```

### Step 7: Configure Environment Variables

```bash
# SSH into server
gcloud compute ssh productq --zone=europe-west1-b

# Create .env file in server directory
cd /opt/productq/server
nano .env

# Add the following:
# GOOGLE_API_KEY=your_google_api_key_here
# PORT=3847
```

### Step 8: Set Up Systemd Service

Create a systemd service for automatic startup and restarts:

```bash
sudo nano /etc/systemd/system/productq.service
```

Add the following configuration:

```ini
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
```

Enable and start the service:

```bash
sudo systemctl daemon-reload
sudo systemctl enable productq
sudo systemctl start productq
sudo systemctl status productq
```

### Step 9: Configure Nginx Reverse Proxy

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/productq
```

Add the following configuration:

```nginx
map $http_upgrade $connection_upgrade {
    default upgrade;
    '' close;
}

server {
    listen 80;
    server_name q.productamp.io;  # Replace with your domain

    location / {
        proxy_pass http://127.0.0.1:3847;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection $connection_upgrade;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts for large repository indexing
        proxy_connect_timeout 600s;
        proxy_send_timeout 600s;
        proxy_read_timeout 600s;
        send_timeout 600s;

        # Disable buffering for SSE
        proxy_buffering off;
        proxy_cache off;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/productq /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx
```

### Step 10: Set Up DNS Records

In your DNS provider (e.g., Cloudflare):

1. Add an A record pointing to your instance's external IP:
   - Type: `A`
   - Name: `q` (or your subdomain)
   - Value: `<EXTERNAL_IP>` (get from `gcloud compute instances list`)
   - Proxy: Disabled (for Let's Encrypt verification)

### Step 11: Configure SSL with Let's Encrypt

```bash
# Obtain SSL certificate
sudo certbot --nginx -d q.productamp.io  # Replace with your domain

# Follow prompts:
# - Enter email address
# - Agree to terms
# - Choose to redirect HTTP to HTTPS (option 2)

# Test automatic renewal
sudo certbot renew --dry-run
```

Certbot will automatically update your Nginx configuration to use HTTPS.

### Step 12: Verify Deployment

1. Check that the service is running:
```bash
sudo systemctl status productq
```

2. Check Nginx status:
```bash
sudo systemctl status nginx
```

3. View application logs:
```bash
journalctl -u productq -f
```

4. Visit your domain (e.g., `https://q.productamp.io`)

### Updating the Application

When you make changes to the code:

1. **Backend changes**:
```bash
gcloud compute ssh productq --zone=europe-west1-b
cd /opt/productq
git pull
cd server && npm install
sudo systemctl restart productq
```

2. **Frontend changes**:
```bash
# On your local machine
npm run build
gcloud compute scp --recurse dist/* productq:/opt/productq/dist/ --zone=europe-west1-b
# No restart needed - static files are served directly
```

### Important Notes

- **Build locally**: The e2-micro instance has only 1GB RAM, which is insufficient for building the frontend. Always build locally and copy the dist folder.
- **Timeouts**: Large repositories may take several minutes to index. The Nginx timeouts are set to 10 minutes to accommodate this.
- **Vector storage**: LanceDB stores vectors at `~/.productwiki/vectors/` and metadata at `~/.productwiki/meta/`
- **IPv4 vs IPv6**: Nginx proxy_pass uses `127.0.0.1` (IPv4) instead of `localhost` to avoid IPv6 resolution issues
- **Default LLM model**: Set to `gemma-3-27b-it` in `server/src/config/index.js`
- **GitHub API timeout**: Set to 300 seconds (5 minutes) for large repositories

### Troubleshooting

**Service won't start**:
```bash
journalctl -u productq -n 50 --no-pager
```

**Nginx errors**:
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```

**Port conflicts**:
```bash
sudo lsof -i :3847
sudo lsof -i :80
```

**SSL certificate renewal**:
```bash
sudo certbot renew
sudo systemctl restart nginx
```

## Configuration

### LLM Model Selection

Edit `server/src/config/index.js` to change the default LLM model:

```javascript
llmModel: 'gemma-3-27b-it',  // or 'gemini-3-flash-preview', etc.
```

### Timeout Configuration

For large repositories, adjust timeouts in:

- **GitHub API**: `server/src/services/github.js` (default: 300 seconds)
- **Nginx**: `/etc/nginx/sites-available/productq` (default: 600 seconds)

## License

MIT
