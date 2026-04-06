# Kanban Metrics

Локальный веб-инструмент для измерения Kanban-метрик команды на основе данных из Jira через n8n.

## Метрики

| Метрика | Описание |
|---|---|
| **Lead Time** | Полное время жизни задачи: от входа в систему до завершения |
| **Cycle Time** | Время активной работы: от взятия в работу до завершения |
| **WIP** | Количество задач в работе прямо сейчас (закон Литтла) |
| **Throughput** | Задач завершено за неделю |

## Возможности

- Scatter-графики Lead Time и Cycle Time с линиями P50/P85/P95
- Throughput по неделям (bar chart)
- WIP-динамика по неделям (line chart)
- **Aging WIP** — текущие задачи в работе с цветовой индикацией по CT-порогам
- **Monte Carlo** симуляция (10 000 итераций):
  - Режим «N задач → когда?» — прогноз даты завершения (P50/P85/P95)
  - Режим «К дате → сколько?» — прогноз количества задач
  - Режим «Очередь» — когда завершится каждая задача из приоритизированного бэклога
- **RICE-приоритизация** — интеграция с n8n DataTable, chip-селекторы для Impact/Confidence, stepper для Effort
- Гибкий JQL: стандартный режим (проект + типы) или свой JQL
- Настройки workflow: отдельные LT/CT границы для каждого типа задач
- Все настройки сохраняются в `localStorage`

## Архитектура

```
Browser (React SPA)
    ↓ POST /webhook/kanban-metrics
n8n → Jira (getAll + changelog) → transform → JSON
    ↓ GET  /webhook/rice-scoring
n8n → Jira + DataTable → JSON
    ↓ POST /webhook/rice-score-update
n8n → DataTable update
```

## Стек

- **React 19** + **TypeScript** + **Vite 8**
- **Chart.js 4** — все графики
- `vite-plugin-singlefile` — сборка в один `index.html` (работает через `file://`)

## Локальная разработка

```bash
npm install
npm run dev        # localhost:5173 (с Vite-прокси на n8n)
```

Прокси в dev-режиме: все запросы `/webhook/*` → `https://n8n.mindhackerdev.ru`.

Переменная окружения для другого n8n-хоста:
```bash
N8N_HOST=https://your-n8n.example.com npm run dev
```

## Сборка

```bash
npm run build      # → dist/index.html (~450 КБ, всё инлайнено)
```

В production-билде запросы идут напрямую на n8n (CORS `allowedOrigins: *` настроен на обоих webhook-нодах).

## Деплой на домашний сервер

```bash
./deploy.sh        # build + scp на сервер
```

**Сервер:** `grmtskh@192.168.1.112`
**Путь:** `/home/grmtskh/home-server/stacks/homeserver/kanban/dist/`
**Docker:** nginx-контейнер `kanban` в `compose.yaml`, проксируется через Nginx Proxy Manager

### Добавить в compose.yaml

```yaml
kanban:
  image: nginx:alpine
  restart: unless-stopped
  volumes:
    - ./kanban/dist:/usr/share/nginx/html:ro
```

## n8n Workflows

| Workflow | ID | Описание |
|---|---|---|
| Kanban Metrics | — | POST `/webhook/kanban-metrics` — загрузка задач с changelog |
| RICE Workflow | `TULUmSRn2ySEGkP1k9Kmg` | GET `/webhook/rice-scoring`, POST `/webhook/rice-score-update` |

## Структура проекта

```
src/
├── components/
│   ├── AgingWIP.tsx       # График стареющего WIP
│   ├── Charts.tsx         # Scatter / Throughput / WIP графики
│   ├── IssuesTable.tsx    # Таблица задач
│   ├── MetricCards.tsx    # Карточки метрик с тултипами
│   ├── MonteCarlo.tsx     # Monte Carlo симуляция
│   ├── RiceSection.tsx    # RICE приоритизация
│   ├── Settings.tsx       # Панель настроек
│   ├── StatusBar.tsx      # Глобальный статус-бар
│   └── StatusConfig.tsx   # Настройка LT/CT границ по workflow
├── lib/
│   ├── api.ts             # Запросы к n8n (метрики)
│   ├── metrics.ts         # Расчёт LT, CT, WIP, Throughput
│   ├── monteCarlo.ts      # Monte Carlo логика
│   ├── riceApi.ts         # Запросы к n8n (RICE)
│   └── utils.ts           # detectWorkflows, getMonthlyChunks, etc.
├── hooks/
│   └── useLocalStorage.ts
├── types.ts
└── App.tsx
```
