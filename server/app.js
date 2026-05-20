const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
const packageJson = require("../package.json");
const { COUNTRY_BY_LANGUAGE_ID } = require("../dist/config/specs");
const { runTask, getRunPlan } = require("../dist/cli");
const {
  listTransferProducts,
  getTransferProductSpecifications,
  getEditableProductSpecifications,
  saveEditableProductSpecifications,
  transferSelectedProductSpecifications,
} = require("../dist/lib/transfer");
const { sendBitrixChangeLog } = require("../dist/lib/bitrixLogger");
const { isAuthRequired, authenticate } = require("../electron/auth");

const ALL_TARGETS = "all";
const TRANSFER_SOURCE_LANGUAGE_ID = Number(process.env.TRANSFER_SOURCE_LANGUAGE_ID || 1);
const TOKEN_TTL_SECONDS = Math.max(
  300,
  Number(process.env.API_SESSION_TTL_SECONDS || 60 * 60 * 12)
);
const SESSION_SECRET =
  process.env.API_SESSION_SECRET ||
  process.env.AUTH_SESSION_SECRET ||
  crypto.randomBytes(32).toString("hex");
const RELEASE_DIR = path.resolve(
  process.env.DOWNLOAD_RELEASE_DIR || path.join(__dirname, "..", "release")
);
const WEB_APP_DIR = path.join(__dirname, "..", "electron", "renderer");
const ICONS_DIR = path.join(__dirname, "..", "build", "icons");

function normalizeLanguageInput(value, fallback, { allowAll = false } = {}) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (!normalized) {
      return fallback;
    }
    if (allowAll && normalized === ALL_TARGETS) {
      return ALL_TARGETS;
    }

    const parsed = Number(normalized);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
  }

  if (typeof value === "number") {
    return Number.isInteger(value) && value > 0 ? value : fallback;
  }

  return fallback;
}

function hasAdvancedAccess(user) {
  const role = String(user?.role || "user").trim().toLowerCase();
  return role === "advanced" || role === "admin";
}

function base64UrlEncode(value) {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function base64UrlDecode(value) {
  return JSON.parse(Buffer.from(String(value || ""), "base64url").toString("utf8"));
}

function signPayload(payloadPart) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(payloadPart).digest("base64url");
}

function createToken(user) {
  const payload = {
    user,
    exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SECONDS,
  };
  const payloadPart = base64UrlEncode(payload);
  return `${payloadPart}.${signPayload(payloadPart)}`;
}

function verifyToken(token) {
  const [payloadPart, signature] = String(token || "").split(".");
  if (!payloadPart || !signature) {
    return null;
  }

  const expected = signPayload(payloadPart);
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(signature);
  if (
    expectedBuffer.length !== actualBuffer.length ||
    !crypto.timingSafeEqual(expectedBuffer, actualBuffer)
  ) {
    return null;
  }

  const payload = base64UrlDecode(payloadPart);
  if (!payload?.user || !payload?.exp || Number(payload.exp) < Math.floor(Date.now() / 1000)) {
    return null;
  }

  return payload.user;
}

function createSessionState(user = null) {
  const required = isAuthRequired();
  if (!required) {
    return {
      required: false,
      authenticated: true,
      user: { id: 0, username: "локально", role: "admin" },
    };
  }

  return {
    required: true,
    authenticated: Boolean(user),
    user,
  };
}

function getBearerToken(req) {
  const header = String(req.headers.authorization || "").trim();
  const match = header.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : "";
}

function getRequestUser(req) {
  if (!isAuthRequired()) {
    return { id: 0, username: "локально", role: "admin" };
  }

  const user = verifyToken(getBearerToken(req));
  if (!user) {
    const error = new Error("Требуется авторизация");
    error.statusCode = 401;
    throw error;
  }

  return user;
}

function ensureAdvanced(user) {
  if (!hasAdvancedAccess(user)) {
    const error = new Error("Недостаточно прав. Нужна роль advanced или admin.");
    error.statusCode = 403;
    throw error;
  }
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;

  for await (const chunk of req) {
    size += chunk.length;
    if (size > 2 * 1024 * 1024) {
      const error = new Error("Слишком большой запрос");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) {
    return {};
  }

  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : {};
}

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
  });
  res.end(JSON.stringify(payload));
}

