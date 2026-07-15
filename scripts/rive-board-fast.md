# Tearz Board в Rive — БЫСТРО (~25 мин)

**Без обводки Pen.** Импорт готовых PNG → state machine → export.

```bash
cd cortex-mobile
npm run rive:import-pack   # assets/rive/import-pack/
```

Скачай редактор: **https://rive.app/editor** (web или macOS app)

---

## 1. Новый файл (2 мин)

1. **New file** → `tearz-board`
2. Artboard → переименуй в **`TearzBoard`**
3. Размер: **391 × 520** (как кадры) или **420 × 580** — главное одинаково для всех кадров
4. Фон артборда: **прозрачный** (убери fill)

---

## 2. Idle — один кадр (3 мин)

1. **Assets** (панель слева) → **+** → Import
2. Выбери `import-pack/02-idle-frame.png`
3. Перетащи на артборд, **выровняй по низу** (ноги у нижнего края)
4. Имя слоя: `character`
5. Timeline → **New animation** → имя **`Idle`**
6. Длина **3 сек**, Loop ✓
7. (опционально) ключ scale Y 100% → 101% → 100% на `character`

---

## 3. Writing — image sequence (8 мин)

1. Import все файлы из `import-pack/animations/writing-a/` (f00…f04)
2. На timeline **New animation** → **`Writing`**
3. Длина **0.2 сек** (200 ms), **60 fps**, Loop ✗
4. Rive: выдели `character` → в Inspector **Image** → смени source по ключам:

   **Быстрый способ:** замени `character` image на каждом ключевом кадре:
   - 0:00.000 → f00.png  
   - 0:00.050 → f01.png  
   - 0:00.100 → f02.png  
   - 0:00.150 → f03.png  
   - 0:00.200 → f04.png  

   (Right-click timeline → **Convert to keyframes** если импортировал как sequence)

   **Или:** Assets → выбери все f00-f04 → **Import as animation** (если Rive предлагает) → привяжи к `Writing`.

5. **Первый и последний кадр** должны совпадать (f00 = f04 по позе) — для interrupt при быстрой печати

---

## 4. Erasing (5 мин)

Повтори шаг 3 для `import-pack/animations/erasing/` → анимация **`Erasing`**, **0.26 сек**, loop ✗

---

## 5. State Machine BoardMachine (5 мин)

**Animate → State Machine → New** → имя **`BoardMachine`**

### States
| State | Animation | Loop |
|-------|-----------|------|
| Idle | Idle | ✓ |
| Writing | Writing | ✗ |
| Erasing | Erasing | ✗ |

Entry → **Idle**

### Inputs (Triggers)
Добавь **строго lowercase**:
- `stroke`
- `erase`
- `idle`
- (позже) `look`, `focus`

### Transitions
```
Idle  --stroke-->  Writing  --[animation end]-->  Idle
Idle  --erase-->  Erasing  --[animation end]-->  Idle
Any   --idle-->   Idle
```

**Writing:** включи **Allow interruption** / **Can interrupt** — новый `stroke` перезапускает удар.

---

## 6. Export → в приложение (2 мин)

1. **Export** → Download `.riv`
2. Замени файл: `assets/rive/tearz-board.riv`
3. `components/teacher/tearz-board-rive-source.ts`:

```ts
export const RIVE_BOARD_LEGACY_BOOTSTRAP = false;
export const RIVE_BOARD_ARTBOARD = 'TearzBoard';
```

4. Проверка:

```bash
npm run rive:validate:day1
npx expo start --ios -c
```

5. Открой доску → печатай → каждая буква = `stroke`

---

## Чеклист «готово»

- [ ] Artboard `TearzBoard`
- [ ] State machine `BoardMachine`
- [ ] Triggers `stroke`, `erase`, `idle`
- [ ] Writing 0.2 с, interrupt
- [ ] Прозрачный фон
- [ ] `LEGACY_BOOTSTRAP = false`
- [ ] dev-build (не Expo Go)

---

## Если застрял

Скинь скрин **State Machine** + список **Inputs** — поправим за 2 минуты.

Полная версия с векторным rig: `scripts/rive-board-self-build.md`
