$ErrorActionPreference = "Stop"

$SERVER = "grmtskh@192.168.1.112"
$REMOTE_PATH = "/home/grmtskh/home-server/stacks/homeserver/kanban/dist"

Set-Location "D:\Projects\kanban-metrics-app"

Write-Host "Building project..."
npm run build

Write-Host "Copying files to server..."
scp -r "dist/*" "${SERVER}:${REMOTE_PATH}/"

Write-Host "Restarting Docker container..."
ssh $SERVER "docker restart homeserver-kanban-1"

Write-Host "[OK] Deployed and container restarted" -ForegroundColor Green