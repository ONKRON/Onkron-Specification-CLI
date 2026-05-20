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

# optional Bitrix logging
# option A: direct Bitrix REST webhook + dialog
BITRIX_WEBHOOK_BASE_URL=https://your-company.bitrix24.ru/rest/<user_id>/<webhook_token>
BITRIX_DIALOG_ID=chat101362
# alternatively you can pass chat URL and dialog id will be parsed from IM_DIALOG
BITRIX_CHAT_URL=https://your-company.bitrix24.ru/online/?IM_DIALOG=chat101362

# option B: generic JSON webhook (if you use your own relay endpoint)
BITRIX_WEBHOOK_URL=https://example.com/webhook
BITRIX_TIMEOUT_MS=4000
PRODUCT_IMAGE_BASE_URL=https://shop.onkron.ru/images/product_images/info_images

# optional specification IDs
SPEC_ID_MATERIAL=61
SPEC_ID_COLOR=60
SPEC_IDS_HEIGHT=754,722,721,720,762,760,68
SPEC_ID_LOAD=786
SPEC_IDS_LOAD=23,786,766,767,763
SPEC_IDS_AUTOFILL=24,22,709,723,724,725,726,715,67
SPEC_IDS_TRANSFER=766,22,23,24,762,760,759,758,757,60,61,751,67,68,773,709,715,767,720,721,722,723,724,725,726,769,770,753,754,755,756,752,750,749,763,765,772,771,764,768,779,774,775,776,777,778,780,781,782,784,785,786,787

