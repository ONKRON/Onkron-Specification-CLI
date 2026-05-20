const path = require("path");
const fs = require("fs");
const dotenv = require("dotenv");
const { app, BrowserWindow, ipcMain, nativeImage } = require("electron");
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
const { isAuthRequired, authenticate } = require("./auth");
const { createApiClient } = require("./apiClient");

dotenv.config();

const ALL_TARGETS = "all";
const TRANSFER_SOURCE_LANGUAGE_ID = Number(
  process.env.TRANSFER_SOURCE_LANGUAGE_ID || 1
);
const apiBaseUrl = resolveApiBaseUrl();
const apiClient = apiBaseUrl ? createApiClient({ baseUrl: apiBaseUrl }) : null;
let apiAuthRequired = true;
let sessionUser = null;

function readJsonConfig(filePath) {
  if (!filePath || !fs.existsSync(filePath)) {
    return null;
  }

  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch (_error) {
    return null;
  }
}

function resolveApiBaseUrl() {
  const fromEnv = String(
    process.env.API_BASE_URL || process.env.VAMSHOP_API_BASE_URL || ""
  ).trim();
  if (fromEnv) {
    return fromEnv;
  }

  const candidates = [
    process.env.VAMSHOP_CONFIG_PATH,
    path.join(__dirname, "app-config.json"),
    process.resourcesPath
      ? path.join(process.resourcesPath, "app-config.json")
      : "",
    path.join(path.dirname(process.execPath), "app-config.json"),
  ];

  for (const candidate of candidates) {
    const config = readJsonConfig(candidate);
    const configuredUrl = String(
      config?.apiBaseUrl || config?.API_BASE_URL || ""
    ).trim();
    if (configuredUrl) {
      return configuredUrl;
    }
  }

  return "";
}

function isApiMode() {
  return Boolean(apiClient);
}

function resolveIconPath() {
  const candidates = [
    path.join(__dirname, "..", "build", "icons", "icon.icns"),
    path.join(__dirname, "..", "build", "icons", "icon.png"),
    path.join(__dirname, "..", "build", "icons", "icon.ico"),
    path.join(__dirname, "..", "build", "icons", "icon.jpg"),
    path.join(__dirname, "..", "build", "icons", "icon.jpeg"),
  ];

  let bestPath = null;
  let bestScore = -1;

  for (const candidate of candidates) {
    if (!fs.existsSync(candidate)) {
      continue;
    }

    const iconImage = nativeImage.createFromPath(candidate);
    if (iconImage.isEmpty()) {
      continue;
    }

    const { width, height } = iconImage.getSize();
    const extension = path.extname(candidate).toLowerCase();
    const pixelScore = Math.max(0, width) * Math.max(0, height);
    const macIcnsBonus =
      process.platform === "darwin" && extension === ".icns" ? 1_000_000_000 : 0;
    const score = macIcnsBonus + pixelScore;

    if (score > bestScore) {
      bestScore = score;
      bestPath = candidate;
    }
  }

  return bestPath;
}

const appIconPath = resolveIconPath();

function getSessionState() {
  if (isApiMode()) {
    return {
      required: apiAuthRequired,
      authenticated: !apiAuthRequired || Boolean(sessionUser),
      user: !apiAuthRequired
        ? { id: 0, username: "api", role: "admin" }
        : sessionUser,
    };
  }

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
    authenticated: Boolean(sessionUser),
    user: sessionUser,
  };
}

function ensureAuthenticated() {
  const session = getSessionState();
  if (!session.required) {
    return;
  }
  if (!session.authenticated) {
    throw new Error("Требуется авторизация");
  }
}

function hasAdvancedAccess(user) {
  const role = String(user?.role || "user").trim().toLowerCase();
  return role === "advanced" || role === "admin";
}

