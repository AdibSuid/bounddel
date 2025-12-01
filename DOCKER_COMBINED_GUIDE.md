# Combined Docker Image Guide

This guide shows how to run both frontend and backend in a **single Docker container**.

## Why Use Combined Image?

**Advantages:**
- ✅ Simpler deployment (one container)
- ✅ Easier to manage
- ✅ No networking setup needed
- ✅ Smaller total size than two separate containers
- ✅ Perfect for simple deployments

**Disadvantages:**
- ❌ Can't scale frontend/backend independently
- ❌ Both services restart together
- ❌ Less flexibility

## Quick Start

### Build Combined Image

```bash
# Automated
chmod +x build_docker_combined.sh
./build_docker_combined.sh

# Manual
docker build -f Dockerfile.combined -t adibsuid/bounddel:latest .
```

### Run Combined Container

```bash
# Automated
chmod +x run_docker_combined.sh
./run_docker_combined.sh

# Manual
docker run -d \
  --name bounddel-app \
  -p 3000:3000 \
  -p 8000:8000 \
  --restart unless-stopped \
  adibsuid/bounddel:latest
```

### Access Application

- **Frontend**: http://localhost:3000
- **Backend**: http://localhost:8000
- **API Docs**: http://localhost:8000/docs

## Using Docker Compose

```bash
docker-compose -f docker-compose.combined.yml up -d
```

## Architecture

The combined image uses **Supervisor** to run both services:

```
┌─────────────────────────────────┐
│     Combined Container          │
│                                 │
│  ┌──────────────────────────┐  │
│  │      Supervisor          │  │
│  │                          │  │
│  │  ├─ Backend (port 8000) │  │
│  │  │  uvicorn main:app     │  │
│  │  │                       │  │
│  │  └─ Frontend (port 3000)│  │
│  │     npm start            │  │
│  └──────────────────────────┘  │
└─────────────────────────────────┘
```

## Management Commands

### View Logs

```bash
# All logs
docker logs bounddel-app

# Follow logs
docker logs -f bounddel-app

# Backend only
docker exec bounddel-app tail -f /var/log/supervisor/backend.out.log

# Frontend only
docker exec bounddel-app tail -f /var/log/supervisor/frontend.out.log
```

### Restart Services

```bash
# Restart entire container
docker restart bounddel-app

# Restart only backend (inside container)
docker exec bounddel-app supervisorctl restart backend

# Restart only frontend (inside container)
docker exec bounddel-app supervisorctl restart frontend
```

### Check Service Status

```bash
docker exec bounddel-app supervisorctl status
```

### Stop Container

```bash
docker stop bounddel-app
```

### Remove Container

```bash
docker rm bounddel-app
```

## Push to Docker Hub

```bash
# Build
docker build -f Dockerfile.combined -t adibsuid/bounddel:latest .

# Tag with version
docker tag adibsuid/bounddel:latest adibsuid/bounddel:v1.0

# Login
docker login

# Push
docker push adibsuid/bounddel:latest
docker push adibsuid/bounddel:v1.0
```

## Deploy from Docker Hub

Anyone can pull and run:

```bash
# Pull
docker pull adibsuid/bounddel:latest

# Run
docker run -d -p 3000:3000 -p 8000:8000 --name bounddel-app adibsuid/bounddel:latest
```

## Comparison: Separate vs Combined

### Separate Containers (Original)

```bash
# Two containers
docker run -d --name bounddel-backend -p 8000:8000 adibsuid/bounddel-backend:latest
docker run -d --name bounddel-frontend -p 3000:3000 adibsuid/bounddel-frontend:latest

# Sizes
Backend:  ~2.5 GB
Frontend: ~250 MB
Total:    ~2.75 GB
```

**Use when:**
- Need independent scaling
- Want to update services separately
- Running in Kubernetes/orchestrated environment

### Combined Container (This Guide)

```bash
# One container
docker run -d -p 3000:3000 -p 8000:8000 --name bounddel-app adibsuid/bounddel:latest

# Size
Combined: ~2.8 GB (slightly larger but simpler)
```

**Use when:**
- Simple deployment (VPS, single server)
- Don't need independent scaling
- Want minimal complexity
- Testing/development

## Resource Limits

Limit container resources:

```bash
docker run -d \
  --name bounddel-app \
  -p 3000:3000 \
  -p 8000:8000 \
  --memory="4g" \
  --cpus="2" \
  adibsuid/bounddel:latest
```

## Troubleshooting

### Container won't start

```bash
# Check logs
docker logs bounddel-app

# Check supervisor status
docker exec bounddel-app supervisorctl status
```

### Only backend or frontend working

```bash
# Check which service failed
docker exec bounddel-app supervisorctl status

# Restart specific service
docker exec bounddel-app supervisorctl restart backend
docker exec bounddel-app supervisorctl restart frontend

# Check service logs
docker exec bounddel-app cat /var/log/supervisor/backend.err.log
docker exec bounddel-app cat /var/log/supervisor/frontend.err.log
```

### Ports already in use

```bash
# Use different ports
docker run -d \
  --name bounddel-app \
  -p 3001:3000 \
  -p 8001:8000 \
  adibsuid/bounddel:latest

# Access at:
# http://localhost:3001 (frontend)
# http://localhost:8001 (backend)
```

### Update to latest version

```bash
# Stop and remove old container
docker stop bounddel-app
docker rm bounddel-app

# Pull latest
docker pull adibsuid/bounddel:latest

# Run new version
./run_docker_combined.sh
```

## Summary

**Build:**
```bash
./build_docker_combined.sh
```

**Run:**
```bash
./run_docker_combined.sh
```

**Stop:**
```bash
docker stop bounddel-app
```

**Logs:**
```bash
docker logs -f bounddel-app
```

Perfect for simple, single-server deployments! 🚀
