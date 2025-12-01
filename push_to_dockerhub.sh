#!/bin/bash

# Docker Hub Push Script
# Usage: ./push_to_dockerhub.sh [your-dockerhub-username]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
DOCKER_USERNAME="${1:-adibsuid}"
IMAGE_NAME="bounddel"
VERSION="latest"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Docker Hub Push Script${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo -e "${RED}Error: Docker is not running${NC}"
    exit 1
fi

echo -e "${YELLOW}Building images...${NC}"
echo ""

# Build backend image
echo -e "${GREEN}[1/4] Building backend image...${NC}"
docker build -f Dockerfile.backend -t ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:${VERSION} .
docker tag ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:${VERSION} ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:$(date +%Y%m%d)
echo -e "${GREEN}✓ Backend image built${NC}"
echo ""

# Build frontend image
echo -e "${GREEN}[2/4] Building frontend image...${NC}"
docker build -f Dockerfile.frontend -t ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:${VERSION} .
docker tag ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:${VERSION} ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:$(date +%Y%m%d)
echo -e "${GREEN}✓ Frontend image built${NC}"
echo ""

# Login to Docker Hub
echo -e "${GREEN}[3/4] Logging in to Docker Hub...${NC}"
echo -e "${YELLOW}Please enter your Docker Hub credentials:${NC}"
docker login
echo -e "${GREEN}✓ Logged in successfully${NC}"
echo ""

# Push images
echo -e "${GREEN}[4/4] Pushing images to Docker Hub...${NC}"
echo ""

echo -e "${YELLOW}Pushing backend:latest...${NC}"
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:${VERSION}
echo -e "${GREEN}✓ Backend:latest pushed${NC}"

echo -e "${YELLOW}Pushing backend:$(date +%Y%m%d)...${NC}"
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:$(date +%Y%m%d)
echo -e "${GREEN}✓ Backend:$(date +%Y%m%d) pushed${NC}"

echo -e "${YELLOW}Pushing frontend:latest...${NC}"
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:${VERSION}
echo -e "${GREEN}✓ Frontend:latest pushed${NC}"

echo -e "${YELLOW}Pushing frontend:$(date +%Y%m%d)...${NC}"
docker push ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:$(date +%Y%m%d)
echo -e "${GREEN}✓ Frontend:$(date +%Y%m%d) pushed${NC}"

echo ""
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}✓ All images pushed successfully!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${YELLOW}Images available at:${NC}"
echo "  • ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:${VERSION}"
echo "  • ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:$(date +%Y%m%d)"
echo "  • ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:${VERSION}"
echo "  • ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:$(date +%Y%m%d)"
echo ""
echo -e "${YELLOW}Pull images with:${NC}"
echo "  docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:${VERSION}"
echo "  docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:${VERSION}"
echo ""
echo -e "${YELLOW}Or use docker-compose:${NC}"
echo "  Update docker-compose.yml to use:"
echo "    image: ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:${VERSION}"
echo "    image: ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:${VERSION}"
