# Rive — Tearz у доски (BoardMachine)

См. также **игровой контракт для demo**: `scripts/board-animation-game-spec.md`

Файл: `assets/rive/tearz-board.riv`  
После сборки: `RIVE_BOARD_LEGACY_BOOTSTRAP = false` в `tearz-board-rive-source.ts`.

---

## Референсы

| Файл | Зачем |
|------|--------|
| `tearz-teacher-bold-cutout.png` | Пропорции, фронт, полный рост |
| `tearz-teacher-kling-write-ref-v2.png` | Поза спиной, маркер #152238 |
| Kling mp4 | Тайминг удара руки (0.2 с) |

---

## Артборд

- **Имя:** `TearzBoard` (или default)
- **Размер:** ~400×560 px (прозрачный фон)
- **Персонаж:** спиной к «доске» (смотрит влево-вверх), полный рост, cyan Tearz
- **Маркер:** чёрный `#152238` в правой руке

---

## State Machine: `BoardMachine`

### Состояния

| State | Тип | Длина | Описание |
|-------|-----|-------|----------|
| `Idle` | loop | 3–4 с | дыхание, редкое моргание, рука у доски |
| `Writing` | one-shot | 0.18–0.25 с | удар маркером влево → возврат |
| `Erasing` | one-shot | 0.2–0.28 с | короткое стирание |
| `Look` | one-shot | 0.15–0.2 с | голова/корпус к новой точке |
| `Focus` | one-shot | 0.3 с | наклон к пустой доске (открыли ввод) |

Переходы: любой one-shot → **Idle** (auto, после анимации).

### Triggers (имена строго такие)

```
stroke   — новая буква (не чаще чем код шлёт — ~180ms debounce в director)
erase    — backspace
look     — тап по тексту / перенос курсора
focus    — открыли доску, поле пустое
idle     — сброс (опционально)
```

### Number inputs (0–100)

```
gazeX  — горизонталь взгляда (0 = левый край текста, 100 = правый)
gazeY  — вертикаль (0 = верх доски, 100 = низ)
```

Привяжи к повороту головы / смещению верхней части тела (не весь персонаж).

---

## Чеклист в Rive Editor

1. Импорт PNG Tearz (слои: тело, голова, рука, маркер)
2. Кости: плечо → предплечье → маркер (минимум для Writing)
3. Анимация Writing: **только запястье/предплечье**, ноги freeze
4. Export → `.riv` → положить в `assets/rive/tearz-board.riv`
5. В коде: `RIVE_BOARD_LEGACY_BOOTSTRAP = false`
6. Пересобрать dev-client (`npx expo run:ios`)

---

## Временная заглушка

Сейчас `tearz-board.riv` = копия community `tearz.riv`:

- `stroke` / `erase` → trigger `talk`
- `idle` → `idle`
- gaze inputs игнорируются

Замени файл — сразу уйдут Kling-оверлеи, останется только Rive.

---

## Атрибуция

Текущая заглушка — community asset (CC BY). Кастомный Tearz — свой файл, атрибуция не нужна.
