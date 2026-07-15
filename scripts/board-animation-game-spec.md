# Tearz Board — игровой контракт анимации (demo-quality)

Это ТЗ для **Rive-аниматора** или твоей сборки в Rive Editor.  
Код уже реализует этот контракт: **1 событие ввода → 1 trigger → 1 анимация**.

Файл: `assets/rive/tearz-board.riv`  
State machine: **`BoardMachine`**

---

## Эталон качества

Как в **Duolingo / Finch / банковских маскотах**:

- Один персонаж, один стиль, **без видео-наклеек**
- Каждое действие пользователя → **предсказуемая** короткая анимация
- Idle всегда живой (дыхание)
- Быстрая печать → анимации **перезапускаются** (interrupt), не копятся

Kling / Runway **не использовать в рантайме** — только как референс тайминга.

---

## Матрица: ввод → анимация

| Событие пользователя | Trigger в Rive | Анимация | Длина | Interrupt |
|---------------------|----------------|----------|-------|-----------|
| Открыл пустую доску | `focus` | Focus | 0.3 с | да |
| Набрал букву | `stroke` | Writing | 0.18–0.22 с | **да, каждая буква** |
| Backspace | `erase` | Erasing | 0.22–0.28 с | да |
| Тап по тексту / курсор | `look` | Look | 0.15–0.2 с | да |
| Пауза | — | Idle (loop) | 3–4 с | — |
| Движение курсора | `gazeX`, `gazeY` | blend в Idle | непрерывно | — |

**Текст на доске** рисует только пользователь (Kalam). Tearz **не рисует буквы**.

---

## Персонаж

- **Tearz** — cyan 3D-стиль, **спиной** к доске (смотрит влево-вверх)
- **Полный рост**, ноги у нижнего края артборда
- **Маркер** `#152238` в правой руке
- **Прозрачный** фон (не белый!)
- Референс: `assets/rive/refs/01-tearz-write-back-main.png`

---

## Риг (минимум для demo)

```
body (дыхание, лёгкий наклон)
 ├── head (look, gazeX/Y)
 └── arm_r (writing, erasing)
      └── marker
```

Ноги — часть `body`, **не анимировать отдельно**.

### Writing (ключевая анимация)

- Двигается **только** `arm_r` + `marker`
- Рывок влево 4–8° → возврат в покой
- **Первый кадр = последний кадр** (для seamless interrupt)
- 60 fps, ~12–14 кадров

### Erasing

- Короткая дуга руки, как стирание одной точки
- Не «машет по всей доске»

### Look

- Поворот `head` ±6° (полный поворот — через `gazeX` blend в Idle)

### Focus

- Весь корпус чуть к доске (-2°), ожидание ввода

### Idle (loop)

- Body scale Y 100% ↔ 101%
- Редкое моргание (если есть глаза) или микро-движение ушей

---

## State Machine `BoardMachine`

**States:** Idle (entry), Writing, Erasing, Look, Focus

**Transitions:**
```
Idle --stroke--> Writing --[on complete]--> Idle
Idle --erase--> Erasing --> Idle
Idle --look--> Look --> Idle
Idle --focus--> Focus --> Idle
Any --idle--> Idle
```

**Важно для игрового feel:**
- Writing **можно прервать** новым `stroke` (Allow interruption в Rive)
- Не используй длинные blend между несвязанными позами

**Number inputs (0–100):**
- `gazeX` — курсор по горизонтали текста
- `gazeY` — строка по вертикали

Привязка: rotation `head` и лёгкий `body` lean.

---

## Чеклист перед демо инвесторам / пользователям

- [ ] Заменён `tearz-board.riv` (не community заглушка)
- [ ] `npm run rive:validate` — все ✓
- [ ] `RIVE_BOARD_LEGACY_BOOTSTRAP = false`
- [ ] Каждая буква → видимый micro-stroke
- [ ] Backspace → erase
- [ ] Нет белых ореолов / мигания слоёв
- [ ] Персонаж **тот же Tearz**, что на остальных экранах

---

## Как получить файл, если не хочешь рисовать сам

**Вариант A — Rive-аниматор (рекомендую для demo)**

Отправь этот файл + `assets/rive/refs/` на Fiverr/Contra:

> Need Rive character for mobile app. Back view cyan mascot at whiteboard.  
> State machine BoardMachine: triggers stroke, erase, look, focus, idle.  
> Number inputs gazeX, gazeY. Writing 0.2s arm only. Transparent PNG export.  
> Budget $300–600, 3–5 days.

**Вариант B — сам в Rive** → `scripts/rive-board-workshop.md`

**Вариант C — 3D Blender** (если есть модель Tearz)

Рендер PNG sequence с alpha → импорт в Rive как timeline (дольше, но максимально «ваш» 3D).

---

## Подключение в коде (уже сделано)

```
useBoardInputSync → pulse, gaze
useBoardDirector (engine: rive) → riveTrigger
TearzBoardRive → fireState(trigger) + setInputState(gaze)
```

Каждая буква в режиме `rive` шлёт **`stroke`** без debounce.
