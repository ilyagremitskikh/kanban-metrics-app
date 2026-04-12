#!/bin/bash
set -e
SERVER="grmtskh@192.168.1.112"
# Обновленный путь к новой структуре
REMOTE_PATH="/home/grmtskh/docker/stacks/kanban/dist"

cd /Users/tochkamac/Documents/PARA/1_Projects/kanban-metrics-app
npm run build

# Копируем новые файлы
scp -r dist/* "$SERVER:$REMOTE_PATH/"

# Фикс прав (на случай если папка пересоздавалась)
ssh "$SERVER" "chmod 755 $REMOTE_PATH"

# Перезапускаем контейнер по его новому имени
ssh "$SERVER" "docker restart kanban_app"

echo "✓ Deployed and container restarted"