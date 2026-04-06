#!/bin/bash
set -e
SERVER="grmtskh@192.168.1.112"
REMOTE_PATH="/home/grmtskh/home-server/stacks/homeserver/kanban/dist"

cd /Users/hacker/Desktop/kanban-metrics-app
npm run build
scp dist/index.html "$SERVER:$REMOTE_PATH/"
echo "✓ Deployed"
