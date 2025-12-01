#!/bin/bash

# Install Docker Engine on Ubuntu
# Official Docker installation script

set -e

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}Installing Docker Engine${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""

# Check if running on Ubuntu/Debian
if [ ! -f /etc/os-release ]; then
    echo -e "${RED}Error: Cannot detect OS${NC}"
    exit 1
fi

source /etc/os-release
if [[ "$ID" != "ubuntu" && "$ID" != "debian" ]]; then
    echo -e "${RED}Error: This script is for Ubuntu/Debian only${NC}"
    exit 1
fi

echo -e "${YELLOW}Detected OS: $PRETTY_NAME${NC}"
echo ""

# Remove old Docker versions
echo -e "${YELLOW}[1/5] Removing old Docker versions...${NC}"
sudo apt-get remove -y docker docker-engine docker.io containerd runc 2>/dev/null || true
echo -e "${GREEN}✓ Old versions removed${NC}"
echo ""

# Update package index
echo -e "${YELLOW}[2/5] Updating package index...${NC}"
sudo apt-get update
echo -e "${GREEN}✓ Package index updated${NC}"
echo ""

# Install dependencies
echo -e "${YELLOW}[3/5] Installing dependencies...${NC}"
sudo apt-get install -y \
    ca-certificates \
    curl \
    gnupg \
    lsb-release
echo -e "${GREEN}✓ Dependencies installed${NC}"
echo ""

# Add Docker's official GPG key
echo -e "${YELLOW}[4/5] Adding Docker GPG key...${NC}"
sudo install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
sudo chmod a+r /etc/apt/keyrings/docker.gpg
echo -e "${GREEN}✓ GPG key added${NC}"
echo ""

# Set up Docker repository
echo -e "${YELLOW}Setting up Docker repository...${NC}"
echo \
  "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
  $(lsb_release -cs) stable" | \
  sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
echo -e "${GREEN}✓ Repository configured${NC}"
echo ""

# Update package index with Docker packages
echo -e "${YELLOW}Updating package index...${NC}"
sudo apt-get update
echo ""

# Install Docker Engine
echo -e "${YELLOW}[5/5] Installing Docker Engine...${NC}"
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
echo -e "${GREEN}✓ Docker Engine installed${NC}"
echo ""

# Start Docker service
echo -e "${YELLOW}Starting Docker service...${NC}"
sudo systemctl start docker
sudo systemctl enable docker
echo -e "${GREEN}✓ Docker service started${NC}"
echo ""

# Add current user to docker group
echo -e "${YELLOW}Adding current user to docker group...${NC}"
sudo usermod -aG docker $USER
echo -e "${GREEN}✓ User added to docker group${NC}"
echo ""

# Verify installation
echo -e "${YELLOW}Verifying installation...${NC}"
sudo docker run hello-world
echo ""

echo -e "${GREEN}======================================${NC}"
echo -e "${GREEN}✓ Docker Installation Complete!${NC}"
echo -e "${GREEN}======================================${NC}"
echo ""
echo -e "${YELLOW}Docker version:${NC}"
sudo docker --version
sudo docker compose version
echo ""
echo -e "${YELLOW}⚠ IMPORTANT:${NC}"
echo "Log out and log back in for docker group changes to take effect."
echo "Or run: newgrp docker"
echo ""
echo -e "${YELLOW}Test Docker without sudo:${NC}"
echo "newgrp docker"
echo "docker run hello-world"
