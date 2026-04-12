$ErrorActionPreference = "Stop"

$SERVER = "grmtskh@192.168.1.112"
# Обновленный путь к новой структуре
$REMOTE_PATH = "/home/grmtskh/docker/stacks/kanban/dist"

Set-Location "D:\Projects\kanban-metrics-app"

Write-Host "Building project..."
npm run build

Write-Host "Copying files to server..."
scp -r "dist/*" "${SERVER}:${REMOTE_PATH}/"

# Фикс прав
Write-Host "Fixing permissions..."
ssh $SERVER "chmod 755 $REMOTE_PATH"

# Перезапускаем контейнер по его новому имени
Write-Host "Restarting Docker container..."
ssh $SERVER "docker restart kanban_app"

Write-Host "[OK] Deployed and container restarted" -ForegroundColor Green