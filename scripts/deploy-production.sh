#!/bin/bash
set -e

# ProductQ Production Deployment Script
# Deploys to: https://q.productamp.io

INSTANCE_NAME="productq-demo"
ZONE="us-central1-a"
REMOTE_PATH="/opt/productq"

echo "=== ProductQ Production Deployment ==="
echo ""

# Check if gcloud is available
if ! command -v gcloud &> /dev/null; then
    echo "Error: gcloud CLI is not installed"
    exit 1
fi

# Get the project root directory (parent of scripts/)
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

echo "[1/6] Building frontend..."
npm run build

echo ""
echo "[2/6] Packaging server (excluding node_modules)..."
tar --exclude='node_modules' -czf /tmp/productq-server.tar.gz server

echo ""
echo "[3/6] Packaging frontend build..."
tar -czf /tmp/productq-dist.tar.gz dist

echo ""
echo "[4/6] Uploading to $INSTANCE_NAME..."
gcloud compute scp /tmp/productq-server.tar.gz "$INSTANCE_NAME:$REMOTE_PATH/" --zone="$ZONE"
gcloud compute scp /tmp/productq-dist.tar.gz "$INSTANCE_NAME:$REMOTE_PATH/" --zone="$ZONE"

echo ""
echo "[5/6] Extracting and installing dependencies on server..."
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="
  cd $REMOTE_PATH &&
  rm -rf server dist &&
  tar -xzf productq-server.tar.gz 2>/dev/null &&
  tar -xzf productq-dist.tar.gz 2>/dev/null &&
  rm -f *.tar.gz ._* &&
  cd server && npm install --production --silent
"

echo ""
echo "[6/6] Restarting service..."
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="sudo systemctl restart productq"

# Cleanup local temp files
rm -f /tmp/productq-server.tar.gz /tmp/productq-dist.tar.gz

echo ""
echo "=== Deployment Complete ==="
echo ""
echo "Site: https://q.productamp.io"
echo ""

# Verify the service is running
echo "Checking service status..."
gcloud compute ssh "$INSTANCE_NAME" --zone="$ZONE" --command="sudo systemctl is-active productq"