function ensureAdvancedAccess() {
  ensureAuthenticated();
  const session = getSessionState();
  if (!hasAdvancedAccess(session.user)) {
    throw new Error("Недостаточно прав. Нужна роль advanced или admin.");
  }
}

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

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1260,
    height: 860,
    minWidth: 1000,
    minHeight: 680,
    title: "VamShop Спецификации",
    backgroundColor: "#f4f1e8",
    ...(appIconPath ? { icon: appIconPath } : {}),
    webPreferences: {
      preload: path.join(__dirname, "preload.js"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));
}

ipcMain.handle("spec:get-countries", async () => {
  if (isApiMode()) {
    return apiClient.getCountries();
  }

  return COUNTRY_BY_LANGUAGE_ID;
});

ipcMain.handle("spec:auth:get-config", async () => {
  if (isApiMode()) {
    const config = await apiClient.getAuthConfig();
    apiAuthRequired = Boolean(config?.required);
    return config;
  }

  return {
    required: isAuthRequired(),
  };
});

ipcMain.handle("spec:auth:get-session", async () => {
  if (isApiMode()) {
    return getSessionState();
  }

  return getSessionState();
});

ipcMain.handle("spec:auth:login", async (_event, credentials) => {
  if (isApiMode()) {
    const session = await apiClient.login(credentials);
    apiAuthRequired = Boolean(session?.required);
    sessionUser = session?.user || null;
    return getSessionState();
  }

  const user = await authenticate(credentials);
  sessionUser = user;
  return getSessionState();
});

ipcMain.handle("spec:auth:logout", async () => {
  if (isApiMode()) {
    const session = await apiClient.logout();
    apiAuthRequired = Boolean(session?.required);
    sessionUser = null;
    return getSessionState();
  }

  sessionUser = null;
  return getSessionState();
});

