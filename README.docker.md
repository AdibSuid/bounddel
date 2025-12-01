# Docker Deployment Guide

## Prerequisites

- Docker installed (version 20.10+)
- Docker Compose installed (version 2.0+)

## Quick Start

### 1. Build and Run with Docker Compose

```bash
# Build and start all services
docker-compose up --build

# Or run in detached mode
docker-compose up -d --build
```

### 2. Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

### 3. Stop the Application

```bash
# Stop containers
docker-compose down

# Stop and remove volumes
docker-compose down -v
```

## Individual Container Management

### Build Individual Containers

```bash
# Backend only
docker build -f Dockerfile.backend -t bounddel-backend .

# Frontend only
docker build -f Dockerfile.frontend -t bounddel-frontend .
```

### Run Individual Containers

```bash
# Backend
docker run -p 8000:8000 \
  -v $(pwd)/backend:/app/backend \
  -v $(pwd)/Delineate-Anything:/app/Delineate-Anything \
  bounddel-backend

# Frontend
docker run -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://localhost:8000 \
  bounddel-frontend
```

## Development Mode

For development with hot reload:

```bash
# Update docker-compose.yml to use volume mounts
# This is already configured in the docker-compose.yml
docker-compose up
```

## Production Deployment

### 1. Build optimized images

```bash
docker-compose build --no-cache
```

### 2. Run with production settings

```bash
docker-compose up -d
```

### 3. View logs

```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
```

## Troubleshooting

### Port already in use

```bash
# Check what's using the ports
lsof -i :3000
lsof -i :8000

# Kill the processes
kill -9 <PID>
```

### Container fails to start

```bash
# Check container logs
docker-compose logs backend
docker-compose logs frontend

# Restart specific service
docker-compose restart backend
```

### Clear everything and start fresh

```bash
# Remove all containers, networks, and images
docker-compose down --rmi all -v

# Rebuild
docker-compose up --build
```

## Environment Variables

Create a `.env` file in the root directory:

```env
# Backend
PYTHONPATH=/app/Delineate-Anything

# Frontend
NEXT_PUBLIC_API_URL=http://backend:8000
```

## Health Checks

Both services include health checks:

```bash
# Check service health
docker-compose ps
```

## Scaling (Optional)

```bash
# Run multiple backend instances
docker-compose up --scale backend=3
```

## Resource Limits

To limit container resources, add to docker-compose.yml:

```yaml
services:
  backend:
    deploy:
      resources:
        limits:
          cpus: '2'
          memory: 4G
```
