# Standalone Docker Deployment (without docker-compose)

This guide shows how to deploy using `docker pull` and `docker run` commands instead of docker-compose.

## Quick Start

### Automated Script

```bash
# Make script executable
chmod +x run_docker.sh

# Run the application
./run_docker.sh
```

### Stop Application

```bash
chmod +x stop_docker.sh
./stop_docker.sh
```

## Manual Deployment

### 1. Create Docker Network

```bash
docker network create bounddel-net
```

### 2. Pull Images from Docker Hub

```bash
docker pull adibsuid/bounddel-backend:latest
docker pull adibsuid/bounddel-frontend:latest
```

### 3. Run Backend Container

```bash
docker run -d \
  --name bounddel-backend \
  --network bounddel-net \
  -p 8000:8000 \
  -e PYTHONPATH=/app/Delineate-Anything \
  --restart unless-stopped \
  adibsuid/bounddel-backend:latest
```

### 4. Run Frontend Container

```bash
docker run -d \
  --name bounddel-frontend \
  --network bounddel-net \
  -p 3000:3000 \
  -e NEXT_PUBLIC_API_URL=http://backend:8000 \
  --restart unless-stopped \
  adibsuid/bounddel-frontend:latest
```

### 5. Verify Containers are Running

```bash
docker ps --filter "name=bounddel"
```

## Access the Application

- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:8000
- **API Documentation**: http://localhost:8000/docs

## Container Management

### View Logs

```bash
# Backend logs
docker logs bounddel-backend

# Frontend logs
docker logs bounddel-frontend

# Follow logs in real-time
docker logs -f bounddel-backend
```

### Check Container Status

```bash
docker ps --filter "name=bounddel"
```

### Stop Containers

```bash
docker stop bounddel-backend bounddel-frontend
```

### Start Stopped Containers

```bash
docker start bounddel-backend bounddel-frontend
```

### Restart Containers

```bash
docker restart bounddel-backend bounddel-frontend
```

### Remove Containers

```bash
docker rm bounddel-backend bounddel-frontend
```

### Remove Network

```bash
docker network rm bounddel-net
```

## Update to Latest Version

```bash
# Stop and remove old containers
docker stop bounddel-backend bounddel-frontend
docker rm bounddel-backend bounddel-frontend

# Pull latest images
docker pull adibsuid/bounddel-backend:latest
docker pull adibsuid/bounddel-frontend:latest

# Run new containers (use commands from step 3 & 4)
```

Or use the automated script:

```bash
./stop_docker.sh
./run_docker.sh
```

## Environment Variables

### Backend

- `PYTHONPATH=/app/Delineate-Anything` - Required for model imports

### Frontend

- `NEXT_PUBLIC_API_URL=http://backend:8000` - Backend API URL

## Port Configuration

Default ports:
- Frontend: `3000`
- Backend: `8000`

To use different ports:

```bash
# Backend on port 8080
docker run -d \
  --name bounddel-backend \
  --network bounddel-net \
  -p 8080:8000 \
  -e PYTHONPATH=/app/Delineate-Anything \
  adibsuid/bounddel-backend:latest

# Frontend on port 3001
docker run -d \
  --name bounddel-frontend \
  --network bounddel-net \
  -p 3001:3000 \
  -e NEXT_PUBLIC_API_URL=http://backend:8000 \
  adibsuid/bounddel-frontend:latest
```

## Troubleshooting

### Container won't start

```bash
# Check logs for errors
docker logs bounddel-backend
docker logs bounddel-frontend
```

### Port already in use

```bash
# Find process using the port
lsof -i :3000
lsof -i :8000

# Kill the process or use different ports
```

### Cannot connect to backend

```bash
# Make sure both containers are on the same network
docker network inspect bounddel-net

# Check backend is running
docker ps --filter "name=bounddel-backend"
```

### Reset everything

```bash
# Stop and remove containers
docker stop bounddel-backend bounddel-frontend
docker rm bounddel-backend bounddel-frontend

# Remove network
docker network rm bounddel-net

# Remove images (optional)
docker rmi adibsuid/bounddel-backend:latest
docker rmi adibsuid/bounddel-frontend:latest

# Start fresh
./run_docker.sh
```

## Resource Limits (Optional)

Limit container resources:

```bash
# Backend with limits
docker run -d \
  --name bounddel-backend \
  --network bounddel-net \
  -p 8000:8000 \
  --memory="4g" \
  --cpus="2" \
  -e PYTHONPATH=/app/Delineate-Anything \
  adibsuid/bounddel-backend:latest

# Frontend with limits
docker run -d \
  --name bounddel-frontend \
  --network bounddel-net \
  -p 3000:3000 \
  --memory="512m" \
  --cpus="1" \
  -e NEXT_PUBLIC_API_URL=http://backend:8000 \
  adibsuid/bounddel-frontend:latest
```

## Health Checks

```bash
# Check if backend is responding
curl http://localhost:8000/

# Check frontend
curl http://localhost:3000/
```

## Compare with docker-compose

**docker-compose**: One command manages everything
```bash
docker-compose up -d
```

**docker run**: More control, more commands
```bash
docker network create bounddel-net
docker run -d --name bounddel-backend --network bounddel-net -p 8000:8000 ...
docker run -d --name bounddel-frontend --network bounddel-net -p 3000:3000 ...
```

Use `docker run` when:
- You want fine-grained control
- docker-compose is not available
- Deploying to basic cloud VMs
- Learning Docker fundamentals

Use `docker-compose` when:
- Managing multiple services
- Need reproducible deployments
- Want simpler commands
- Working with teams