function sendHtml(res, statusCode, html) {
  res.writeHead(statusCode, {
    "Content-Type": "text/html; charset=utf-8",
    "Cache-Control": "public, max-age=300",
    "X-Content-Type-Options": "nosniff",
  });
  res.end(html);
}

function sendFile(res, filePath, contentType, { cache = "public, max-age=300" } = {}) {
  if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    sendJson(res, 404, { error: "Файл не найден" });
    return;
  }

  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    "Content-Type": contentType,
    "Content-Length": stat.size,
    "Cache-Control": cache,
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(filePath).pipe(res);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function escapeAttribute(value) {
  return escapeHtml(value).replace(/`/g, "&#096;");
}

function sendError(res, error) {
  const statusCode = Number(error?.statusCode) || 500;
  sendJson(res, statusCode, {
    error: error?.message || "Внутренняя ошибка сервера",
  });
}

function wantsNdjson(req) {
  return String(req.headers.accept || "").includes("application/x-ndjson");
}

function writeNdjson(res, type, payload) {
  res.write(`${JSON.stringify({ type, payload })}\n`);
}

function initNdjson(res) {
  res.writeHead(200, {
    "Content-Type": "application/x-ndjson; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Accel-Buffering": "no",
  });
}

function validateProductId(value) {
  const productId = Number(value);
  if (!Number.isInteger(productId) || productId < 1) {
    throw new Error("Нужен корректный productId");
  }
  return productId;
}

function validateLanguageId(value) {
  const languageId = Number(value);
  if (!Number.isInteger(languageId) || languageId < 1) {
    throw new Error("Нужен корректный languageId");
  }
  return languageId;
}

function handleWebAppAsset(res, pathname) {
  const assets = {
    "/app": {
      file: path.join(WEB_APP_DIR, "index.html"),
      contentType: "text/html; charset=utf-8",
      cache: "no-store",
    },
    "/app/": {
      file: path.join(WEB_APP_DIR, "index.html"),
      contentType: "text/html; charset=utf-8",
      cache: "no-store",
    },
    "/app/styles.css": {
      file: path.join(WEB_APP_DIR, "styles.css"),
      contentType: "text/css; charset=utf-8",
    },
    "/app/web-api.js": {
      file: path.join(WEB_APP_DIR, "web-api.js"),
      contentType: "application/javascript; charset=utf-8",
      cache: "no-store",
    },
    "/app/renderer.js": {
      file: path.join(WEB_APP_DIR, "renderer.js"),
      contentType: "application/javascript; charset=utf-8",
      cache: "no-store",
    },
    "/favicon.ico": {
      file: path.join(ICONS_DIR, "icon.ico"),
      contentType: "image/x-icon",
      cache: "public, max-age=86400",
    },
    "/favicon.png": {
      file: path.join(ICONS_DIR, "icon.png"),
      contentType: "image/png",
      cache: "public, max-age=86400",
    },
  };

  const asset = assets[pathname];
  if (!asset) {
    return false;
  }

  sendFile(res, asset.file, asset.contentType, { cache: asset.cache });
  return true;
}

function getDownloadUrl(platform) {
  if (platform === "macos") {
    return (
      String(process.env.DOWNLOAD_MACOS_URL || process.env.DOWNLOAD_MAC_URL || "").trim() ||
      getGitHubReleaseDownloadUrl(platform)
    );
  }

  if (platform === "windows") {
    return (
      String(process.env.DOWNLOAD_WINDOWS_URL || process.env.DOWNLOAD_WIN_URL || "").trim() ||
      getGitHubReleaseDownloadUrl(platform)
    );
  }

  return "";
}

function isGitHubReleaseFallbackEnabled() {
  return String(process.env.DOWNLOAD_GITHUB_RELEASES || "1").trim() !== "0";
}

function getGitHubReleaseDownloadUrl(platform) {
  if (!isGitHubReleaseFallbackEnabled()) {
    return "";
  }

  const repository = String(
    process.env.DOWNLOAD_GITHUB_REPOSITORY ||
      process.env.GITHUB_REPOSITORY ||
      "webobscure/Onkron-Specification-CLI"
  ).trim();
  if (!/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repository)) {
    return "";
  }

  const assetName = String(
    platform === "macos"
      ? process.env.DOWNLOAD_MACOS_ASSET_NAME ||
          `VamShop Spec GUI-${packageJson.version}-mac.dmg`
      : process.env.DOWNLOAD_WINDOWS_ASSET_NAME ||
          `VamShop Spec GUI-${packageJson.version}-win.exe`
  ).trim();
  if (!assetName) {
    return "";
  }

  const tag = String(process.env.DOWNLOAD_GITHUB_TAG || "latest").trim();
  const releasePath =
    tag && tag !== "latest"
      ? `download/${encodeURIComponent(tag)}`
      : "latest/download";

  return `https://github.com/${repository}/releases/${releasePath}/${encodeURIComponent(assetName)}`;
}

function getDownloadFile(platform) {
  const explicitPath = String(
    platform === "macos"
      ? process.env.DOWNLOAD_MACOS_FILE || process.env.DOWNLOAD_MAC_FILE || ""
      : process.env.DOWNLOAD_WINDOWS_FILE || process.env.DOWNLOAD_WIN_FILE || ""
  ).trim();

  if (explicitPath && fs.existsSync(explicitPath)) {
    return explicitPath;
  }

  if (!fs.existsSync(RELEASE_DIR)) {
    return "";
  }

  const allowedExtensions =
    platform === "macos" ? new Set([".dmg", ".zip"]) : new Set([".exe", ".msi"]);
  const files = fs
    .readdirSync(RELEASE_DIR)
    .map((fileName) => path.join(RELEASE_DIR, fileName))
    .filter((filePath) => {
      const extension = path.extname(filePath).toLowerCase();
      return allowedExtensions.has(extension) && fs.statSync(filePath).isFile();
    })
    .sort((left, right) => fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs);

  return files[0] || "";
}

function isDownloadAvailable(platform) {
  return Boolean(getDownloadUrl(platform) || getDownloadFile(platform));
}

function renderLandingPage() {
  const title = String(process.env.LANDING_TITLE || "VamShop Spec");
  const subtitle = String(
    process.env.LANDING_SUBTITLE ||
      "Внутреннее desktop-приложение для безопасного переноса, редактирования и проверки спецификаций товаров."
  );
  const macAvailable = isDownloadAvailable("macos");
  const windowsAvailable = isDownloadAvailable("windows");
  const features = [
    "Перенос спецификаций между языками без прямого доступа пользователей к базе.",
    "Ручное редактирование значений по выбранному товару и языку.",
    "Автозаполнение и конвертация единиц измерения для VESA, нагрузки, высоты, габаритов и объема.",
    "Авторизация, роли пользователей и защищенный запуск массовых задач.",
    "Логи операций в Bitrix24 и прогресс выполнения долгих задач.",
  ];
  const featureItems = features.map((feature) => `<li>${escapeHtml(feature)}</li>`).join("");
  const downloadNote =
    macAvailable || windowsAvailable
      ? "Выберите платформу и скачайте актуальную сборку приложения."
      : "Ссылки на сборки пока не подключены на сервере.";
  const macIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M16.72 12.62c-.03-2.17 1.78-3.22 1.86-3.27-1.02-1.49-2.6-1.69-3.15-1.71-1.34-.14-2.62.79-3.3.79-.69 0-1.74-.77-2.87-.75-1.47.02-2.84.86-3.6 2.18-1.54 2.67-.39 6.62 1.09 8.79.73 1.04 1.59 2.21 2.72 2.17 1.1-.04 1.51-.7 2.84-.7 1.32 0 1.69.7 2.85.68 1.18-.02 1.92-1.06 2.64-2.11.84-1.21 1.18-2.39 1.19-2.45-.03-.01-2.24-.86-2.27-3.62ZM14.55 6.22c.6-.73 1.01-1.74.9-2.75-.87.04-1.93.58-2.55 1.31-.56.64-1.05 1.68-.92 2.67.97.08 1.96-.49 2.57-1.23Z"/></svg>`;
  const windowsIcon = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 4.7 10.8 3.6v7.7H3V4.7Zm9.1-1.3L21 2.1v9.2h-8.9V3.4ZM3 12.7h7.8v7.7L3 19.3v-6.6Zm9.1 0H21v9.2l-8.9-1.3v-7.9Z"/></svg>`;
  const macButton = macAvailable
    ? `<a class="button primary" href="/download/macos"><span class="os-icon mac">${macIcon}</span><span>Скачать для macOS</span></a>`
    : `<span class="button disabled" aria-disabled="true"><span class="os-icon mac">${macIcon}</span><span>macOS скоро будет</span></span>`;
  const windowsButton = windowsAvailable
    ? `<a class="button secondary" href="/download/windows"><span class="os-icon windows">${windowsIcon}</span><span>Скачать для Windows</span></a>`
    : `<span class="button secondary disabled" aria-disabled="true"><span class="os-icon windows">${windowsIcon}</span><span>Windows скоро будет</span></span>`;

  return `<!doctype html>
<html lang="ru">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHtml(title)}</title>
  <style>
    :root {
      --ink: #181612;
      --muted: #6f6658;
      --paper: #fbf7ee;
      --card: rgba(255, 253, 247, 0.9);
      --line: #ded6c7;
      --accent: #dd3c27;
      --accent-dark: #b82f1e;
      --teal: #24767c;
      --shadow: 0 26px 90px rgba(65, 48, 28, 0.16);
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      color: var(--ink);
      font-family: ui-rounded, "Avenir Next", "Trebuchet MS", system-ui, sans-serif;
      background:
        radial-gradient(circle at 10% 10%, rgba(221, 60, 39, 0.14), transparent 28rem),
        radial-gradient(circle at 90% 5%, rgba(36, 118, 124, 0.16), transparent 24rem),
        linear-gradient(135deg, #f2e8d9, #fffaf2 54%, #eee2d0);
    }
    main {
      width: min(1180px, calc(100% - 32px));
      min-height: 100vh;
      margin: 0 auto;
      padding: 32px 0;
      display: grid;
      align-items: center;
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 0.98fr) minmax(360px, 1.02fr);
      gap: 24px;
      align-items: stretch;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 30px;
      background: var(--card);
      box-shadow: var(--shadow);
      padding: clamp(26px, 4vw, 46px);
      backdrop-filter: blur(14px);
    }
    .intro {
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      min-height: 560px;
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 12px;
      color: var(--muted);
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 13px;
    }
    .eyebrow::before {
      content: "";
      width: 34px;
      height: 14px;
      flex: 0 0 auto;
      border-radius: 999px;
      background:
        radial-gradient(circle at 7px 50%, var(--accent) 0 6px, transparent 6.5px),
        radial-gradient(circle at 26px 50%, var(--teal) 0 6px, transparent 6.5px);
    }
    h1 {
      margin: 42px 0 22px;
      max-width: 600px;
      font-size: clamp(54px, 6vw, 82px);
      line-height: 0.9;
      letter-spacing: -0.07em;
    }
    p {
      margin: 0;
      color: var(--muted);
      max-width: 560px;
      font-size: clamp(18px, 1.8vw, 21px);
      line-height: 1.48;
    }
    .actions {
      display: flex;
      flex-wrap: nowrap;
      gap: 12px;
      margin-top: 42px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      min-height: 54px;
      min-width: 0;
      flex: 1 1 0;
      padding: 0 22px;
      border-radius: 16px;
      color: #fff;
      background: linear-gradient(135deg, var(--accent), var(--accent-dark));
      text-decoration: none;
      font-weight: 900;
      font-size: 16px;
      box-shadow: 0 16px 34px rgba(221, 60, 39, 0.27);
      transition: transform 160ms ease, box-shadow 160ms ease;
    }
    .os-icon {
      display: inline-grid;
      place-items: center;
      width: 23px;
      height: 23px;
      flex: 0 0 auto;
    }
    .os-icon svg {
      display: block;
      width: 100%;
      height: 100%;
      fill: currentColor;
    }
    .button:hover {
      transform: translateY(-2px);
      box-shadow: 0 20px 42px rgba(221, 60, 39, 0.32);
    }
    .button.secondary {
      color: var(--ink);
      background: #fff9ef;
      border: 1px solid var(--line);
      box-shadow: none;
    }
    .button.disabled {
      pointer-events: none;
      color: #9a9388;
      background: #ebe7df;
      border: 1px solid #d8d0c2;
      box-shadow: none;
      filter: none;
    }
    .features-panel {
      display: grid;
      align-content: center;
    }
    .features-title {
      margin: 0 0 18px;
      font-size: clamp(28px, 3vw, 38px);
      line-height: 1;
      letter-spacing: -0.045em;
    }
    .features {
      display: grid;
      gap: 12px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .features li {
      position: relative;
      padding: 17px 18px 17px 46px;
      border: 1px solid var(--line);
      border-radius: 20px;
      background: rgba(255, 255, 255, 0.62);
      color: #40392f;
      font-size: 16px;
      line-height: 1.35;
      font-weight: 700;
    }
    .features li::before {
      content: "";
      position: absolute;
      left: 18px;
      top: 23px;
      width: 13px;
      height: 13px;
      border-radius: 50%;
      background: var(--teal);
    }
    .note {
      margin-top: 18px;
      color: var(--muted);
      font-size: 13px;
      font-weight: 700;
    }
    .status {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      margin-top: 18px;
      padding: 10px 13px;
      border: 1px solid var(--line);
      border-radius: 999px;
      color: var(--muted);
      background: rgba(255, 255, 255, 0.5);
      font-size: 13px;
      font-weight: 800;
    }
    .status::before {
      content: "";
      width: 9px;
      height: 9px;
      border-radius: 50%;
      background: ${macAvailable || windowsAvailable ? "var(--teal)" : "#b7afa2"};
    }
    @media (max-width: 860px) {
      main { padding: 22px 0; }
      .hero { grid-template-columns: 1fr; }
      .panel { border-radius: 26px; }
      .intro { min-height: auto; }
      h1 { font-size: clamp(44px, 13vw, 62px); }
      .actions { flex-direction: column; }
      .button { width: 100%; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="panel intro">
        <div>
          <div class="eyebrow">ONKRON internal tool</div>
          <h1>${escapeHtml(title)}</h1>
          <p>${escapeHtml(subtitle)}</p>
        </div>
        <div>
          <div class="actions">
            <a class="button secondary" href="/app"><span>Открыть веб-версию</span></a>
            ${macButton}
            ${windowsButton}
          </div>
          <div class="status">${escapeHtml(downloadNote)}</div>
        </div>
      </div>
      <div class="panel features-panel">
        <h2 class="features-title">Что умеет приложение</h2>
        <ul class="features">${featureItems}</ul>
      </div>
    </section>
  </main>
</body>
</html>`;
}

function getContentType(filePath) {
  const extension = path.extname(filePath).toLowerCase();
  if (extension === ".dmg") {
    return "application/x-apple-diskimage";
  }
  if (extension === ".exe") {
    return "application/vnd.microsoft.portable-executable";
  }
  if (extension === ".msi") {
    return "application/x-msi";
  }
  if (extension === ".zip") {
    return "application/zip";
  }
  return "application/octet-stream";
}

function handleDownload(res, platform) {
  const url = getDownloadUrl(platform);
  if (url) {
    res.writeHead(302, {
      Location: url,
      "Cache-Control": "no-store",
    });
    res.end();
    return;
  }

  const filePath = getDownloadFile(platform);
  if (!filePath) {
    sendHtml(
      res,
      404,
      "<!doctype html><meta charset=\"utf-8\"><title>Сборка не найдена</title><body>Файл сборки пока не подключен.</body>"
    );
    return;
  }

  const fileName = path.basename(filePath);
  const stat = fs.statSync(filePath);
  res.writeHead(200, {
    "Content-Type": getContentType(filePath),
    "Content-Length": stat.size,
    "Content-Disposition": `attachment; filename="${escapeAttribute(fileName)}"`,
    "Cache-Control": "private, max-age=60",
    "X-Content-Type-Options": "nosniff",
  });
  fs.createReadStream(filePath).pipe(res);
}

async function runTaskAction(body, user, progressHandlers = {}) {
  ensureAdvanced(user);

  const {
    task,
    sourceLanguageId = 1,
    targetLanguageId = ALL_TARGETS,
    materialLanguageId = ALL_TARGETS,
    dryRun = false,
  } = body || {};

  if (!task) {
    throw new Error("Не указана задача");
  }

  const flags = {
    sourceLanguageId: normalizeLanguageInput(sourceLanguageId, 1),
    targetLanguageId: normalizeLanguageInput(targetLanguageId, ALL_TARGETS, { allowAll: true }),
    materialLanguageId: normalizeLanguageInput(materialLanguageId, ALL_TARGETS, { allowAll: true }),
    dryRun: Boolean(dryRun),
  };
  const plan = getRunPlan(task, flags);
  const stageOrder = new Map();
  let nextStageIndex = 0;

  progressHandlers.onProgressPlan?.({
    type: "task-plan",
    task,
    stageTotal: Number(plan?.stageTotal) || 0,
  });

  const result = await runTask(task, flags, {
    onProgress: (progress) => {
      const stageKey = [
        String(progress?.taskName || ""),
        String(progress?.targetLanguageId || ""),
        String(progress?.specificationId || ""),
      ].join("|");

      if (!stageOrder.has(stageKey)) {
        nextStageIndex += 1;
        stageOrder.set(stageKey, nextStageIndex);
      }

      progressHandlers.onProgress?.({
        type: "task",
        stageIndex: stageOrder.get(stageKey),
        stageTotal: Number(plan?.stageTotal) || 0,
        ...progress,
      });
    },
  });
  const tasks = Array.isArray(result) ? result : [result];

  void sendBitrixChangeLog({
    channel: "gui-task",
    task,
    dryRun: flags.dryRun,
    user: user?.username || "api",
    sourceLanguageId: flags.sourceLanguageId,
    targetLanguageId: flags.targetLanguageId,
    stats: tasks,
  });

  return {
    ok: true,
    task,
    tasks,
    finishedAt: new Date().toISOString(),
  };
}

async function transferSubmitAction(body, user, progressHandlers = {}) {
  const productId = validateProductId(body?.productId);
  const result = await transferSelectedProductSpecifications({
    productId,
    sourceLanguageId: normalizeLanguageInput(TRANSFER_SOURCE_LANGUAGE_ID, 1),
    targetLanguageId: normalizeLanguageInput(body?.targetLanguageId || ALL_TARGETS, ALL_TARGETS, {
      allowAll: true,
    }),
    specIds: Array.isArray(body?.specIds) ? body.specIds.map((id) => Number(id)) : [],
    dryRun: Boolean(body?.dryRun),
    onProgress: (progress) => progressHandlers.onProgress?.({ type: "transfer", ...progress }),
  });

  void sendBitrixChangeLog({
    channel: "gui-transfer",
    task: "transfer-selected-specifications",
    dryRun: Boolean(body?.dryRun),
    user: user?.username || "api",
    sourceLanguageId: result.sourceLanguageId,
    targetLanguageId: Array.isArray(result.targetLanguageIds)
      ? result.targetLanguageIds.join(",")
      : result.targetLanguageId,
    productId: result.productId,
    productName: result.productName,
    specIds: result.specIds,
    stats: [result],
  });

  return result;
}

async function handleRoute(req, res) {
  const parsedUrl = new URL(req.url, "http://localhost");
  const method = req.method || "GET";
  const rawPathname = parsedUrl.pathname;
  const pathname = rawPathname.replace(/\/+$/, "") || "/";

  if (method === "GET" && pathname === "/") {
    sendHtml(res, 200, renderLandingPage());
    return;
  }

  if (method === "GET" && rawPathname === "/app") {
    res.writeHead(302, {
      Location: "/app/",
      "Cache-Control": "no-store",
    });
    res.end();
    return;
  }

  if (method === "GET" && handleWebAppAsset(res, rawPathname)) {
    return;
  }

  if (method === "GET" && pathname === "/health") {
    sendJson(res, 200, { ok: true });
    return;
  }

  if (method === "GET" && pathname === "/download/macos") {
    handleDownload(res, "macos");
    return;
  }

  if (method === "GET" && pathname === "/download/windows") {
    handleDownload(res, "windows");
    return;
  }

  if (method === "GET" && pathname === "/auth/config") {
    sendJson(res, 200, { required: isAuthRequired() });
    return;
  }

  if (method === "GET" && pathname === "/countries") {
    sendJson(res, 200, COUNTRY_BY_LANGUAGE_ID);
    return;
  }

  if (method === "POST" && pathname === "/auth/login") {
    const credentials = await readJsonBody(req);
    const user = await authenticate(credentials);
    const token = createToken(user);
    sendJson(res, 200, { ...createSessionState(user), token });
    return;
  }

  if (method === "POST" && pathname === "/auth/logout") {
    sendJson(res, 200, createSessionState(null));
    return;
  }

  if (method === "GET" && pathname === "/auth/session") {
    const user = getRequestUser(req);
    sendJson(res, 200, createSessionState(user));
    return;
  }

  const user = getRequestUser(req);

  if (method === "POST" && pathname === "/tasks/run") {
    const body = await readJsonBody(req);
    if (wantsNdjson(req)) {
      initNdjson(res);
      try {
        const result = await runTaskAction(body, user, {
          onProgressPlan: (payload) => writeNdjson(res, "progress-plan", payload),
          onProgress: (payload) => writeNdjson(res, "progress", payload),
        });
        writeNdjson(res, "result", result);
      } catch (error) {
        writeNdjson(res, "error", { message: error?.message || "Ошибка запуска задачи" });
      }
      res.end();
      return;
    }

    sendJson(res, 200, await runTaskAction(body, user));
    return;
  }

  if (method === "POST" && pathname === "/transfer/products") {
    const body = await readJsonBody(req);
    sendJson(
      res,
      200,
      await listTransferProducts({
        sourceLanguageId: normalizeLanguageInput(TRANSFER_SOURCE_LANGUAGE_ID, 1),
        search: String(body?.search || ""),
        limit: Number(body?.limit) || 120,
      })
    );
    return;
  }

  if (method === "POST" && pathname === "/transfer/product-specs") {
    const body = await readJsonBody(req);
    sendJson(
      res,
      200,
      await getTransferProductSpecifications({
        sourceLanguageId: normalizeLanguageInput(TRANSFER_SOURCE_LANGUAGE_ID, 1),
        productId: validateProductId(body?.productId),
      })
    );
    return;
  }

  if (method === "POST" && pathname === "/editor/product-specs") {
    const body = await readJsonBody(req);
    sendJson(
      res,
      200,
      await getEditableProductSpecifications({
        sourceLanguageId: normalizeLanguageInput(TRANSFER_SOURCE_LANGUAGE_ID, 1),
        languageId: validateLanguageId(body?.languageId),
        productId: validateProductId(body?.productId),
      })
    );
    return;
  }

  if (method === "POST" && pathname === "/editor/save-product-specs") {
    const body = await readJsonBody(req);
    const productId = validateProductId(body?.productId);
    const languageId = validateLanguageId(body?.languageId);
    const result = await saveEditableProductSpecifications({
      productId,
      languageId,
      specs: Array.isArray(body?.specs) ? body.specs : [],
    });

    void sendBitrixChangeLog({
      channel: "gui-edit",
      task: "edit-product-specifications",
      dryRun: false,
      user: user?.username || "api",
      targetLanguageId: languageId,
      productId: result.productId,
      productName: result.productName,
      specIds: result.specIds,
      stats: [result],
    });

    sendJson(res, 200, result);
    return;
  }

  if (method === "POST" && pathname === "/transfer/submit") {
    const body = await readJsonBody(req);
    if (wantsNdjson(req)) {
      initNdjson(res);
      try {
        const result = await transferSubmitAction(body, user, {
          onProgress: (payload) => writeNdjson(res, "progress", payload),
        });
        writeNdjson(res, "result", result);
      } catch (error) {
        writeNdjson(res, "error", { message: error?.message || "Ошибка переноса" });
      }
      res.end();
      return;
    }

    sendJson(res, 200, await transferSubmitAction(body, user));
    return;
  }

  sendJson(res, 404, { error: "Endpoint не найден" });
}

function createServer() {
  return http.createServer((req, res) => {
    handleRoute(req, res).catch((error) => sendError(res, error));
  });
}

module.exports = {
  createServer,
};
