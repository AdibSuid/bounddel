#!/bin/bash

# Standalone Docker Run Script (without docker-compose)
# This script runs the application using docker pull and docker run

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
DOCKER_USERNAME="adibsuid"
IMAGE_NAME="bounddel"
VERSION="latest"
BACKEND_PORT="8000"
FRONTEND_PORT="3000"
NETWORK_NAME="bounddel-net"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}BoundDel - Standalone Docker Run${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Stop and remove existing containers
echo -e "${YELLOW}Cleaning up existing containers...${NC}"
docker stop bounddel-backend 2>/dev/null || true
docker stop bounddel-frontend 2>/dev/null || true
docker rm bounddel-backend 2>/dev/null || true
docker rm bounddel-frontend 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# Create network if it doesn't exist
echo -e "${YELLOW}Creating Docker network...${NC}"
docker network create ${NETWORK_NAME} 2>/dev/null || echo "Network already exists"
echo -e "${GREEN}✓ Network ready${NC}"
echo ""

# Pull images
echo -e "${YELLOW}Pulling images from Docker Hub...${NC}"
docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:${VERSION}
docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:${VERSION}
echo -e "${GREEN}✓ Images pulled${NC}"
echo ""

# Run backend
echo -e "${YELLOW}Starting backend container...${NC}"
docker run -d \
  --name bounddel-backend \
  --network ${NETWORK_NAME} \
  -p ${BACKEND_PORT}:8000 \
  -e PYTHONPATH=/app/Delineate-Anything \
  --restart unless-stopped \
  ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:${VERSION}

echo -e "${GREEN}✓ Backend started on port ${BACKEND_PORT}${NC}"
echo ""

# Wait for backend to be ready
echo -e "${YELLOW}Waiting for backend to start...${NC}"
sleep 5
echo -e "${GREEN}✓ Backend ready${NC}"
echo ""

# Run frontend
echo -e "${YELLOW}Starting frontend container...${NC}"
docker run -d \
  --name bounddel-frontend \
  --network ${NETWORK_NAME} \
  -p ${FRONTEND_PORT}:3000 \
  -e NEXT_PUBLIC_API_URL=http://backend:8000 \
  --restart unless-stopped \
  ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:${VERSION}

echo -e "${GREEN}✓ Frontend started on port ${FRONTEND_PORT}${NC}"
echo ""

# Show running containers
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}✓ Application is running!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${YELLOW}Access the application:${NC}"
echo "  Frontend: http://localhost:${FRONTEND_PORT}"
echo "  Backend:  http://localhost:${BACKEND_PORT}"
echo "  API Docs: http://localhost:${BACKEND_PORT}/docs"
echo ""
echo -e "${YELLOW}Container status:${NC}"
docker ps --filter "name=bounddel" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo -e "${YELLOW}View logs:${NC}"
echo "  docker logs bounddel-backend"
echo "  docker logs bounddel-frontend"
echo ""
echo -e "${YELLOW}Stop containers:${NC}"
echo "  docker stop bounddel-backend bounddel-frontend"
echo ""
echo -e "${YELLOW}Remove containers:${NC}"
echo "  docker rm bounddel-backend bounddel-frontend"
