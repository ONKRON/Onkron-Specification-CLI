const http = require("http");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const { URL } = require("url");
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

function getDownloadUrl(platform) {
  if (platform === "macos") {
    return String(process.env.DOWNLOAD_MACOS_URL || process.env.DOWNLOAD_MAC_URL || "").trim();
  }

  if (platform === "windows") {
    return String(process.env.DOWNLOAD_WINDOWS_URL || process.env.DOWNLOAD_WIN_URL || "").trim();
  }

  return "";
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
  const title = String(process.env.LANDING_TITLE || "VamShop Specification GUI");
  const subtitle = String(
    process.env.LANDING_SUBTITLE ||
      "Desktop-приложение для безопасной работы со спецификациями товаров VamShop."
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
      --card: rgba(255, 253, 247, 0.86);
      --line: #ded6c7;
      --accent: #dd3c27;
      --accent-dark: #b82f1e;
      --shadow: 0 24px 80px rgba(70, 54, 34, 0.18);
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
        linear-gradient(135deg, #f4ebdc, #fffaf1 52%, #efe3d1);
    }
    main {
      width: min(1120px, calc(100% - 32px));
      margin: 0 auto;
      padding: 56px 0;
    }
    .hero {
      display: grid;
      grid-template-columns: minmax(0, 1.1fr) minmax(320px, 0.9fr);
      gap: 28px;
      align-items: stretch;
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 34px;
      background: var(--card);
      box-shadow: var(--shadow);
      padding: clamp(28px, 4vw, 52px);
      backdrop-filter: blur(14px);
    }
    .eyebrow {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      color: var(--muted);
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      font-size: 13px;
    }
    .eyebrow::before {
      content: "";
      width: 12px;
      height: 12px;
      border-radius: 999px;
      background: var(--accent);
      box-shadow: 18px 0 0 #24767c;
    }
    h1 {
      margin: 28px 0 18px;
      max-width: 760px;
      font-size: clamp(42px, 7vw, 84px);
      line-height: 0.92;
      letter-spacing: -0.07em;
    }
    p {
      margin: 0;
      color: var(--muted);
      font-size: clamp(18px, 2vw, 23px);
      line-height: 1.45;
    }
    .actions {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
      margin-top: 34px;
    }
    .button {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-height: 58px;
      padding: 0 24px;
      border-radius: 18px;
      color: #fff;
      background: linear-gradient(135deg, var(--accent), var(--accent-dark));
      text-decoration: none;
      font-weight: 900;
      font-size: 17px;
      box-shadow: 0 14px 30px rgba(221, 60, 39, 0.28);
    }
    .button.secondary {
      color: var(--ink);
      background: #fff9ef;
      border: 1px solid var(--line);
      box-shadow: none;
    }
    .button.disabled {
      pointer-events: none;
      opacity: 0.48;
      filter: grayscale(1);
    }
    .features {
      display: grid;
      gap: 14px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .features li {
      position: relative;
      padding: 18px 18px 18px 48px;
      border: 1px solid var(--line);
      border-radius: 22px;
      background: rgba(255, 255, 255, 0.54);
      color: #40392f;
      font-size: 17px;
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
      background: #24767c;
    }
    .note {
      margin-top: 18px;
      color: var(--muted);
      font-size: 14px;
      font-weight: 700;
    }
    @media (max-width: 860px) {
      main { padding: 22px 0; }
      .hero { grid-template-columns: 1fr; }
      .panel { border-radius: 26px; }
      .button { width: 100%; }
    }
  </style>
</head>
<body>
  <main>
    <section class="hero">
      <div class="panel">
        <div class="eyebrow">ONKRON internal tool</div>
        <h1>${escapeHtml(title)}</h1>
        <p>${escapeHtml(subtitle)}</p>
        <div class="actions">
          <a class="button${macAvailable ? "" : " disabled"}" href="/download/macos">Скачать для macOS</a>
          <a class="button secondary${windowsAvailable ? "" : " disabled"}" href="/download/windows">Скачать для Windows</a>
        </div>
        <div class="note">Если кнопка неактивна, файл сборки еще не подключен на сервере.</div>
      </div>
      <div class="panel">
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
  const pathname = parsedUrl.pathname.replace(/\/+$/, "") || "/";

  if (method === "GET" && pathname === "/") {
    sendHtml(res, 200, renderLandingPage());
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
