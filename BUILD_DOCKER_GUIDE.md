# Building Docker Images from Source

This guide shows how to build the entire BoundDel system as Docker images from source code.

## Prerequisites

- Docker installed and running
- Source code with Delineate-Anything model
- At least 10GB free disk space

## Quick Build

### Automated Script

```bash
# Make script executable
chmod +x build_docker.sh

# Build with default settings (adibsuid/bounddel:latest)
./build_docker.sh

# Build with custom username and version
./build_docker.sh myusername v1.0
```

## Manual Build Process

### 1. Build Backend Image

```bash
docker build -f Dockerfile.backend -t adibsuid/bounddel-backend:latest .
```

**Build time**: 10-20 minutes (first build)
**Image size**: ~2-3 GB

The backend image includes:
- Python 3.10
- PyTorch and ML dependencies
- GDAL for GIS operations
- Delineate-Anything model
- FastAPI backend code

### 2. Build Frontend Image

```bash
docker build -f Dockerfile.frontend -t adibsuid/bounddel-frontend:latest .
```

**Build time**: 2-5 minutes
**Image size**: ~200-300 MB

The frontend image includes:
- Node.js 18
- Next.js application
- All npm dependencies
- Production build

### 3. Tag Images (Optional)

```bash
# Tag with version number
docker tag adibsuid/bounddel-backend:latest adibsuid/bounddel-backend:v1.0
docker tag adibsuid/bounddel-frontend:latest adibsuid/bounddel-frontend:v1.0

# Tag with date
docker tag adibsuid/bounddel-backend:latest adibsuid/bounddel-backend:$(date +%Y%m%d)
docker tag adibsuid/bounddel-frontend:latest adibsuid/bounddel-frontend:$(date +%Y%m%d)
```

## Build Options

### No Cache Build (Fresh Build)

```bash
# Backend
docker build --no-cache -f Dockerfile.backend -t adibsuid/bounddel-backend:latest .

# Frontend
docker build --no-cache -f Dockerfile.frontend -t adibsuid/bounddel-frontend:latest .
```

### Build with Progress

```bash
docker build --progress=plain -f Dockerfile.backend -t adibsuid/bounddel-backend:latest .
```

### Build with Resource Limits

```bash
# Limit CPU and memory during build
docker build \
  --memory=4g \
  --cpu-period=100000 \
  --cpu-quota=200000 \
  -f Dockerfile.backend \
  -t adibsuid/bounddel-backend:latest \
  .
```

## Verify Built Images

### List Images

```bash
docker images | grep bounddel
```

Expected output:
```
adibsuid/bounddel-backend    latest    abc123def456    2 minutes ago    2.5GB
adibsuid/bounddel-frontend   latest    def789ghi012    1 minute ago     250MB
```

### Inspect Image Details

```bash
# Backend details
docker inspect adibsuid/bounddel-backend:latest

# Frontend details
docker inspect adibsuid/bounddel-frontend:latest
```

### Check Image Layers

```bash
docker history adibsuid/bounddel-backend:latest
docker history adibsuid/bounddel-frontend:latest
```

## Test Built Images

### Test Backend

```bash
# Run backend
docker run -d \
  --name test-backend \
  -p 8000:8000 \
  -e PYTHONPATH=/app/Delineate-Anything \
  adibsuid/bounddel-backend:latest

# Check logs
docker logs test-backend

# Test API
curl http://localhost:8000/

# Cleanup
docker stop test-backend && docker rm test-backend
```

### Test Frontend

```bash
# Run frontend
docker run -d \
  --name test-frontend \
  -p 3000:3000 \
  adibsuid/bounddel-frontend:latest

# Check logs
docker logs test-frontend

# Test in browser
# Open http://localhost:3000

# Cleanup
docker stop test-frontend && docker rm test-frontend
```

### Test Full Stack

```bash
# Using docker-compose
docker-compose up

# OR using run script
./run_docker.sh
```

## Optimize Build

### Multi-stage Build (Already Optimized)

The Dockerfiles use multi-stage builds where possible to minimize image size.

### Use .dockerignore

The `.dockerignore` file excludes unnecessary files:
- node_modules
- Python cache
- Test files
- Development files

### Layer Caching

To speed up rebuilds:
1. Dependencies are installed first (cached)
2. Code is copied last (changes frequently)

## Troubleshooting

### Build Fails - Out of Space

```bash
# Clean up Docker
docker system prune -a

# Remove old images
docker images | grep bounddel | awk '{print $3}' | xargs docker rmi
```

### Build Fails - Memory Error

```bash
# Increase Docker memory limit
# Docker Desktop > Settings > Resources > Memory: 8GB

# Or build with limits
docker build --memory=4g -f Dockerfile.backend -t adibsuid/bounddel-backend:latest .
```

### Build Fails - Network Timeout

```bash
# Increase timeout
export DOCKER_BUILDKIT=1
export BUILDKIT_PROGRESS=plain

docker build -f Dockerfile.backend -t adibsuid/bounddel-backend:latest .
```

### Build Fails - Missing Delineate-Anything

```bash
# Make sure Delineate-Anything directory exists
ls -la Delineate-Anything

# If missing, clone it
git clone https://github.com/your-repo/Delineate-Anything.git
```

### Slow Build

```bash
# Use BuildKit for faster builds
export DOCKER_BUILDKIT=1

# Parallel builds
docker build -f Dockerfile.backend -t adibsuid/bounddel-backend:latest . &
docker build -f Dockerfile.frontend -t adibsuid/bounddel-frontend:latest . &
wait
```

## Clean Up

### Remove Built Images

```bash
# Remove specific images
docker rmi adibsuid/bounddel-backend:latest
docker rmi adibsuid/bounddel-frontend:latest

# Remove all bounddel images
docker images | grep bounddel | awk '{print $3}' | xargs docker rmi
```

### Remove Build Cache

```bash
docker builder prune
```

### Complete Cleanup

```bash
# Remove everything (use with caution!)
docker system prune -a --volumes
```

## Build Pipeline

For CI/CD, you can automate builds:

```bash
# Build script
#!/bin/bash
VERSION=$(date +%Y%m%d)

docker build -f Dockerfile.backend -t myrepo/bounddel-backend:$VERSION .
docker build -f Dockerfile.frontend -t myrepo/bounddel-frontend:$VERSION .

docker push myrepo/bounddel-backend:$VERSION
docker push myrepo/bounddel-frontend:$VERSION
```

## Dockerfile Details

### Backend Dockerfile Structure

```dockerfile
FROM python:3.10-slim          # Base image
COPY Delineate-Anything/       # Copy model
COPY backend/                  # Copy backend code
RUN pip install dependencies   # Install Python packages
CMD uvicorn main:app           # Start server
```

### Frontend Dockerfile Structure

```dockerfile
FROM node:18-alpine            # Base image
COPY frontend/package*.json    # Copy package files
RUN npm ci                     # Install dependencies
COPY frontend/                 # Copy frontend code
RUN npm run build              # Build Next.js
CMD npm start                  # Start production server
```

## Next Steps

After building:

1. **Test locally**: `./run_docker.sh`
2. **Push to registry**: `./push_to_dockerhub.sh`
3. **Deploy**: Use built images in production

## Image Size Optimization

Current sizes:
- Backend: ~2.5 GB (includes PyTorch, GDAL, model)
- Frontend: ~250 MB (Next.js production build)

To reduce size:
- Use smaller base images (alpine)
- Remove development dependencies
- Compress model files
- Use external model storage
