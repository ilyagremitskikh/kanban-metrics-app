#!/bin/bash
set -e
SERVER="grmtskh@192.168.1.112"
REMOTE_PATH="/home/grmtskh/home-server/stacks/homeserver/kanban/dist"

cd d:/Projects/kanban-metrics-app
npm run build
scp -r dist/* "$SERVER:$REMOTE_PATH/"
ssh "$SERVER" "docker restart homeserver-kanban-1"
echo "✓ Deployed and container restarted"
