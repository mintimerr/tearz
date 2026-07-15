# Kling — готовые промпты для Tearz у доски

Референс (Image-to-Video):  
- **WRITE (печать):** `assets/board-concept/tearz-teacher-kling-write-ref-v2.png` ← спиной, без доски, чёрный маркер  
- **HERO (idle):** `assets/board-concept/tearz-teacher-bold-cutout.png`  
- **ERASE:** `assets/board-concept/tearz-teacher-peek-close.png`

---

## ТЗ: WRITE-видео (чтобы не было «1000 раз один видос»)

### Суть

Видео **не заменяет** Tearz и **не рисует текст** — оно даёт только **микро-движение руки** поверх статичного PNG.  
Текст на доске — только от пользователя. Фон — только доска приложения.

### Что снять в Kling (один клип)

| Параметр | Значение |
|----------|----------|
| Ракурс | Спина, как в `kling-write-ref-v2` |
| Движение | **Только запястье/предплечье** — короткий рывок маркером влево на 2–4 см |
| Тело | Почти неподвижно: ноги, корпус, голова — freeze |
| Маркер | **Чёрный** `#152238`, не оранжевый, не карандаш |
| В кадре | **Нет** букв, слов, линий, доски, стены, пола |
| Длина в Kling | 5 сек (возьмём из них ~0.2 сек) |
| Начало и конец | **Одна и та же поза** — микро-удар и возврат |

### Чего НЕ делать (иначе будет loop-ад)

- ❌ Писать буквы / слова / «He» / росчерк по всей доске  
- ❌ Длинное «пишет абзац» 2–3 секунды  
- ❌ Доска или белая поверхность в кадре  
- ❌ Поворот головы, шаг, наклон всего тела  
- ❌ Loop-friendly движение «пишет-пишет-пишет»

### Сколько клипов сгенерировать

**3 варианта** (stroke-a / stroke-b / stroke-c) — чуть разный угол руки или амплитуда.  
Приложение будет брать **случайный** — глаз не ловит повтор.

Промпты для вариантов — одна строка в конце меняется:

- **stroke-a:** `tiny wrist flick left, minimal motion`
- **stroke-b:** `small forearm nudge left, marker tip twitches once`
- **stroke-c:** `quick single tap stroke left, returns to rest`

### Как это ляжет в приложение (не как раньше)

| Слой | Что | Когда |
|------|-----|-------|
| 1 | PNG Tearz полный рост (`bold-only`) | Всегда, пока пишешь |
| 2 | Текст пользователя на доске | Всегда |
| 3 | WebP удар руки (прозрачный фон) | **Макс. 1 раз в 250 ms**, не на каждую букву |
| 4 | Процедурный сдвиг PNG к курсору | На каждый тап |

**Раньше ломалось так:** `key={pulse}` → WebP **перезапускался с кадра 0** на каждую букву → один и тот же жест ×1000.  
**Теперь:** видео — редкая «добивка» к PNG; при быстрой печати — только процедурная анимация.

### Обрезка после Kling

```bash
# Один вариант (~0.2 сек = 4–5 кадров)
./scripts/make-board-activity-webp.sh ~/Downloads/kling-write-a.mp4 write 0.20

# Три варианта → tearz-board-write-a.webp, -b.webp, -c.webp (подключим в коде)
```

Ищи в сыром mp4 **самый короткий рывок** (~0.8–1.2 сек от начала), остальное ffmpeg отрежет.

---

## Настройки Kling (для всех 3 клипов)

| Параметр | Значение |
|----------|----------|
| Режим | **Image to Video** |
| Reference | `tearz-teacher-bold-cutout.png` |
| Creativity | **0.35–0.45** (ниже = ближе к референсу) |
| Камера | **Fixed / Locked** — не двигать |
| Фон | Белый, без интерьера |

### Negative prompt (один на все клипы)

```
different character, human, realistic, 2D flat, anime, scary, watermark, logo, text, subtitles, UI, phone frame, extra limbs, deformed hands, blurry, low quality, dark background, room interior, desk clutter, multiple characters, hair, clothes, robot, metallic
```

### Character lock (вставляй в начало каждого промпта)

```
Same 3D cyan-teal round mascot Tearz from reference image. Large glossy eyes, tiny ears, soft squishy body, stubby arms. Premium cartoon squash-and-stretch like Kick Buttowski. Pure white background. Camera locked. No watermark. No text.
```

---

## 1. HERO — idle у доски (обязательно)

**Длительность Kling:** 5 сек  
**В приложении:** loop на сценах `invite` + `idle`  
**Скрипт после скачивания:**

```bash
./scripts/make-board-teacher-webp.sh ~/Downloads/kling-hero.mp4 4.5
```

### Prompt

