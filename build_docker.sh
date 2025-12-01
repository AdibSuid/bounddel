#!/bin/bash

# Build Docker Images Locally
# This script builds both backend and frontend Docker images from source

set -e

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
DOCKER_USERNAME="${1:-adibsuid}"
IMAGE_NAME="bounddel"
VERSION="${2:-latest}"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Building BoundDel Docker Images${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Username: ${DOCKER_USERNAME}"
echo "Version: ${VERSION}"
echo ""

# Check if Docker is installed
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    echo "Install Docker: https://docs.docker.com/get-docker/"
    exit 1
fi

# Check if Delineate-Anything exists
if [ ! -d "Delineate-Anything" ]; then
    echo -e "${RED}Error: Delineate-Anything directory not found${NC}"
    echo "Make sure the Delineate-Anything model is in the project root"
    exit 1
fi

# Build Backend
echo -e "${YELLOW}[1/2] Building Backend Image...${NC}"
echo "This may take 10-20 minutes on first build..."
echo ""

docker build \
  -f Dockerfile.backend \
  -t ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:${VERSION} \
  -t ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:$(date +%Y%m%d) \
  .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Backend image built successfully${NC}"
else
    echo -e "${RED}✗ Backend build failed${NC}"
    exit 1
fi
echo ""

# Build Frontend
echo -e "${YELLOW}[2/2] Building Frontend Image...${NC}"
echo "This may take 2-5 minutes..."
echo ""

docker build \
  -f Dockerfile.frontend \
  -t ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:${VERSION} \
  -t ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:$(date +%Y%m%d) \
  .

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Frontend image built successfully${NC}"
else
    echo -e "${RED}✗ Frontend build failed${NC}"
    exit 1
fi
echo ""

# Show built images
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}✓ Build Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${YELLOW}Built images:${NC}"
docker images | grep ${IMAGE_NAME}
echo ""

# Show image sizes
echo -e "${YELLOW}Image sizes:${NC}"
echo -n "Backend:  "
docker images ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:${VERSION} --format "{{.Size}}"
echo -n "Frontend: "
docker images ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:${VERSION} --format "{{.Size}}"
echo ""

echo -e "${YELLOW}Next steps:${NC}"
echo ""
echo "1. Test locally:"
echo "   docker-compose up"
echo "   OR"
echo "   ./run_docker.sh"
echo ""
echo "2. Push to Docker Hub:"
echo "   ./push_to_dockerhub.sh ${DOCKER_USERNAME}"
echo ""
echo "3. Run from built images:"
echo "   docker run -d -p 8000:8000 --name bounddel-backend ${DOCKER_USERNAME}/${IMAGE_NAME}-backend:${VERSION}"
echo "   docker run -d -p 3000:3000 --name bounddel-frontend ${DOCKER_USERNAME}/${IMAGE_NAME}-frontend:${VERSION}"
