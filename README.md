# VamShop Specification CLI + GUI

Node.js проект для автоматического заполнения спецификаций продуктов в таблице `products_specifications`.

Доступно два интерфейса:
- CLI (терминал)
- GUI на Electron (графический интерфейс)

## Что есть в проекте

Основные функции спецификаций находятся в `dist/tasks`:
- `updateMaterial`
- `updateColor`
- `updateHeight`
- `updateLoad`

`updateWeightShopify` и `updateWeightShopifyUS` удалены из рабочего сценария.

## Установка

```bash
npm install
```

## Настройка `.env`

```env
host=your-db-host
user=your-db-user
database=your-db-name
password=your-db-password

# optional defaults
SOURCE_LANGUAGE_ID=1
TARGET_LANGUAGE_ID=all

# optional specification IDs
SPEC_ID_MATERIAL=61
SPEC_ID_COLOR=60
SPEC_ID_HEIGHT=60
SPEC_ID_LOAD=786

# optional conversion factors
MM_TO_INCH_FACTOR=0.04
KG_TO_POUNDS_FACTOR=2.2
```

## Запуск GUI (Electron)

```bash
npm run gui
```

GUI позволяет:
- выбрать source language
- выбрать target language для `material` или `all`
- выбрать target language для `color/height/load` или `all`
- включить `dry-run`
- запускать задачи кнопками: `material`, `color`, `height`, `load`, `all`

## Запуск CLI

Интерактивное меню:

```bash
npm start
```

Прямой запуск:

```bash
node dist/cli.js run material --lang 3
node dist/cli.js run material --lang all
node dist/cli.js run color --target-lang 2
node dist/cli.js run height --target-lang 2
node dist/cli.js run load --target-lang 2
node dist/cli.js run all --material-lang all --target-lang all
node dist/cli.js run all --material-lang all --target-lang all --dry-run
```

## npm scripts

```bash
npm run gui
npm run gui:dev
npm run icons:build
npm run pack
npm run dist:mac
npm run dist:mac:unsigned
npm run dist:win
npm run dist:linux
npm run dist:all
npm run spec:material
npm run spec:color
npm run spec:height
npm run spec:load
npm run spec:all
```

## Packaging (Installers)

```bash
# быстрая проверка упаковки без инсталлятора
npm run pack

# macOS DMG (с подписью/нотаризацией если есть env)
npm run dist:mac

# macOS DMG без подписи
npm run dist:mac:unsigned

# Windows installer (.exe / nsis)
npm run dist:win

# Linux AppImage
npm run dist:linux
```

Готовые файлы появляются в папке `release/`.

## Иконки приложения

Используются файлы:
- `build/icons/icon.icns` (macOS)
- `build/icons/icon.ico` (Windows)
- `build/icons/icon.png` (Linux)

Автогенерация из одного исходника:

1. Положите исходник (рекомендуется 1024x1024):
   - `build/icons/source.png` (предпочтительно), или
   - `build/icons/source.jpg`, или
   - `build/icons/source.icns`
2. Запустите:

```bash
npm run icons:build
```

Скрипт обновит:
- `build/icons/icon.png`
- `build/icons/icon.icns`
- `build/icons/icon.ico`

Если исходник меньше `512x512`, скрипт завершится с ошибкой.

## Подпись и notarization

Скопируйте `.env.signing.example` в локальный env-файл (или экспортируйте переменные в shell) и заполните:

```env
CSC_LINK=
CSC_KEY_PASSWORD=
APPLE_ID=
APPLE_APP_SPECIFIC_PASSWORD=
APPLE_TEAM_ID=
WIN_CSC_LINK=
WIN_CSC_KEY_PASSWORD=
```

Как это работает:
- macOS signing: через `CSC_LINK`/`CSC_KEY_PASSWORD`
- macOS notarization: через `APPLE_ID`/`APPLE_APP_SPECIFIC_PASSWORD`/`APPLE_TEAM_ID`
- Windows signing: через `WIN_CSC_LINK`/`WIN_CSC_KEY_PASSWORD`

Нотаризация подключена через `afterSign`-hook: `scripts/notarize.js`.
Если Apple-переменные не заданы, notarization пропускается.

## Структура

```text
build/
  icons/
    icon.icns
    icon.ico
    icon.png
  entitlements/
    mac.plist
dist/
  cli.js
  index.js
  config/specs.js
  lib/db.js
  lib/numbers.js
  lib/runner.js
  tasks/
    updateMaterial.js
    updateColor.js
    updateHeight.js
    updateLoad.js
electron/
  main.js
  preload.js
  renderer/
    index.html
    styles.css
    renderer.js
scripts/
  notarize.js
```

## Логика задач

- `material`: перевод материалов из `source language` в выбранный язык или сразу во все target-языки.
- `color`: перевод цвета RU -> EN по словарю в выбранный target-язык или сразу во все.
- `height`: конвертация числовой высоты по коэффициенту `MM_TO_INCH_FACTOR` в выбранный target-язык или сразу во все.
- `load`: конвертация нагрузки по коэффициенту `KG_TO_POUNDS_FACTOR` в выбранный target-язык или сразу во все.

Во всех задачах используется prepared upsert:

```sql
INSERT INTO products_specifications (...)
VALUES (...)
ON DUPLICATE KEY UPDATE specification = VALUES(specification)
```
