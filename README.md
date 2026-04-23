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
- `updateAutofill`

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

# GUI auth gate
AUTH_REQUIRED=1
AUTH_DB_URL=mysql://user:pass@host:3306/db
AUTH_DB_HOST=your-railway-host
AUTH_DB_PORT=3306
AUTH_DB_USER=your-railway-user
AUTH_DB_PASSWORD=your-railway-password
AUTH_DB_NAME=your-railway-db
AUTH_TABLE=auth_users
AUTH_DB_SSL=0
AUTH_DB_SSL_REJECT_UNAUTHORIZED=1
AUTH_MAX_FAILED_ATTEMPTS=5
AUTH_LOCKOUT_MS=300000
TRANSFER_SOURCE_LANGUAGE_ID=1

# optional specification IDs
SPEC_ID_MATERIAL=61
SPEC_ID_COLOR=60
SPEC_IDS_HEIGHT=754,722,721,720
SPEC_ID_LOAD=786
SPEC_IDS_LOAD=23,786
SPEC_IDS_AUTOFILL=24,22,709,723,724,725,726,715,67
SPEC_IDS_TRANSFER=766,22,23,24,762,760,759,758,757,60,61,751,67,68,773,709,715,767,720,721,722,723,724,725,726,769,770,753,754,755,756,752,750,749,763,765,772,771,764,768,779,774,775,776,777,778,780,781,782,784,785,786,787

# optional conversion factors
MM_TO_INCH_FACTOR=0.04
KG_TO_POUNDS_FACTOR=2.2
```

## GUI Authentication (Railway MySQL)

GUI now supports sign-in before any task can be executed.

1. Create users table in your auth database:

```sql
CREATE TABLE auth_users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
```

Or run:

```bash
npm run auth:init-table
```

2. Generate password hash:

```bash
npm run auth:hash -- "StrongPassword123!"
```

3. Insert user:

```sql
INSERT INTO auth_users (username, password_hash, is_active)
VALUES ('admin', '$2b$12$...');
```

Or run directly from terminal:

```bash
npm run auth:create-user -- admin "StrongPassword123!"
```

Reset password:

```bash
npm run auth:reset-password -- admin "NewStrongPassword456!"
```

Disable user:

```bash
npm run auth:disable-user -- admin
```

Notes:
- Use only hashed passwords (`bcrypt`), never plaintext.
- `AUTH_DB_URL` has priority over separate `AUTH_DB_HOST/AUTH_DB_USER/...`.
- If `AUTH_REQUIRED=0`, GUI works in local mode without login.

## Запуск GUI (Electron)

```bash
npm run gui
```

GUI позволяет:
- выбрать source language
- выбрать target language для `material` или `all`
- выбрать target language для `color/height/load/autofill` или `all`
- включить `dry-run`
- запускать задачи кнопками: `material`, `color`, `height`, `load`, `autofill`, `all`
- вручную выбрать продукт из списка, отметить нужные пункты спецификаций и отправить перенос

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
node dist/cli.js run autofill --target-lang all
node dist/cli.js run all --material-lang all --target-lang all
node dist/cli.js run all --material-lang all --target-lang all --dry-run
```

## npm scripts

```bash
npm run gui
npm run gui:dev
npm run auth:hash -- "StrongPassword123!"
npm run auth:init-table
npm run auth:create-user -- admin "StrongPassword123!"
npm run auth:reset-password -- admin "NewStrongPassword456!"
npm run auth:disable-user -- admin
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
npm run spec:autofill
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
  lib/transfer.js
  tasks/
    updateMaterial.js
    updateColor.js
    updateHeight.js
    updateLoad.js
    updateAutofill.js
electron/
  main.js
  preload.js
  renderer/
    index.html
    styles.css
    renderer.js
scripts/
  auth-admin.js
  hash-password.js
  generate-icons.js
  notarize.js
```

## Логика задач

- `material`: перевод материалов из `source language` в выбранный язык или сразу во все target-языки.
- `color`: перевод цвета RU -> EN по словарю в выбранный target-язык или сразу во все.
- `height`:
  - `spec_id=754`, `722`, `721`, `720` (регулируемая высота и вылет от места крепления)
  - для `language_id=2` (US): конвертация `mm -> inch` по коэффициенту `MM_TO_INCH_FACTOR` с дробями (`¼`, `½`, `¾`)
  - для `language_id=3..8`: перенос исходного значения без конвертации
- `load`:
  - `spec_id=23` и `spec_id=786`
  - для `language_id=2` (US): конвертация `kg -> lbs` с красивыми дробями (`¼`, `½`, `¾`)
  - для `language_id=3..8`: перенос исходных чисел без конвертации
- `autofill`: прямое копирование значения спецификаций без трансформации из `source language` в target-языки по массиву `SPEC_IDS_AUTOFILL`.
- `manual transfer` (в GUI):
  - источник фиксирован на `language_id=1` (переопределяется через `TRANSFER_SOURCE_LANGUAGE_ID`)
  - выбор одного продукта
  - отображение текстовых значений по доступным `spec_id`
  - чекбоксы для выбора пунктов
  - для `spec_id=23`, `786`, `754`, `722`, `721`, `720`: конвертация только при `language_id=2` (US), иначе прямой перенос
  - перенос отмеченных пунктов в выбранный target-язык или `all`

По умолчанию `SPEC_IDS_AUTOFILL`:
- `24` (vesa)
- `22` (диагональ max)
- `709` (диагональ min)
- `723`, `724` (углы поворота)
- `725`, `726` (углы вращения)
- `715` (гарантия, можно переопределить через `SPEC_IDS_AUTOFILL`)
- `67` (количество в групповой)

Во всех задачах используется prepared upsert:

```sql
INSERT INTO products_specifications (...)
VALUES (...)
ON DUPLICATE KEY UPDATE specification = VALUES(specification)
```