ipcMain.handle("spec:run-task", async (_event, payload) => {
  if (isApiMode()) {
    return apiClient.runTask(payload || {}, {
      onProgressPlan: (progressPlan) => {
        _event.sender.send("spec:progress-plan", progressPlan);
      },
      onProgress: (progress) => {
        _event.sender.send("spec:progress", progress);
      },
    });
  }

  ensureAdvancedAccess();

  const {
    task,
    sourceLanguageId = 1,
    targetLanguageId = ALL_TARGETS,
    materialLanguageId = ALL_TARGETS,
    dryRun = false,
  } = payload || {};

  if (!task) {
    throw new Error("Не указана задача");
  }

  const flags = {
    sourceLanguageId: normalizeLanguageInput(sourceLanguageId, 1),
    targetLanguageId: normalizeLanguageInput(targetLanguageId, ALL_TARGETS, {
      allowAll: true,
    }),
    materialLanguageId: normalizeLanguageInput(materialLanguageId, ALL_TARGETS, {
      allowAll: true,
    }),
    dryRun: Boolean(dryRun),
  };
  const plan = getRunPlan(task, flags);
  const stageOrder = new Map();
  let nextStageIndex = 0;

  _event.sender.send("spec:progress-plan", {
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

      _event.sender.send("spec:progress", {
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
    user: sessionUser?.username || "локально",
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
});

ipcMain.handle("spec:transfer:list-products", async (_event, payload) => {
  if (isApiMode()) {
    return apiClient.listTransferProducts(payload || {});
  }

  ensureAuthenticated();

  const {
    search = "",
    limit = 120,
  } = payload || {};

  return listTransferProducts({
    sourceLanguageId: normalizeLanguageInput(
      TRANSFER_SOURCE_LANGUAGE_ID,
      1
    ),
    search: String(search || ""),
    limit: Number(limit) || 120,
  });
});

ipcMain.handle("spec:transfer:get-product-specs", async (_event, payload) => {
  if (isApiMode()) {
    return apiClient.getTransferProductSpecs(payload || {});
  }

  ensureAuthenticated();

  const {
    productId,
  } = payload || {};

  const normalizedProductId = Number(productId);
  if (!Number.isInteger(normalizedProductId) || normalizedProductId < 1) {
    throw new Error("Нужен корректный productId");
  }

  return getTransferProductSpecifications({
    sourceLanguageId: normalizeLanguageInput(
      TRANSFER_SOURCE_LANGUAGE_ID,
      1
    ),
    productId: normalizedProductId,
  });
});

ipcMain.handle("spec:editor:get-product-specs", async (_event, payload) => {
  if (isApiMode()) {
    return apiClient.getEditableProductSpecs(payload || {});
  }

  ensureAuthenticated();

  const {
    productId,
    languageId,
  } = payload || {};

  const normalizedProductId = Number(productId);
  const normalizedLanguageId = Number(languageId);
  if (!Number.isInteger(normalizedProductId) || normalizedProductId < 1) {
    throw new Error("Нужен корректный productId");
  }
  if (!Number.isInteger(normalizedLanguageId) || normalizedLanguageId < 1) {
    throw new Error("Нужен корректный languageId");
  }

  return getEditableProductSpecifications({
    sourceLanguageId: normalizeLanguageInput(
      TRANSFER_SOURCE_LANGUAGE_ID,
      1
    ),
    languageId: normalizedLanguageId,
    productId: normalizedProductId,
  });
});

ipcMain.handle("spec:editor:save-product-specs", async (_event, payload) => {
  if (isApiMode()) {
    return apiClient.saveEditableProductSpecs(payload || {});
  }

  ensureAuthenticated();

  const {
    productId,
    languageId,
    specs = [],
  } = payload || {};

  const normalizedProductId = Number(productId);
  const normalizedLanguageId = Number(languageId);
  if (!Number.isInteger(normalizedProductId) || normalizedProductId < 1) {
    throw new Error("Нужен корректный productId");
  }
  if (!Number.isInteger(normalizedLanguageId) || normalizedLanguageId < 1) {
    throw new Error("Нужен корректный languageId");
  }

  const result = await saveEditableProductSpecifications({
    productId: normalizedProductId,
    languageId: normalizedLanguageId,
    specs: Array.isArray(specs) ? specs : [],
  });

  void sendBitrixChangeLog({
    channel: "gui-edit",
    task: "edit-product-specifications",
    dryRun: false,
    user: sessionUser?.username || "локально",
    targetLanguageId: normalizedLanguageId,
    productId: result.productId,
    productName: result.productName,
    specIds: result.specIds,
    stats: [result],
  });

  return result;
});

ipcMain.handle("spec:transfer:submit", async (_event, payload) => {
  if (isApiMode()) {
    return apiClient.submitTransfer(payload || {}, {
      onProgress: (progress) => {
        _event.sender.send("spec:progress", progress);
      },
    });
  }

  ensureAuthenticated();

  const {
    productId,
    targetLanguageId = ALL_TARGETS,
    specIds = [],
    dryRun = false,
  } = payload || {};

  const normalizedProductId = Number(productId);
  if (!Number.isInteger(normalizedProductId) || normalizedProductId < 1) {
    throw new Error("Нужен корректный productId");
  }

  const result = await transferSelectedProductSpecifications({
    productId: normalizedProductId,
    sourceLanguageId: normalizeLanguageInput(
      TRANSFER_SOURCE_LANGUAGE_ID,
      1
    ),
    targetLanguageId: normalizeLanguageInput(targetLanguageId, ALL_TARGETS, {
      allowAll: true,
    }),
    specIds: Array.isArray(specIds) ? specIds.map((id) => Number(id)) : [],
    dryRun: Boolean(dryRun),
    onProgress: (progress) => {
      _event.sender.send("spec:progress", {
        type: "transfer",
        ...progress,
      });
    },
  });

  void sendBitrixChangeLog({
    channel: "gui-transfer",
    task: "transfer-selected-specifications",
    dryRun: Boolean(dryRun),
    user: sessionUser?.username || "локально",
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
});

app.whenReady().then(() => {
  if (process.platform === "darwin" && appIconPath) {
    const iconImage = nativeImage.createFromPath(appIconPath);
    if (!iconImage.isEmpty()) {
      app.dock.setIcon(iconImage);
    }
  }

  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    app.quit();
  }
});
