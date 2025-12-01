#!/bin/bash

# Stop all BoundDel containers

echo "Stopping BoundDel containers..."
docker stop bounddel-backend bounddel-frontend 2>/dev/null || true

echo "Removing containers..."
docker rm bounddel-backend bounddel-frontend 2>/dev/null || true

echo "Removing network..."
docker network rm bounddel-net 2>/dev/null || true

echo "✓ All containers stopped and removed"
