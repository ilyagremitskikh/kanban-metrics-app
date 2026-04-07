Инструкция для AI-Агента: Рефакторинг ядра расчёта метрик (Kanban Metrics App 2.0)1. Контекст задачи (Vibe-coding Context)Мы полностью переписываем ядро расчёта метрик времени (Lead Time, Cycle Time) и WIP.Старая архитектура, основанная на поиске переходов в динамические ltStart/ctStart и проверке поля resolution, оказалась переусложненной и не учитывает длинный этап Discovery у User Story.Новая архитектура основана на жестком маппинге всех статусов Jira в 4 логические "корзины" (Buckets) и разделении цикла на Upstream (аналитика/подготовка) и Downstream (разработка/delivery).Твоя задача: Удалить старый код парсинга переходов, внедрить новую Bucket-архитектуру и обновить строго определенные элементы UI.⚠️ ВНИМАНИЕ: В проекте есть части, которые работают идеально (например, Throughput). Соблюдай строгие ограничения в разделе 6, чтобы не сломать их.2. Новая модель корзин (Buckets Mapping)Тебе нужно создать конфигурацию (словарь/массивы), которая маппит строковые названия статусов Jira в 4 категории.const BUCKETS = {
  QUEUE: [
    "Идея", "Бэклог", "Готово к проработке"
  ],
  UPSTREAM_ACTIVE: [
    "Проработка идеи", "Подготовка к исследованию", "Проверка гипотезы", 
    "Разработка прототипа", "Оценка риска", "Готово к анализу", 
    "Анализ", "План приемки", "Ожидает плана приемки", 
    "Подготовка тест-кейсов", "Готово к разработке"
  ],
  DOWNSTREAM_ACTIVE: [
    "Разработка", "Code review", "Правки", "Готово к тестированию", 
    "Тестирование Stage", "Регресс", "Тест ОО", "Готово к регрессу", 
    "Готова к Prod", "Приемка", "Частичный релиз", "Релиз", "Ревью"
  ],
  DONE_TERMINAL: [
    "Готово", "Отменена", "Архив"
  ]
};

// Константа успешного финала
const SUCCESS_DONE_STATUS = "Готово";
3. Входная модель данных (Input Data)Тебе на вход будет поступать массив объектов следующей структуры. Обрати внимание: дата created теперь лежит на верхнем уровне, а поле resolution больше не используется и может отсутствовать.{
  "key": "CREDITS-9036",
  "created": "2026-04-03T11:49:35.000+0500",
  "currentStatus": "Готово",
  "transitions": [
    {
      "date": "2026-04-03T11:50:26.000+0500",
      "to": "Готово к анализу"
    },
    {
      "date": "2026-04-03T11:52:34.000+0500",
      "to": "Разработка"
    },
    {
      "date": "2026-04-03T17:24:32.000+0500",
      "to": "Готово"
    }
  ]
}
4. Ядро расчётов (Бизнес-логика)Тебе необходимо реализовать функцию обработки одного Issue, возвращающую метрики.Правила:WIP считается для всех задач на основе currentStatus.Метрики времени (LT, CT) считаются ТОЛЬКО если currentStatus === SUCCESS_DONE_STATUS. Во всех остальных случаях они равны null.Псевдокод (Reference Implementation):const MS_IN_DAY = 1000 * 60 * 60 * 24;

