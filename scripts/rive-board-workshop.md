# Rive Workshop — Tearz у доски (пошагово)

Время: **3–6 часов** первый раз. Результат: `assets/rive/tearz-board.riv` → приложение без Kling-наклеек.

---

## 0. Подготовка (5 мин)

```bash
cd cortex-mobile
python3 scripts/prepare-rive-board-refs.py
node scripts/validate-tearz-board-riv.mjs   # до работы — покажет заглушку
```

Открой [rive.app](https://rive.app) → **New file** → назови `tearz-board`.

Референсы лежат в `assets/rive/refs/` — держи их рядом с редактором.

---

## 1. Артборд (10 мин)

1. **Artboard** → переименуй в `TearzBoard`
2. Размер: **W 420 × H 580**
3. Фон: **прозрачный** (не белый!)
4. Перетащи `01-tearz-write-back-main.png` на артборд
5. Выровняй: ноги у нижнего края, персонаж по центру по горизонтали
6. **Lock** слой референса, opacity 40% — это underlay, потом скроешь

Цвет Tearz: cyan `#2DD4D4` … `#1AB8C0` (как в bold-cutout).

---

## 2. Слои (30–60 мин) — без полного 3D, только нужное

Разбей персонажа на **4 слоя** (можно обвести Pen tool поверх референса или импортировать вырезанные PNG):

| Слой | Имя | Двигается в анимациях |
|------|-----|------------------------|
| 1 | `body` | Idle: дыхание; Look: лёгкий поворот |
| 2 | `head` | Look: поворот к курсору |
| 3 | `arm` | **Writing**, **Erasing** |
| 4 | `marker` | дочерний к `arm`, чёрный `#152238` |

**Иерархия:**
```
body
 ├── head
 └── arm
      └── marker
```

**Pivot (origin) для `arm`:** плечо (правое, у тела).  
**Pivot для `head`:** центр головы.

> Не ригуй ноги отдельно — они всегда статичны.

---

## 3. Анимации (Timeline)

Создай **5 линейных анимаций** (не loop, кроме Idle):

### `Idle` (LOOP, 3 с, 60 fps)

| Кадр | body scale Y | head rotate |
|------|--------------|-------------|
| 0 | 100% | 0° |
| 45 | 101% | -1° |
| 90 | 100% | 0° |
| 135 | 101% | 1° |
| 180 | 100% | 0° |

Маркер чуть качается вместе с arm (0.5°).

### `Writing` (ONE-SHOT, 0.22 с = 13 кадров @ 60fps)

Только **arm** (+ marker):

| Кадр | arm rotate | arm X |
|------|------------|-------|
| 0 | 0° | 0 |
| 4 | -8° | -3px |
| 8 | -12° | -6px |
| 12 | 0° | 0 |

Тело/голова **не трогай** (или body scale 100.5% на кадре 4 — микро).

### `Erasing` (ONE-SHOT, 0.24 с)

Arm ведёт короткую дугу влево-вправо (стирание):

| Кадр | arm rotate |
|------|------------|
| 0 | 0° |
| 6 | -15° |
| 12 | -5° |
| 14 | 0° |

### `Look` (ONE-SHOT, 0.18 с)

Только **head** (и чуть body 1–2°):

- Поворот head ±3–6° в зависимости от `gazeX` — см. раздел 5 (blend).

Для базовой версии: одна анимация «head nod left» на trigger.

### `Focus` (ONE-SHOT, 0.3 с)

Лёгкий наклон всего тела к доске (body rotate -2°, head -3°), возврат.

---

## 4. State Machine `BoardMachine` (20 мин)

**Animate → State Machine → New** → имя: **`BoardMachine`**

### States (добавь и привяжи анимации)

| State | Animation | Loop |
|-------|-----------|------|
| Idle | Idle | ✓ |
| Writing | Writing | ✗ |
| Erasing | Erasing | ✗ |
| Look | Look | ✗ |
| Focus | Focus | ✗ |

**Entry state:** `Idle`

### Transitions

```
Idle --[trigger: stroke]--> Writing --[exit time]--> Idle
Idle --[trigger: erase]--> Erasing --> Idle
Idle --[trigger: look]--> Look --> Idle
Idle --[trigger: focus]--> Focus --> Idle
любой --[trigger: idle]--> Idle
```

Для **Writing → Idle**: transition **After animation completes** (не по таймеру).

### Triggers (имена **строго** как в коде)

Создай в панели Inputs → **Trigger**:

- `stroke`
- `erase`
- `look`
- `focus`
- `idle`

---

## 5. Gaze inputs (15 мин) — «смотрит на текст»

Inputs → **Number**:

- `gazeX` (default 50, range 0–100)
- `gazeY` (default 20, range 0–100)

**В состоянии Idle** добавь **Blend 1D** или **Listeners**:

- При изменении `gazeX` → поворот `head` от -8° (gazeX=0) до +8° (gazeX=100)
- При изменении `gazeY` → сдвиг pivot head / лёгкий nod

В Rive 2024+: **State Machine → Bind input `gazeX` to head rotation** (Linear interpolation).

Код шлёт `gazeX = boardProgress * 100`, `gazeY = lineProgress * 100`.

---

## 6. Export и подключение (5 мин)

1. **Export** → `.riv`
2. Замени `assets/rive/tearz-board.riv`
3. Проверка:

```bash
node scripts/validate-tearz-board-riv.mjs
```

4. В `components/teacher/tearz-board-rive-source.ts`:

```ts
export const RIVE_BOARD_LEGACY_BOOTSTRAP = false;
export const RIVE_BOARD_ARTBOARD = 'TearzBoard'; // если назвал артборд
```

5. Перезапуск:

```bash
npx expo start --ios -c
```

---

## 7. Отладка в приложении

| Симптом | Решение |
|---------|---------|
| Персонаж не виден | `Fit.Contain`, проверь размер артборда |
| Триггер не срабатывает | Имена trigger case-sensitive: `stroke` не `Stroke` |
| Застревает в Writing | Transition Writing→Idle на **animation end** |
| Expo Go | Rive нет — только dev-build |
| Старый community персонаж | Замени .riv, `LEGACY_BOOTSTRAP = false` |

---

## 8. Упрощённый путь (1 час, MVP)

Если полный rig долго:

1. Один PNG `03-tearz-write-idle-frame0` как **mesh** или single image
2. Только анимации **Writing** (двигаешь весь слой на 3px влево и назад)
3. State machine: Idle + Writing + trigger `stroke`
4. `erase` / `look` / `focus` временно тоже ведут в Writing

Потом итеративно добавляешь голову и gaze.

---

## 9. Нанять аниматора (бриф)

Отправь этот файл + `assets/rive/refs/` + ссылку на приложение.

**Deliverable:** один `.riv`, `BoardMachine`, 5 triggers, 2 number inputs, прозрачный фон, спина к доске, маркер #152238.

**Бюджет:** $150–500 Fiverr / Contra (2D Rive character).

---

## Контракт с кодом (не менять без синка)

```
State machine: BoardMachine
Triggers: stroke | erase | look | focus | idle
Numbers: gazeX | gazeY (0–100)
File: assets/rive/tearz-board.riv
```
