GET https://n8n.mindhackerdev.ru/webhook-test/throughput
INNER JQL: project = CREDITS AND labels = Партнерские_Интеграции AND resolved >= 2026-01-12 AND resolved <= 2026-04-07 ORDER BY created DESC
INNER FIELDS: resolution,resolutiondate,issuetype

Example response:
{
    "data": [
        {
            "expand": "operations,versionedRepresentations,editmeta,changelog,renderedFields",
            "id": "1568622",
            "self": "https://jira.tochka.com/rest/api/2/issue/1568622",
            "key": "CREDITS-9036",
            "fields": {
                "issuetype": {
                    "self": "https://jira.tochka.com/rest/api/2/issuetype/3",
                    "id": "3",
                    "description": "Стандартный запрос",
                    "iconUrl": "https://jira.tochka.com/secure/viewavatar?size=xsmall&avatarId=13518&avatarType=issuetype",
                    "name": "Задача",
                    "subtask": false,
                    "avatarId": 13518
                },
                "resolution": {
                    "self": "https://jira.tochka.com/rest/api/2/resolution/21",
                    "id": "21",
                    "description": "",
                    "name": "Разрешен"
                },
                "resolutiondate": "2026-04-03T17:24:32.000+0500"
            }
        },
        {
            "expand": "operations,versionedRepresentations,editmeta,changelog,renderedFields",
            "id": "1565585",
            "self": "https://jira.tochka.com/rest/api/2/issue/1565585",
            "key": "CREDITS-9020",
            "fields": {
                "issuetype": {
                    "self": "https://jira.tochka.com/rest/api/2/issuetype/3",
                    "id": "3",
                    "description": "Стандартный запрос",
                    "iconUrl": "https://jira.tochka.com/secure/viewavatar?size=xsmall&avatarId=13518&avatarType=issuetype",
                    "name": "Задача",
                    "subtask": false,
                    "avatarId": 13518
                },
                "resolution": {
                    "self": "https://jira.tochka.com/rest/api/2/resolution/21",
                    "id": "21",
                    "description": "",
                    "name": "Разрешен"
                },
                "resolutiondate": "2026-04-02T10:48:31.000+0500"
            }
        },
        {
            "expand": "operations,versionedRepresentations,editmeta,changelog,renderedFields",
            "id": "1564134",
            "self": "https://jira.tochka.com/rest/api/2/issue/1564134",
            "key": "CREDITS-9011",
            "fields": {
                "issuetype": {
                    "self": "https://jira.tochka.com/rest/api/2/issuetype/3",
                    "id": "3",
                    "description": "Стандартный запрос",
                    "iconUrl": "https://jira.tochka.com/secure/viewavatar?size=xsmall&avatarId=13518&avatarType=issuetype",
                    "name": "Задача",
                    "subtask": false,
                    "avatarId": 13518
                },
                "resolution": {
                    "self": "https://jira.tochka.com/rest/api/2/resolution/21",
                    "id": "21",
                    "description": "",
                    "name": "Разрешен"
                },
                "resolutiondate": "2026-04-01T16:13:26.000+0500"
            }
        }
    ]
}