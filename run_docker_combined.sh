#!/bin/bash

# Run Combined Docker Container (Frontend + Backend in one)

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

DOCKER_USERNAME="${1:-adibsuid}"
IMAGE_NAME="bounddel"
VERSION="${2:-latest}"
CONTAINER_NAME="bounddel-app"

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Running BoundDel Combined Container${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Stop and remove existing container
echo -e "${YELLOW}Cleaning up...${NC}"
docker stop ${CONTAINER_NAME} 2>/dev/null || true
docker rm ${CONTAINER_NAME} 2>/dev/null || true
echo -e "${GREEN}✓ Cleanup complete${NC}"
echo ""

# Pull image if using from Docker Hub
if docker images ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION} | grep -q ${IMAGE_NAME}; then
    echo -e "${YELLOW}Using local image${NC}"
else
    echo -e "${YELLOW}Pulling image from Docker Hub...${NC}"
    docker pull ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}
fi
echo ""

# Run container
echo -e "${YELLOW}Starting container...${NC}"
docker run -d \
  --name ${CONTAINER_NAME} \
  -p 3000:3000 \
  -p 8000:8000 \
  --restart unless-stopped \
  ${DOCKER_USERNAME}/${IMAGE_NAME}:${VERSION}

echo -e "${GREEN}✓ Container started${NC}"
echo ""

# Wait a moment for services to start
echo -e "${YELLOW}Waiting for services to start...${NC}"
sleep 5
echo ""

# Show status
echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}✓ Application is running!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${YELLOW}Access the application:${NC}"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:8000"
echo "  API Docs: http://localhost:8000/docs"
echo ""
echo -e "${YELLOW}Container status:${NC}"
docker ps --filter "name=${CONTAINER_NAME}" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
echo ""
echo -e "${YELLOW}View logs:${NC}"
echo "  All logs:     docker logs ${CONTAINER_NAME}"
echo "  Follow logs:  docker logs -f ${CONTAINER_NAME}"
echo "  Backend logs: docker exec ${CONTAINER_NAME} tail -f /var/log/supervisor/backend.out.log"
echo "  Frontend logs: docker exec ${CONTAINER_NAME} tail -f /var/log/supervisor/frontend.out.log"
echo ""
echo -e "${YELLOW}Stop container:${NC}"
echo "  docker stop ${CONTAINER_NAME}"
