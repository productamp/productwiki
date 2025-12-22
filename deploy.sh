#!/bin/bash

# Deployment script for ProductQ to GCP production server
# Usage: ./deploy.sh

set -e  # Exit on any error

echo "🚀 Starting deployment to q.productamp.io..."

# Configuration
SERVER="q.productamp.io"
USER="ai"
SSH_KEY="$HOME/.ssh/google_compute_engine"
APP_DIR="/opt/productq"
BRANCH="productamp/cloud-hosting"

# Step 1: Build locally
echo "📦 Building frontend locally..."
npm run build

# Step 2: Commit and push changes
echo "📤 Pushing to GitHub..."
git add .
if git diff --cached --quiet; then
  echo "ℹ️  No changes to commit"
else
  echo "Enter commit message:"
  read -r commit_message
  git commit -m "$commit_message"
fi
git push origin "$BRANCH"

# Step 3: Deploy to server
echo "🌐 Deploying to production server..."
ssh -i "$SSH_KEY" "$USER@$SERVER" "cd $APP_DIR && git pull origin $BRANCH && npm run build"

echo "✅ Deployment complete!"
echo "🔗 Visit https://q.productamp.io to see your changes"
