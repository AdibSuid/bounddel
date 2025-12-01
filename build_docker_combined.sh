#!/bin/bash

# Build Combined Docker Image (Frontend + Backend in one container)

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

DOCKER_USERNAME="${1:-adibsuid}"
IMAGE_NAME="bounddel"
VERSION="${2:-latest}"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Building Combined Docker Image${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo "Image: ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
echo ""

# Check Docker
if ! command -v docker &> /dev/null; then
    echo -e "${RED}Error: Docker is not installed${NC}"
    exit 1
fi

# Check Delineate-Anything
if [ ! -d "Delineate-Anything" ]; then
    echo -e "${RED}Error: Delineate-Anything directory not found${NC}"
    exit 1
fi

echo -e "${YELLOW}Building combined image...${NC}"
echo "This may take 15-25 minutes..."
echo ""

docker build \
  -f Dockerfile.combined \
  -t ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION} \
  -t ${DOCKER_USERNAME}/${IMAGE_NAME}:$(date +%Y%m%d) \
  .

if [ $? -eq 0 ]; then
    echo ""
    echo -e "${GREEN}======================================${NC}"
    echo -e "${GREEN}✓ Build Complete!${NC}"
    echo -e "${GREEN}======================================${NC}"
    echo ""
    
    echo -e "${YELLOW}Image size:${NC}"
    docker images ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION} --format "{{.Size}}"
    echo ""
    
    echo -e "${YELLOW}Run the container:${NC}"
    echo "docker run -d -p 3000:3000 -p 8000:8000 --name bounddel ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
    echo ""
    
    echo -e "${YELLOW}Or use the script:${NC}"
    echo "./run_docker_combined.sh"
    echo ""
    
    echo -e "${YELLOW}Push to Docker Hub:${NC}"
    echo "docker push ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}"
else
    echo -e "${RED}✗ Build failed${NC}"
    exit 1
fi
