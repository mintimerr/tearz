# Собираем Tearz Board в Rive — самому

**Цель Day 1:** в приложении на симуляторе каждая буква бьёт `stroke`.  
**Цель Day 3:** полный demo — erase, look, focus, gaze.

Контракт: `scripts/board-animation-game-spec.md`  
Проверка: `npm run rive:validate` (фазы ниже)

---

## Перед стартом (10 мин)

```bash
cd cortex-mobile
npm run rive:refs
python3 scripts/prepare-rive-board-layers.py
```

Открой [rive.app](https://rive.app) → **New file** → имя `tearz-board`.

Папки:
- `assets/rive/refs/` — референсы
- `assets/rive/layers/` — артборд 420×580 + подсказки зон

---

# DAY 1 — «буква = удар» (2–3 часа)

## Шаг 1. Артборд

1. Artboard → **TearzBoard** → **420 × 580**
2. Фон прозрачный
3. Импорт `layers/00-artboard-reference.png`
4. Opacity **35%**, Lock слой, имя `ref`

## Шаг 2. Два слоя (MVP, без головы отдельно)

Пока достаточно **body** + **arm** (marker внутри arm).

1. **Pen** (или Pencil) — обведи силуэт тела **без** вытянутой руки  
   - Заливка cyan `#2EC4C4`  
   - Имя слоя: `body`
2. Обведи **руку + маркер** отдельно  
   - Маркер `#152238`  
   - Имя: `arm`
3. Скрыть/удали `ref`

**Pivot arm:** точка плеча (где рука крепится к телу).  
Перетащи origin arm на плечо → при вращении рука крутится от плеча.

**Иерархия:**
```
body
 └── arm   (child of body — плечо совпадает)
```

## Шаг 3. Анимация Idle (loop, 3 сек, 60 fps)

Timeline → New animation → **Idle**

| Время | body scale Y | arm rotation |
|-------|--------------|--------------|
| 0:00 | 100% | 0° |
| 1:30 | 101% | -1° |
| 3:00 | 100% | 0° |

Loop ✓

## Шаг 4. Анимация Writing (one-shot, 0.2 сек = 12 кадров @ 60fps)

New animation → **Writing**

Только ключи на **arm** (и чуть body на кадре 4):

| Кадр | arm rotation | arm X |
|------|--------------|-------|
| 0 | 0° | 0 |
| 4 | -10° | -4px |
| 8 | -14° | -7px |
| 12 | 0° | 0 |

**Первый и последний кадр одинаковые** — важно для interrupt.

## Шаг 5. State Machine

1. **Animate → State Machine → New** → имя **`BoardMachine`**
2. States:
   - **Idle** → animation Idle, Loop
   - **Writing** → animation Writing, не loop
3. Entry: **Idle**
4. Transitions:
   - Idle → Writing: **Trigger `stroke`**
   - Writing → Idle: **On animation end** (Exit time)
5. Inputs → Add **Trigger** → имя `stroke`
6. (опционально) Trigger `idle` → Idle

**Writing state:** включи **Allow interruption** (если есть в UI) — чтобы быстрые буквы перезапускали удар.

## Шаг 6. Export → приложение

1. Export → Download `.riv`
2. Замени `assets/rive/tearz-board.riv`
3. `tearz-board-rive-source.ts`:

```ts
export const RIVE_BOARD_LEGACY_BOOTSTRAP = false;
export const RIVE_BOARD_ARTBOARD = 'TearzBoard';
```

4. Проверка фазы 1:

```bash
node scripts/validate-tearz-board-riv.mjs --phase=1
```

5. Перезапуск:

```bash
npx expo start --ios -c
```

**Тест:** открой доску → печатай → каждая буква дёргает руку.

---

# DAY 2 — erase + look + focus (2 часа)

## Анимации

**Erasing** (0.24 с): arm дуга -15° → -5° → 0°

**Look** (0.18 с): если есть head — поворот ±5°; пока нет head — body rotate ±2°

**Focus** (0.3 с): body наклон -2° к доске и возврат

## State Machine — добавь

| Trigger | Transition |
|---------|--------------|
| `erase` | Idle → Erasing → Idle |
| `look` | Idle → Look → Idle |
| `focus` | Idle → Focus → Idle |

Triggers **строго** lowercase: `erase`, `look`, `focus`.

```bash
node scripts/validate-tearz-board-riv.mjs --phase=2
```

---

# DAY 3 — gaze + polish (2 часа)

## Отдели head

1. Вырежи head из body (Pen)
2. Иерархия:

```
body
 ├── head
 └── arm
      └── marker
```

3. **Look** перенеси на head

## Number inputs

В BoardMachine → Inputs:

- `gazeX` (0–100, default 50)
- `gazeY` (0–100, default 25)

В состоянии **Idle** → bind:
- `gazeX` → head rotation от -8° (0) до +8° (100)
- `gazeY` → head Y или body lean

(В Rive: Input → Bind to property → Linear interpolation)

```bash
npm run rive:validate   # полная проверка phase 3
```

## Polish

- Сглаживание ключей (ease in/out)
- Idle: вторичное движение ушей
- Проверь на быстрой печати 10+ букв/сек

---

# Частые ошибки

| Проблема | Решение |
|----------|---------|
| Не видно персонажа | Artboard 420×580, Fit в приложении Contain |
| stroke не срабатывает | Trigger именно `stroke`, SM именно `BoardMachine` |
| Застревает в Writing | Transition Writing→Idle по **end of animation** |
| Белый фон | Удали fill артборда, экспорт с прозрачностью |
| Старый персонаж | `LEGACY_BOOTSTRAP = false`, перезапуск с `-c` |
| Expo Go | Rive только dev-build |

---

# Когда застрял

Скинь скрин:
1. Timeline Writing (ключи arm)
2. State Machine (states + transitions)
3. Inputs (список triggers)

Разберём точечно.
