# Design System: Kanban Metrics (Donezo Theme)

Этот документ является **инструкцией** по созданию и стилизации новых компонентов для приложения Kanban Metrics. Приложение использует философию дизайна "Donezo" — современный clean/glassmorphism UI с мягкими тенями, большими скруглениями и зелеными цветовыми акцентами.

## 1. Цветовая палитра (Colors)

Все фирменные цвета вынесены в `tailwind.config.js`:
- `donezo-dark` (`#1e5138`): Очень темный изумрудный. Используется для: Primary кнопок, активных табов навигации, иконок-аватаров компонентов.
- `donezo-primary` (`#2c7a51`): Яркий зеленый. Используется для: :hover состояний, рамок фокуса инпутов (focus ring), графиков.
- `donezo-light` (`#e6f0eb`): Бледно-зеленый. Используется для: Подсветки рядов таблицы при наведении (`hover:bg-donezo-light`), подложек неактивных бейджей.
- `donezo-bg` (`#f3f4f6`): Светло-серый. Используется для: Цвета фона `<body>` и корневых отступов между блоками.

## 2. Типографика (Typography)

- **Шрифт:** `Inter` (через Google Fonts). Установлен по умолчанию в Tailwind как `font-sans`. Дополнительные классы для семейства указывать не нужно.
- **Иерархия:**
  - *Заголовки панелей (Hero H1):* `text-2xl font-extrabold text-gray-900 tracking-tight leading-none`
  - *Заголовки секций (H3):* `text-lg font-bold text-slate-900`
  - *Вспомогательный текст/Подписи:* `text-xs text-gray-500 font-semibold tracking-wider uppercase` (для меню) или `text-sm text-gray-400` (обычный).

## 3. Каркас и Лейаут (Layout & Containers)

Дизайн подразумевает "холст поверх фона". 
- Фон экрана: `bg-donezo-bg`.
- **Primary Dashboard Card (Главное окно):** Белая карточка огромного размера.
  - Классы: `bg-white rounded-[32px] p-6 shadow-donezo border border-gray-100/50`.
- **Внутренние карточки (Widgets/Charts):**
  - Классы: `bg-white rounded-3xl p-5 shadow-donezo border border-gray-100`.

## 4. Контролы (UI Components Library)

При создании новых элементов **строго** придерживайтесь этих шаблонов.

### Кнопки
Кнопки всегда полностью закругленные (`rounded-full`) с транзишенами трансформации по Y на hover (`hover:-translate-y-0.5`).

- **Primary Button (Сохранить/Создать):**
  ```jsx
  className="px-6 py-2.5 bg-donezo-dark text-white rounded-full text-sm font-bold shadow-sm transition-all duration-200 hover:bg-donezo-primary hover:shadow-lg hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
  ```
- **Secondary Button (Отмена/Действие):**
  ```jsx
  className="px-6 py-2.5 bg-white text-gray-700 border border-gray-200 rounded-full text-sm font-bold shadow-sm transition-all duration-200 hover:bg-donezo-light hover:text-donezo-dark hover:border-donezo-primary hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none"
  ```

### Инпуты (Text Inputs)
Инпуты должны иметь серый фон, который становится белым при фокусе, с зеленой обводкой.
  ```jsx
  className="px-3 py-2 bg-gray-50 border border-gray-100 rounded-xl text-sm font-semibold outline-none transition-all duration-200 focus:bg-white focus:border-donezo-primary focus:ring-2 focus:ring-donezo-light"
  ```

### Таблицы
- Обертка таблицы: `overflow-x-auto bg-white rounded-3xl shadow-none border border-gray-100 p-2`
- Строки (tr): `border-b border-gray-50 last:border-none group hover:bg-donezo-light/30 transition-colors duration-200`
- Ячейки (td/th): Выравнивание `align-middle`. Цвет текста `text-gray-400` для неактивных/дефолтных элементов, который меняется на `group-hover:text-donezo-dark` при наведении на строку.

## 5. Микро-взаимодействия (Micro-interactions)
- Всегда используйте `transition-all duration-200` (или `transition-colors`) для интерактивных элементов.
- Для кнопок комбинируйте изменение цвета с изменением тени и позиции (поднятие над экраном на ховер).
- Если элемент кликабельный, убедитесь, что он выглядит таковым, но избегайте "квадратных" бордеров (Tailwind дефолты или `rounded-md`/`rounded-lg`). **Минимум `rounded-xl`, оптимум `rounded-full`**.