```
Same 3D cyan-teal round mascot Tearz from reference image. Large glossy eyes, tiny ears, soft squishy body, stubby arms. Premium cartoon squash-and-stretch like Kick Buttowski. Pure white background. Camera locked. No watermark. No text.

Tearz teacher stands beside a whiteboard on the left, mascot on the right third of frame. Relaxed idle loop: gentle breathing, one slow blink, subtle head tilt toward the board, friendly inviting smirk, orange marker loosely in right hand. Tiny weight shift foot to foot. Calm premium teacher energy. Seamless loop, first and last frame match. 5 seconds.
```

---

## 2. WRITE — один удар маркером (обязательно)

**Референс (НОВЫЙ — наш Tearz, без доски, чёрный маркер):**  
`assets/board-concept/tearz-teacher-kling-write-ref-v2.png`  
Собран из `tearz-teacher-write-back-ref.png` скриптом `./scripts/make-kling-write-reference.py`

**Когда в приложении:** короткий клип 150–250 ms, **один раз** на тап (не loop, не restart с нуля на каждую букву)  
**Длительность Kling:** 5 сек (обрезать ~0.18–0.25 сек)  
**Скрипт:**

```bash
./scripts/make-board-activity-webp.sh ~/Downloads/kling-write.mp4 write 0.22
```

### Prompt

```
Same 3D cyan-teal round mascot Tearz from reference image. Rear view, back to camera. Black marker in right hand. Pure white background ONLY. Camera locked.

Micro stroke only: body and legs completely still. Right wrist makes ONE tiny flick left (2cm) and returns to exact same rest pose. No text appears. No lines drawn. No whiteboard. No room. First frame equals last frame. 5 seconds.
```

### Negative prompt (дополнительно к общему)

```
whiteboard, board frame, marker tray, wall, floor, room, front view, face visible, looking at camera, full scene, wide shot, empty board dominating frame, orange marker, yellow pencil, different character
```

---

## 3. ERASE — одно стирание (обязательно)

**Референс:** `tearz-teacher-kling-write-ref-v2.png` (тот же спиной, чёрный маркер / ластик в руке)

**Длительность Kling:** 5 сек  
**В приложении:** replay на каждый Backspace  
**Скрипт:**

```bash
./scripts/make-board-activity-webp.sh ~/Downloads/kling-erase.mp4 erase 0.28 0.9
```

### Prompt

```
Same 3D cyan-teal round mascot Tearz from reference image. Rear view, back to camera. Pure white background ONLY. Camera locked.

Micro erase only: body and legs completely still. Right arm makes ONE short wipe left with black marker eraser cap or small felt eraser, then returns to rest. No text. No whiteboard. No room. First frame equals last frame. 5 seconds.
```

### Negative prompt

```
whiteboard, board frame, wall, floor, room, front view, face visible, looking at camera, writing letters, long wipe across entire board, orange marker
```

---

## Подключение в код (после скриптов)

`components/teacher/tearz-board-hero-source.ts`:

```ts
export const TEARZ_BOARD_HERO_WEBP = require('@/assets/images/tearz-board-teacher.webp');
export const TEARZ_BOARD_WRITE_WEBP = require('@/assets/images/tearz-board-write.webp');
export const TEARZ_BOARD_ERASE_WEBP = require('@/assets/images/tearz-board-erase.webp');
```

---

## Опционально (позже, PNG уже стоят)

### Attach — смотрит вверх на «+»

```
Same Tearz from reference. White background, locked camera. Looks up from whiteboard toward top of frame, curious raised eyebrows, one hand still resting near board edge, subtle head lift only. 4 seconds.
```

### Submit — нажали ↑

```
Same Tearz from reference. Quick approving nod, lowers marker, small gesture toward board then slight turn toward camera with confident smirk. One-shot 4 seconds, white background.
```

### Chat exit — уходит в сторону

```
Same Tearz from reference. Steps back from whiteboard to the right, friendly small wave, making space, fades to side of frame. 5 seconds, white background, locked camera.
```

---

## Чеклист перед генерацией

- [ ] **WRITE референс = `tearz-teacher-kling-write-ref-v2.png`** (без доски)
- [ ] Creativity ≤ 0.45
- [ ] Камера fixed
- [ ] Фон белый
- [ ] В кадре нет текста / водяного знака Kling (скрипт обрезает 300px справа)
- [ ] Если персонаж «не тот» — снизь creativity до 0.3 и добавь в prompt: `EXACT match to reference character design`

## Если Kling выдал «не того» Tearz

1. Regenerate с creativity **0.25**
2. Добавь в prompt: `character must match reference image exactly, same face, same cyan color, same proportions`
3. Попробуй референс `tearz-teacher-bold-eyes-point.png` только для WRITE-клипа