function calculateIssueMetrics(issue) {
  const result = {
    key: issue.key,
    isUpstreamWip: false,
    isDownstreamWip: false,
    leadTimeDays: null,
    devCycleTimeDays: null,
    upstreamTimeDays: null
  };

  // 1. Snapshot Metrics (WIP)
  if (BUCKETS.UPSTREAM_ACTIVE.includes(issue.currentStatus)) {
    result.isUpstreamWip = true;
  }
  if (BUCKETS.DOWNSTREAM_ACTIVE.includes(issue.currentStatus)) {
    result.isDownstreamWip = true;
  }

  // 2. Time Metrics (Только для успешно завершенных)
  if (issue.currentStatus === SUCCESS_DONE_STATUS) {
    // Сортируем переходы по времени (от старых к новым)
    const sortedTransitions = [...issue.transitions].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );

    // Ищем ПОСЛЕДНИЙ вход в Готово
    const doneTransitions = sortedTransitions.filter(t => t.to === SUCCESS_DONE_STATUS);
    if (doneTransitions.length === 0) return result; // Защита от кривых данных

    const doneDtm = new Date(doneTransitions[doneTransitions.length - 1].date).getTime();
    const createdDtm = new Date(issue.created).getTime();

    // A. Lead Time: От создания до последнего входа в Готово
    result.leadTimeDays = (doneDtm - createdDtm) / MS_IN_DAY;

    // B. Dev Cycle Time: От ПЕРВОГО входа в разработку до последнего входа в Готово
    const firstDownstream = sortedTransitions.find(t => BUCKETS.DOWNSTREAM_ACTIVE.includes(t.to));
    let devStartDtm = null;
    
    if (firstDownstream) {
      devStartDtm = new Date(firstDownstream.date).getTime();
      if (devStartDtm < doneDtm) {
        result.devCycleTimeDays = (doneDtm - devStartDtm) / MS_IN_DAY;
      }
    }

    // C. Upstream Time: От ПЕРВОГО входа в аналитику до ПЕРВОГО входа в разработку (или до Готово)
    const firstUpstream = sortedTransitions.find(t => BUCKETS.UPSTREAM_ACTIVE.includes(t.to));
    
    if (firstUpstream) {
      const upStartDtm = new Date(firstUpstream.date).getTime();
      const upEndDtm = devStartDtm ? devStartDtm : doneDtm; // Если не было разработки, финишем будет Готово
      
      if (upStartDtm < upEndDtm) {
        result.upstreamTimeDays = (upEndDtm - upStartDtm) / MS_IN_DAY;
      }
    }
  }

  return result;
}
5. Acceptance Criteria (Краевые случаи для проверки)Агент должен написать юнит-тесты или гарантировать корректную работу следующих сценариев:Ping-Pong (Возвраты): Задача пошла из Разработки (DOWNSTREAM) в Анализ (UPSTREAM), а затем обратно в Разработку.Ожидание: Dev Cycle Time считается от самого первого входа в Разработку. Внутренние возвраты не сбрасывают таймер!Отмененная задача: Задача была в Разработке, но текущий статус "Отменена" или "Архив".Ожидание: leadTimeDays и devCycleTimeDays равны null (чтобы не портить графики средних значений). isDownstreamWip = false.Прямой перелет в Готово: Задачу создали и сразу перевели в "Готово", минуя Анализ и Разработку.Ожидание: leadTimeDays считается корректно. upstreamTimeDays = null, devCycleTimeDays = null.Бесконечный Discovery: У задачи нет статусов из корзины DOWNSTREAM_ACTIVE, она успешно закрыта из аналитики (или просто отменена).Ожидание: devCycleTimeDays = null.6. Строгие правила для UI и Настроек (ЧТО ДЕЛАТЬ, А ЧТО НЕ ТРОГАТЬ)ОБЯЗАТЕЛЬНО ОБНОВИТЬ (Использовать новую логику из п. 4):Виджеты (карточки) метрик: Lead Time, Cycle Time, WIP.Графики: Lead Time по задачам (scatter), Cycle Time по задачам (scatter).График: Процент прогнозируемости.Список задач (таблица) внизу страницы: убедиться, что туда выводятся новые корректные значения Lead Time и Cycle Time для каждой задачи.ОБЯЗАТЕЛЬНО УДАЛИТЬ:Выбор статусов в верхней панели (теперь всё работает через корзины).Выбор дат в настройках (логика выгрузки по датам перенесена на сторону n8n).НЕ ТРОГАТЬ (Запрещено вносить изменения):Логика Throughput: Оставить как есть, с ней всё в порядке! Графики Throughput не переписывать.Настройки Webhook'ов: В меню настроек должны остаться ТОЛЬКО следующие инпуты:Jira Webhook URL (отвечает за выгрузку данных).Throughput Webhook URL (отвечает за Throughput, не ломать).AI Agent Webhook URL (логика ИИ, не трогать).7. Cleanup Checklist (Что удалить из старого кода)Удалить логику динамического определения ltStart, ltEnd, ctStart, ctEnd на основе issueType или настроек UI.Удалить функцию getLastTransitionTimeBefore() (она больше не нужна, так как мы берем первый вход, а не последний).Удалить все фильтрации по полю resolution (Won't Fix, Duplicate и т.д.).