# optional conversion factors
MM_TO_INCH_FACTOR=0.04
KG_TO_POUNDS_FACTOR=2.2
M3_TO_FT3_FACTOR=35.31
VOLUME_FT3_DECIMALS=6
VOLUME_RAW_TO_M3_THRESHOLD=1000
VOLUME_RAW_TO_M3_DIVISOR=1000000
```

## GUI Authentication (Railway MySQL)

GUI now supports sign-in before any task can be executed.

1. Create users table in your auth database:

```sql
CREATE TABLE auth_users (
  id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('user', 'advanced', 'admin') NOT NULL DEFAULT 'user',
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
npm run auth:create-user -- admin "StrongPassword123!" admin
npm run auth:create-user -- manager "StrongPassword123!" user
npm run auth:create-user -- lead "StrongPassword123!" advanced
```

Reset password:

```bash
npm run auth:reset-password -- admin "NewStrongPassword456!"
```

Change role:

```bash
npm run auth:set-role -- manager advanced
```

Disable user:

```bash
npm run auth:disable-user -- admin
```

Notes:
- Use only hashed passwords (`bcrypt`), never plaintext.
- `AUTH_DB_URL` has priority over separate `AUTH_DB_HOST/AUTH_DB_USER/...`.
- If `AUTH_REQUIRED=0`, GUI works in local mode without login.
- Roles: `user` can transfer/edit product specs, `advanced` can also run bulk task blocks, `admin` has all advanced permissions.

If the table already exists without `role`, add it:

```sql
ALTER TABLE auth_users
  ADD COLUMN role ENUM('user', 'advanced', 'admin') NOT NULL DEFAULT 'user'
  AFTER password_hash;
```

## Railway API mode for distributed `.app/.dmg`

For sharing the desktop app with other users, do not ship `.env` or DB passwords inside Electron.
Run the backend API on Railway and put all secrets there. The packaged app only needs the public API URL.

### 1. Railway service

Use this start command:

```bash
npm run server
```

The repository also contains `railway.toml`, so Railway should use this command automatically after redeploy.

Set Railway variables:

```env
PORT=3000
API_SESSION_SECRET=generate-long-random-string
AUTH_REQUIRED=1
AUTH_DB_URL=mysql://user:pass@host:3306/auth_db

host=shop-db-host
user=shop-db-user
database=shop-db-name
password=shop-db-password

TRANSFER_SOURCE_LANGUAGE_ID=1
PRODUCT_IMAGE_BASE_URL=https://shop.onkron.ru/images/product_images/info_images
BITRIX_WEBHOOK_BASE_URL=https://your-company.bitrix24.ru/rest/<user_id>/<webhook_token>
BITRIX_DIALOG_ID=chat101362
```

Also keep the needed `SPEC_*` and conversion variables on Railway if you override defaults.

Health check:

```bash
curl https://your-railway-api.up.railway.app/health
```

Expected response:

```json
{"ok":true}
```

Public download page:

```text
https://your-railway-api.up.railway.app/
```

Web application:

```text
https://your-railway-api.up.railway.app/app
```

The web UI uses the same auth, roles, task, transfer and editor API routes as the Electron app.

Download buttons can redirect to external files:

```env
DOWNLOAD_MACOS_URL=https://example.com/VamShop-Spec-GUI-mac.dmg
DOWNLOAD_WINDOWS_URL=https://example.com/VamShop-Spec-GUI-win.exe
```

If these variables are not set, the API automatically uses GitHub Releases:

```env
DOWNLOAD_GITHUB_REPOSITORY=webobscure/Onkron-Specification-CLI
DOWNLOAD_GITHUB_TAG=latest
DOWNLOAD_MACOS_ASSET_NAME=VamShop Spec GUI-1.0.0-mac.dmg
DOWNLOAD_WINDOWS_ASSET_NAME=VamShop Spec GUI-1.0.0-win.exe
```

Set `DOWNLOAD_GITHUB_RELEASES=0` to disable this fallback.

Or serve files from the server filesystem:

```env
DOWNLOAD_RELEASE_DIR=/app/release
DOWNLOAD_MACOS_FILE=/app/release/VamShop-Spec-GUI-mac.dmg
DOWNLOAD_WINDOWS_FILE=/app/release/VamShop-Spec-GUI-win.exe
```

If explicit files are not set, the API tries to find the newest `.dmg`/`.zip` for macOS and `.exe`/`.msi` for Windows inside `DOWNLOAD_RELEASE_DIR` or `release/`.

### 2. Local app config before building

Create `electron/app-config.json` locally:

```json
{
  "apiBaseUrl": "https://your-railway-api.up.railway.app"
}
```

This file is ignored by git and can be included into the local packaged build.

### 3. Build installer

```bash
npm run dist:mac:unsigned
```

The `.dmg` will be created in `release/`. In API mode Electron sends auth, tasks, transfer and editor requests to Railway instead of using local DB credentials.

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
npm run server
npm run auth:hash -- "StrongPassword123!"
npm run auth:init-table
npm run auth:create-user -- admin "StrongPassword123!"
npm run auth:reset-password -- admin "NewStrongPassword456!"
npm run auth:set-role -- admin advanced
npm run auth:disable-user -- admin
npm run icons:build
npm run pack
npm run dist:mac
npm run dist:mac:unsigned
npm run dist:win
npm run dist:win:x64
npm run dist:win:arm64
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

# Windows installer (.exe / nsis, x64 по умолчанию)
npm run dist:win

# Явные Windows-сборки
npm run dist:win:x64
npm run dist:win:arm64

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
  - `spec_id=754`, `722`, `721`, `720`, `762`, `760`, `68` (регулируемая высота, вылет, габариты в сборе/индивидуальной/групповой упаковки)
  - для `language_id=2` (US): конвертация `mm -> inch` по коэффициенту `MM_TO_INCH_FACTOR` с дробями (`¼`, `½`, `¾`)
  - для размерных пунктов (`68`, `760`, `762`) нормализуется формат `A x B x C` (пробелы вокруг `x`)
  - для `language_id=3..8`: перенос исходного значения без конвертации
- `load`:
  - `spec_id=23`, `786`, `766`, `767`: для `language_id=2` (US) конвертация `kg -> lbs` с красивыми дробями (`¼`, `½`, `¾`)
  - `spec_id=763`: для `language_id=2` (US) конвертация `m3 -> ft3` по коэффициенту `M3_TO_FT3_FACTOR`
    - точность настраивается через `VOLUME_FT3_DECIMALS` (по умолчанию `6`)
    - если исходное число выглядит как "сырое" большое значение (например `188700`), оно сначала нормализуется в `m3` по `VOLUME_RAW_TO_M3_THRESHOLD/VOLUME_RAW_TO_M3_DIVISOR`
  - для `language_id=3..8`: перенос исходных чисел без конвертации
- `autofill`: прямое копирование значения спецификаций без трансформации из `source language` в target-языки по массиву `SPEC_IDS_AUTOFILL`.
- `manual transfer` (в GUI):
  - источник фиксирован на `language_id=1` (переопределяется через `TRANSFER_SOURCE_LANGUAGE_ID`)
  - выбор одного продукта
  - карточки продуктов включают превью из `products.products_image`
  - отображение текстовых значений по доступным `spec_id`
  - чекбоксы для выбора пунктов
  - для `spec_id=23`, `786`, `766`, `767`: конвертация только при `language_id=2` (US), `kg -> lbs`
  - для `spec_id=754`, `722`, `721`, `720`, `762`, `760`, `68`: конвертация только при `language_id=2` (US), `mm -> inches` (дроби `¼`, `½`, `¾`)
  - для размерных пунктов (`68`, `760`, `762`) нормализуется формат `A x B x C` (пробелы вокруг `x`)
  - для `spec_id=763`: конвертация только при `language_id=2` (US), `m3 -> ft3` с точностью `VOLUME_FT3_DECIMALS`
  - перенос отмеченных пунктов в выбранный target-язык или `all`
- Bitrix logging (опционально):
  - отправка сводных логов при реальной записи (`dry-run=false` и `updated > 0`)
  - для ручного переноса в лог добавляется `productId` и `productName`
  - каналы: `gui-task`, `gui-transfer`, `cli-task`

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
