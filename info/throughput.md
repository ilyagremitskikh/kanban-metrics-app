GET https://n8n.mindhackerdev.ru/webhook-test/throughput
INNER JQL: project = CREDITS AND labels = Партнерские_Интеграции AND resolved >= 2026-01-12 AND resolved <= 2026-04-07 ORDER BY created DESC
INNER FIELDS: resolution,resolutiondate,issuetype

Example response:
[
  {
    "key": "CREDITS-9036",
    "created": "2026-04-03T11:49:35.000+0500",
    "issueType": "Задача",
    "summary": "Добавить выбор сервиса при работе с credit-checks",
    "currentStatus": "Готово",
    "resolution": "Разрешен",
    "resolutionDate": "2026-04-03T17:24:32.000+0500"
  },
  {
    "key": "CREDITS-9020",
    "created": "2026-04-01T12:00:00.000+0500",
    "issueType": "Задача",
    "summary": "Обновить отображение процентной ставки по кредиту ДомРФ",
    "currentStatus": "Готово",
    "resolution": "Разрешен",
    "resolutionDate": "2026-04-02T10:48:31.000+0500"
  }
]