# Docker Hub Deployment Instructions

## Prerequisites

1. Docker Desktop must be running
2. You need a Docker Hub account (https://hub.docker.com)

## Step-by-Step Instructions

### 1. Start Docker

```bash
# Make sure Docker is running
sudo systemctl start docker
# OR start Docker Desktop application
```

### 2. Login to Docker Hub

```bash
docker login
# Enter your Docker Hub username and password
```

### 3. Build Images

```bash
cd /home/kambing/Documents/bounddel-frontend

# Build backend
docker build -f Dockerfile.backend -t adibsuid/bounddel-backend:latest .
docker tag adibsuid/bounddel-backend:latest adibsuid/bounddel-backend:v1.0

# Build frontend
docker build -f Dockerfile.frontend -t adibsuid/bounddel-frontend:latest .
docker tag adibsuid/bounddel-frontend:latest adibsuid/bounddel-frontend:v1.0
```

### 4. Push to Docker Hub

```bash
# Push backend
docker push adibsuid/bounddel-backend:latest
docker push adibsuid/bounddel-backend:v1.0

# Push frontend
docker push adibsuid/bounddel-frontend:latest
docker push adibsuid/bounddel-frontend:v1.0
```

### 5. Verify Images

Visit Docker Hub:
- https://hub.docker.com/r/adibsuid/bounddel-backend
- https://hub.docker.com/r/adibsuid/bounddel-frontend

## Deploy from Docker Hub

Anyone can now pull and run your images:

```bash
# Pull images
docker pull adibsuid/bounddel-backend:latest
docker pull adibsuid/bounddel-frontend:latest

# Or use docker-compose
docker-compose -f docker-compose.hub.yml up
```

## Automated Script

Alternatively, use the automated script:

```bash
# Make executable
chmod +x push_to_dockerhub.sh

# Run (make sure Docker is running first)
./push_to_dockerhub.sh adibsuid
```

## Image Sizes (Estimated)

- Backend: ~2-3 GB (includes Python, PyTorch, GDAL, model)
- Frontend: ~200-300 MB (Node.js, Next.js)

## Build Time (Estimated)

- Backend: 10-20 minutes (first build)
- Frontend: 2-5 minutes
- Push: 5-15 minutes (depends on internet speed)

## Troubleshooting

### "Docker is not running"
```bash
sudo systemctl start docker
# Or start Docker Desktop
```

### "denied: requested access to the resource is denied"
```bash
docker login
# Enter correct credentials
```

### "no space left on device"
```bash
docker system prune -a
```

### Build fails
```bash
# Clean build
docker build --no-cache -f Dockerfile.backend -t adibsuid/bounddel-backend:latest .
```
