#!/bin/bash

# Dead Man's Switch Production Deployment Script

echo "🚀 Starting Dead Man's Switch deployment..."

# Build the production Docker image
echo "📦 Building production Docker image..."
docker build -f Dockerfile.prod -t dead-mans-switch:latest .

if [ $? -eq 0 ]; then
    echo "✅ Docker image built successfully"
else
    echo "❌ Docker build failed"
    exit 1
fi

# Stop existing container if running
echo "🛑 Stopping existing container..."
docker stop dead-mans-switch 2>/dev/null || true
docker rm dead-mans-switch 2>/dev/null || true

# Run the new container
echo "🚀 Starting production container..."
docker run -d \
    --name dead-mans-switch \
    --restart unless-stopped \
    -p 4173:4173 \
    -e NODE_ENV=production \
    dead-mans-switch:latest

if [ $? -eq 0 ]; then
    echo "✅ Container started successfully"
    echo "🌐 Application is running at: http://localhost:4173"
    echo "📊 Container status:"
    docker ps --filter name=dead-mans-switch
else
    echo "❌ Failed to start container"
    exit 1
fi

echo "🎉 Deployment completed successfully!" 