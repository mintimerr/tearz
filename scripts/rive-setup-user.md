# Rive для Tearz Board — что скачать и как подключить

## Почему «не в Rive» сейчас

| Кто | Что может |
|-----|-----------|
| **Я (Cursor)** | Не открываю Rive Editor — это отдельное GUI-приложение |
| **Ты** | Собрать `.riv` в Rive Editor за 2–3 часа |
| **Код (уже есть)** | Зеркало `BoardMachine` — те же triggers, что в Rive |

Сейчас приложение использует **кодовую копию Rive** (`TearzBoardRig` + `useBoardStateMachine`).  
Когда появится настоящий `.riv` — переключим одним флагом.

---

## Вариант A — Rive Editor (рекомендую для топ-качества)

### 1. Скачай

- **Rive Editor**: https://rive.app/editor  
  (macOS / Web — бесплатный аккаунт достаточно для экспорта)

### 2. Подготовь референсы в проекте

```bash
cd cortex-mobile
npm run rive:refs
npm run rive:layers
```

Папки:
- `assets/rive/refs/` — референсы Tearz спиной
- `assets/rive/layers/` — подложка 420×580

### 3. Собери по гайду

Пошагово: **`scripts/rive-board-self-build.md`** (Day 1 = stroke + idle).

Имена **строго**:
- Artboard: `TearzBoard`
- State machine: `BoardMachine`
- Triggers: `stroke`, `erase`, `look`, `focus`, `idle`
- Number inputs: `gazeX`, `gazeY` (0–100)

### 4. Экспорт → в проект

1. Export → Download `.riv`
2. Замени `assets/rive/tearz-board.riv`
3. В `components/teacher/tearz-board-rive-source.ts`:

```ts
export const RIVE_BOARD_LEGACY_BOOTSTRAP = false;
export const RIVE_BOARD_ARTBOARD = 'TearzBoard';
```

4. Проверка:

```bash
npm run rive:validate
npx expo start --ios -c
```

**Важно:** Rive работает только в **dev-build**, не в Expo Go.

---

## Вариант B — RiveMCP (AI собирает .riv в Cursor)

Если хочешь, чтобы я собирал `.riv` из чата:

1. Releases: https://github.com/paradoxsyn/rivemcp-releases  
2. Скачай бинарник под macOS  
3. Добавь в Cursor → Settings → MCP → New Server  
4. Напиши мне: «RiveMCP подключён» — соберу `BoardMachine` по spec

---

## Что уже работает без Rive (зеркало контракта)

```
useBoardInputSync → pulse
useBoardDirector  → mode (stroke/erase/look/focus)
useBoardStateMachine → как BoardMachine в Rive
TearzBoardRig     → покадровая Writing/Erasing sequence
```

Тайминги = `scripts/board-animation-game-spec.md`:
- Writing 200 ms, interrupt на каждую букву
- Erasing 260 ms
- gazeX/gazeY — плавный blend

---

## Когда переключится на Rive

`tearz-board-performer.tsx` автоматически:

- `RIVE_BOARD_LEGACY_BOOTSTRAP = false` → **Rive**
- иначе → **кодовая BoardMachine** (сейчас)

Ничего больше менять не нужно.
